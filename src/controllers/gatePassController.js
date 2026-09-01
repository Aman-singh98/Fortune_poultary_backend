import { z } from "zod";
import GatePass from "../models/GatePass.js";
import User from "../models/User.js";
import { generateSequentialId } from "../utils/generateId.js";
import { asyncHandler, apiError, apiSuccess } from "../utils/apiResponse.js";

const createGatePassSchema = z.object({
  department: z.string().optional().default(""),
  partyOrVendorName: z.string().optional().default(""),
  vehicleNumber: z.string().optional().default(""),
  driverName: z.string().optional().default(""),
  driverMobile: z.string().optional().default(""),
  item: z.string().optional().nullable(),
  materialName: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().optional().default(""),
  purpose: z.string().optional().default(""),
  returnExpectedDate: z.string().optional(),
  conditionAtDispatch: z.string().optional().default(""),
  site: z.string().min(1),
  approvedBy: z.string().min(1, "Approved By is required"),
  remarks: z.string().optional().default(""),
});

const returnSchema = z.object({
  returnQuantity: z.number().min(0),
  receiverNameSignature: z.string().min(1),
  conditionAtReturn: z.string().optional().default(""),
  securityVerification: z.boolean().optional().default(true),
});

// POST /api/gate-passes — Admin or Store Keeper; approvedBy is mandatory
// before save (RA v2.0 Sec. 7, point 9).
export const createGatePass = asyncHandler(async (req, res) => {
  const parsed = createGatePassSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid gate pass payload", parsed.error.flatten());

  if ((req.user.role === "ADMIN" || req.user.role === "STORE_KEEPER") && String(parsed.data.site) !== String(req.user.site)) {
    return apiError(res, 403, "You can only raise a gate pass for your own site.");
  }

  const approver = await User.findById(parsed.data.approvedBy);
  if (!approver) return apiError(res, 404, "Approving user not found");

  const gatePassNumber = await generateSequentialId(GatePass, "gatePassNumber", "GP", 1000);
  const gatePass = await GatePass.create({
    ...parsed.data,
    gatePassNumber,
    returnExpectedDate: parsed.data.returnExpectedDate ? new Date(parsed.data.returnExpectedDate) : undefined,
    sentBy: req.user._id,
  });

  return apiSuccess(res, 201, gatePass, "Gate pass created");
});

// GET /api/gate-passes?site=&department=&materialReturned=
export const listGatePasses = asyncHandler(async (req, res) => {
  const { site, department, materialReturned } = req.query;
  const filter = {};

  if (site) filter.site = site;
  else if (req.user.role === "ADMIN" || req.user.role === "STORE_KEEPER") filter.site = req.user.site;

  if (department) filter.department = department;
  if (materialReturned !== undefined) filter.materialReturned = materialReturned === "true";

  const gatePasses = await GatePass.find(filter)
    .populate("item", "name itemCode")
    .populate("site", "name")
    .populate("sentBy", "name")
    .populate("approvedBy", "name")
    .populate("securityVerifiedBy", "name")
    .sort({ dateTime: -1 });

  return apiSuccess(res, 200, gatePasses);
});

// GET /api/gate-passes/:id
export const getGatePass = asyncHandler(async (req, res) => {
  const gatePass = await GatePass.findById(req.params.id)
    .populate("item")
    .populate("site", "name")
    .populate("sentBy", "name")
    .populate("approvedBy", "name")
    .populate("securityVerifiedBy", "name");
  if (!gatePass) return apiError(res, 404, "Gate pass not found");
  return apiSuccess(res, 200, gatePass);
});

// PATCH /api/gate-passes/:id/return — records the returnable material's
// actual return: return date, quantity, receiver signature, and security
// verification (RA v2.0 Sec. 7).
export const recordGatePassReturn = asyncHandler(async (req, res) => {
  const parsed = returnSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid return payload", parsed.error.flatten());

  const gatePass = await GatePass.findById(req.params.id);
  if (!gatePass) return apiError(res, 404, "Gate pass not found");

  if (gatePass.materialReturned) {
    return apiError(res, 400, "This gate pass has already been marked returned.");
  }

  gatePass.actualReturnDate = new Date();
  gatePass.returnQuantity = parsed.data.returnQuantity;
  gatePass.receiverNameSignature = parsed.data.receiverNameSignature;
  gatePass.conditionAtReturn = parsed.data.conditionAtReturn;
  gatePass.securityVerification = parsed.data.securityVerification;
  gatePass.securityVerifiedBy = req.user._id;
  gatePass.securityVerifiedAt = new Date();
  gatePass.materialReturned = true;
  await gatePass.save();

  return apiSuccess(res, 200, gatePass, "Gate pass return recorded");
});
