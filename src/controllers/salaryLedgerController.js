import { z } from "zod";
import SalaryLedgerEntry from "../models/SalaryLedgerEntry.js";
import TravelRateSetting from "../models/TravelRateSetting.js";
import Employee from "../models/Employee.js";
import { employeeWorksAtSite } from "../utils/siteAccess.js";
import { uploadDocument, deleteDocument } from "../utils/documentStorage.js";
import { asyncHandler, apiError, apiSuccess } from "../utils/apiResponse.js";

// The document is sent up as a base64 data URL and immediately forwarded to
// Cloudinary — this cap is on that request payload, not on the final stored file.
// ~7MB of base64 text corresponds to a source file of roughly 5MB.
const MAX_DOCUMENT_BASE64_LENGTH = 7_000_000;

const documentSchema = z
  .object({
    name: z.string().min(1),
    mimeType: z.string().min(1),
    data: z.string().min(1).max(MAX_DOCUMENT_BASE64_LENGTH, "Document is too large (max ~5MB)."),
  })
  .nullable()
  .optional();

const createEntrySchema = z
  .object({
    employee: z.string().min(1),
    type: z.enum(["DAILY_DEDUCTION", "ADVANCE", "FINE", "TRAVEL"]),
    date: z.coerce.date().optional(),
    amount: z.number().positive().optional(), // required for non-TRAVEL types
    km: z.number().positive().optional(), // required for TRAVEL
    remark: z.string().min(1, "A remark/reason is required for every entry"),
    document: documentSchema,
  })
  .refine((data) => data.type === "TRAVEL" || (data.amount && data.amount > 0), {
    message: "Amount is required",
    path: ["amount"],
  })
  .refine((data) => data.type !== "TRAVEL" || (data.km && data.km > 0), {
    message: "Distance in km is required for a travel entry",
    path: ["km"],
  });

const rateSchema = z.object({
  ratePerKm: z.number().positive(),
});

async function assertEmployeeSiteAccess(user, employee) {
  if (user.role === "SUPER_ADMIN" || user.role === "MANAGEMENT" || user.role === "ACCOUNTS") return true;
  return employeeWorksAtSite(employee, user.site);
}

// POST /api/salary-ledger
export const createLedgerEntry = asyncHandler(async (req, res) => {
  const parsed = createEntrySchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid entry", parsed.error.flatten());

  const { employee: employeeId, type, remark, document } = parsed.data;
  const date = parsed.data.date || new Date();

  const employee = await Employee.findById(employeeId);
  if (!employee) return apiError(res, 404, "Employee/labour not found");

  const allowed = await assertEmployeeSiteAccess(req.user, employee);
  if (!allowed) return apiError(res, 403, "You cannot add an entry for another site's employee.");

  let uploadedDocument;
  if (document) {
    const uploaded = await uploadDocument(document.data, { name: document.name });
    uploadedDocument = {
      name: document.name,
      mimeType: document.mimeType,
      url: uploaded.url,
      publicId: uploaded.publicId,
      resourceType: uploaded.resourceType,
    };
  }

  const entryData = {
    employee: employee._id,
    site: employee.site,
    type,
    date,
    month: date.getMonth() + 1,
    year: date.getFullYear(),
    remark,
    document: uploadedDocument,
    addedBy: req.user._id,
  };

  if (type === "TRAVEL") {
    const rateDoc = await TravelRateSetting.getSingleton();
    entryData.km = parsed.data.km;
    entryData.ratePerKm = rateDoc.ratePerKm;
    entryData.amount = Math.round(parsed.data.km * rateDoc.ratePerKm * 100) / 100;
  } else {
    entryData.amount = parsed.data.amount;
  }

  const entry = await SalaryLedgerEntry.create(entryData);
  const populated = await entry.populate([
    { path: "employee", select: "name labourId employeeCode employeeType wagesSubCategory" },
    { path: "addedBy", select: "name" },
  ]);

  return apiSuccess(res, 201, populated, "Entry recorded");
});

