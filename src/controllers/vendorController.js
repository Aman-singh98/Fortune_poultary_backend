import { z } from "zod";
import Vendor from "../models/Vendor.js";
import { generateSequentialId } from "../utils/generateId.js";
import { asyncHandler, apiError, apiSuccess } from "../utils/apiResponse.js";

const bankDetailsSchema = z.object({
  accountName: z.string().optional().default(""),
  accountNumber: z.string().optional().default(""),
  ifsc: z.string().optional().default(""),
  bankName: z.string().optional().default(""),
});

const createVendorSchema = z.object({
  name: z.string().min(1),
  contactPerson: z.string().optional().default(""),
  mobile: z.string().optional().default(""),
  email: z.string().optional().default(""),
  address: z.string().optional().default(""),
  gstNumber: z.string().optional().default(""),
  pan: z.string().optional().default(""),
  bankDetails: bankDetailsSchema.optional(),
  paymentTerms: z.string().optional().default(""),
  creditDays: z.number().min(0).optional().default(0),
  category: z.string().optional().default(""),
});

const updateVendorSchema = createVendorSchema.partial();

// POST /api/vendors — Super Admin, Management
export const createVendor = asyncHandler(async (req, res) => {
  const parsed = createVendorSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid vendor payload", parsed.error.flatten());

  const vendorCode = await generateSequentialId(Vendor, "vendorCode", "VEN", 1000);
  const vendor = await Vendor.create({ ...parsed.data, vendorCode });
  return apiSuccess(res, 201, vendor, "Vendor created");
});

// GET /api/vendors?category=&isActive=
export const listVendors = asyncHandler(async (req, res) => {
  const { category, isActive } = req.query;
  const filter = {};
  if (category) filter.category = category;
  if (isActive !== undefined) filter.isActive = isActive === "true";

  const vendors = await Vendor.find(filter).sort({ name: 1 });
  return apiSuccess(res, 200, vendors);
});

// GET /api/vendors/:id
export const getVendor = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) return apiError(res, 404, "Vendor not found");
  return apiSuccess(res, 200, vendor);
});

// PUT /api/vendors/:id — Super Admin, Management
export const updateVendor = asyncHandler(async (req, res) => {
  const parsed = updateVendorSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid vendor payload", parsed.error.flatten());

  const vendor = await Vendor.findByIdAndUpdate(req.params.id, parsed.data, { new: true, runValidators: true });
  if (!vendor) return apiError(res, 404, "Vendor not found");
  return apiSuccess(res, 200, vendor, "Vendor updated");
});

// PATCH /api/vendors/:id/toggle-active — Super Admin, Management
export const toggleVendorActive = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) return apiError(res, 404, "Vendor not found");

  vendor.isActive = !vendor.isActive;
  await vendor.save();
  return apiSuccess(res, 200, vendor, `Vendor ${vendor.isActive ? "activated" : "deactivated"}`);
});
