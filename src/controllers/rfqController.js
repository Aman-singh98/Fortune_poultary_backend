import { z } from "zod";
import Rfq from "../models/Rfq.js";
import Vendor from "../models/Vendor.js";
import { generateSequentialId } from "../utils/generateId.js";
import { assertRequisitionApproved } from "../services/purchaseFlowService.js";
import { asyncHandler, apiError, apiSuccess } from "../utils/apiResponse.js";

const lineItemSchema = z.object({
  item: z.string().min(1),
  quantity: z.number().positive(),
});

const createRfqSchema = z.object({
  prRef: z.string().min(1),
  vendor: z.string().min(1),
  items: z.array(lineItemSchema).min(1),
  expectedDeliveryDate: z.string().optional(),
  quotationDueDate: z.string().optional(),
  termsAndConditions: z.string().optional().default(""),
});

// POST /api/rfqs — Purchase Manager, referencing an approved Purchase
// Requisition only (RA v2.0 Sec. 8, point 3).
export const createRfq = asyncHandler(async (req, res) => {
  const parsed = createRfqSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid RFQ payload", parsed.error.flatten());

  try {
    await assertRequisitionApproved(parsed.data.prRef);
  } catch (err) {
    return apiError(res, err.statusCode || 400, err.message);
  }

  const vendor = await Vendor.findById(parsed.data.vendor);
  if (!vendor) return apiError(res, 404, "Vendor not found");

  const rfqNumber = await generateSequentialId(Rfq, "rfqNumber", "RFQ", 1000);
  const rfq = await Rfq.create({
    ...parsed.data,
    rfqNumber,
    expectedDeliveryDate: parsed.data.expectedDeliveryDate ? new Date(parsed.data.expectedDeliveryDate) : undefined,
    quotationDueDate: parsed.data.quotationDueDate ? new Date(parsed.data.quotationDueDate) : undefined,
    createdBy: req.user._id,
  });

  return apiSuccess(res, 201, rfq, "RFQ created");
});

// GET /api/rfqs?prRef=&vendor=&status=
export const listRfqs = asyncHandler(async (req, res) => {
  const { prRef, vendor, status } = req.query;
  const filter = {};
  if (prRef) filter.prRef = prRef;
  if (vendor) filter.vendor = vendor;
  if (status) filter.status = status;

  const rfqs = await Rfq.find(filter)
    .populate("prRef", "prNumber item quantity")
    .populate("vendor", "name vendorCode")
    .populate("items.item", "name itemCode unit")
    .populate("createdBy", "name")
    .sort({ createdAt: -1 });

  return apiSuccess(res, 200, rfqs);
});

// GET /api/rfqs/:id
export const getRfq = asyncHandler(async (req, res) => {
  const rfq = await Rfq.findById(req.params.id)
    .populate("prRef")
    .populate("vendor")
    .populate("items.item", "name itemCode unit")
    .populate("createdBy", "name");
  if (!rfq) return apiError(res, 404, "RFQ not found");
  return apiSuccess(res, 200, rfq);
});

// PATCH /api/rfqs/:id/close — Purchase Manager closes an RFQ once quotations are in
export const closeRfq = asyncHandler(async (req, res) => {
  const rfq = await Rfq.findById(req.params.id);
  if (!rfq) return apiError(res, 404, "RFQ not found");

  rfq.status = "CLOSED";
  await rfq.save();
  return apiSuccess(res, 200, rfq, "RFQ closed");
});