// GET /api/salary-ledger?employee=&employeeType=&site=&type=&status=&month=&year=&from=&to=
export const listLedgerEntries = asyncHandler(async (req, res) => {
  const { employee, type, status, month, year, from, to } = req.query;
  const filter = {};

  if (req.user.role === "ADMIN" || req.user.role === "STORE_KEEPER") {
    filter.site = req.user.site;
  } else if (req.query.site) {
    filter.site = req.query.site;
  }

  if (employee) filter.employee = employee;
  if (type) filter.type = type;
  if (status) filter.status = status;
  if (month) filter.month = Number(month);
  if (year) filter.year = Number(year);
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }

  let entries = await SalaryLedgerEntry.find(filter)
    .populate("employee", "name labourId employeeCode employeeType wagesSubCategory site")
    .populate("addedBy", "name")
    .sort({ date: -1, createdAt: -1 });

  // employeeType (PERMANENT/WAGES) filters on the populated employee, so it's
  // applied in-memory after the query rather than as a Mongo-side join.
  if (req.query.employeeType) {
    entries = entries.filter((e) => e.employee?.employeeType === req.query.employeeType);
  }

  return apiSuccess(res, 200, entries);
});

// DELETE /api/salary-ledger/:id
export const deleteLedgerEntry = asyncHandler(async (req, res) => {
  const entry = await SalaryLedgerEntry.findById(req.params.id);
  if (!entry) return apiError(res, 404, "Entry not found");

  // Deleting is restricted to Super Admin (any site) or Admin (their own site
  // only) — the route-level `authorize` already blocks every other role, this
  // just adds the same-site check for Admins.
  const allowed =
    req.user.role === "SUPER_ADMIN" ||
    (req.user.role === "ADMIN" && String(entry.site) === String(req.user.site));
  if (!allowed) return apiError(res, 403, "You cannot modify an entry for another site.");

  if (entry.status === "SETTLED") {
    return apiError(res, 400, "This entry has already been applied to a generated salary and can't be deleted.");
  }

  await deleteDocument(entry.document?.publicId, entry.document?.resourceType);
  await entry.deleteOne();
  return apiSuccess(res, 200, { _id: req.params.id }, "Entry deleted");
});

// GET /api/salary-ledger/pending-summary?employee=&month=&year=
// Running totals for a person's still-unsettled entries in a given pay period, so a
// client can see what will land on the next salary before generating it.
export const getPendingSummary = asyncHandler(async (req, res) => {
  const { employee, month, year } = req.query;
  if (!employee || !month || !year) {
    return apiError(res, 400, "employee, month and year are required");
  }

  const entries = await SalaryLedgerEntry.find({
    employee,
    month: Number(month),
    year: Number(year),
    status: "PENDING",
  });

  const summary = { DAILY_DEDUCTION: 0, ADVANCE: 0, FINE: 0, TRAVEL: 0 };
  for (const e of entries) summary[e.type] += e.amount;

  return apiSuccess(res, 200, summary);
});

// GET /api/salary-ledger/travel-rate
export const getTravelRate = asyncHandler(async (req, res) => {
  const rateDoc = await TravelRateSetting.getSingleton();
  return apiSuccess(res, 200, { ratePerKm: rateDoc.ratePerKm, updatedAt: rateDoc.updatedAt });
});

// PUT /api/salary-ledger/travel-rate — { ratePerKm }
export const updateTravelRate = asyncHandler(async (req, res) => {
  const parsed = rateSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid rate", parsed.error.flatten());

  const rateDoc = await TravelRateSetting.getSingleton();
  rateDoc.ratePerKm = parsed.data.ratePerKm;
  rateDoc.updatedBy = req.user._id;
  await rateDoc.save();

  return apiSuccess(res, 200, { ratePerKm: rateDoc.ratePerKm, updatedAt: rateDoc.updatedAt }, "Travel rate updated");
});
