import { z } from "zod";
import Quotation from "../models/Quotation.js";
import Rfq from "../models/Rfq.js";
import { calculateLandedCost, flagLowestRate } from "../services/landedCostService.js";
import { assertMinimumQuotations, MINIMUM_QUOTATIONS_REQUIRED } from "../services/purchaseFlowService.js";
import { asyncHandler, apiError, apiSuccess } from "../utils/apiResponse.js";

const createQuotationSchema = z.object({
  rfqRef: z.string().min(1),
  vendor: z.string().min(1),
  item: z.string().min(1),
  quantity: z.number().positive(),
  rate: z.number().min(0),
  gst: z.number().min(0).optional().default(0),
  freight: z.number().min(0).optional().default(0),
  discount: z.number().min(0).optional().default(0),
  otherCharges: z.number().min(0).optional().default(0),
  paymentTerms: z.string().optional().default(""),
  deliveryTime: z.string().optional().default(""),
  qualitySpecification: z.string().optional().default(""),
});

const decisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  reasonForSelection: z.string().optional().default(""),
});

// Recomputes the isLowestRate flag across every quotation for the same
// RFQ + item, so the comparison screen always reflects the current cheapest
// vendor (RA v2.0 Sec. 8, point 5).
async function recomputeLowestRate(rfqRef, item) {
  const siblings = await Quotation.find({ rfqRef, item });
  flagLowestRate(siblings);
  await Promise.all(siblings.map((q) => q.save()));
}

// POST /api/quotations — Purchase Manager logs a vendor's quotation against an RFQ
export const createQuotation = asyncHandler(async (req, res) => {
  const parsed = createQuotationSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid quotation payload", parsed.error.flatten());

  const rfq = await Rfq.findById(parsed.data.rfqRef);
  if (!rfq) return apiError(res, 404, "RFQ not found");

  const finalLandedCost = calculateLandedCost(parsed.data);

  let quotation;
  try {
    quotation = await Quotation.create({
      ...parsed.data,
      finalLandedCost,
      createdBy: req.user._id,
    });
  } catch (err) {
    if (err.code === 11000) {
      return apiError(res, 409, "This vendor has already quoted for this item on this RFQ.");
    }
    throw err;
  }

  await recomputeLowestRate(quotation.rfqRef, quotation.item);
  const saved = await Quotation.findById(quotation._id).populate("vendor", "name vendorCode").populate("item", "name itemCode unit");
  return apiSuccess(res, 201, saved, "Quotation recorded");
});

// GET /api/quotations?rfqRef=&item=&vendor=
export const listQuotations = asyncHandler(async (req, res) => {
  const { rfqRef, item, vendor } = req.query;
  const filter = {};
  if (rfqRef) filter.rfqRef = rfqRef;
  if (item) filter.item = item;
  if (vendor) filter.vendor = vendor;

  const quotations = await Quotation.find(filter)
    .populate("vendor", "name vendorCode")
    .populate("item", "name itemCode unit")
    .populate("createdBy", "name")
    .sort({ finalLandedCost: 1 });

  return apiSuccess(res, 200, quotations);
});

// GET /api/quotations/comparison/:rfqId?item= — side-by-side comparison
// feeding the Quotation Comparison screen, the page the client called
// "very important" (RA v2.0 Sec. 8, point 5).
export const compareQuotations = asyncHandler(async (req, res) => {
  const { rfqId } = req.params;
  const { item } = req.query;

  const filter = { rfqRef: rfqId };
  if (item) filter.item = item;

  const quotations = await Quotation.find(filter)
    .populate("vendor", "name vendorCode")
    .populate("item", "name itemCode unit")
    .sort({ finalLandedCost: 1 });

  const selected = quotations.find((q) => q.selected) || null;

  return apiSuccess(res, 200, {
    rfqId,
    minimumRequired: MINIMUM_QUOTATIONS_REQUIRED,
    count: quotations.length,
    canSelect: quotations.length >= MINIMUM_QUOTATIONS_REQUIRED,
    quotations,
    recommendedVendor: quotations[0]?.vendor || null,
    selectedVendor: selected?.vendor || null,
  });
});

// GET /api/quotations/:id
export const getQuotation = asyncHandler(async (req, res) => {
  const quotation = await Quotation.findById(req.params.id).populate("vendor").populate("item").populate("rfqRef");
  if (!quotation) return apiError(res, 404, "Quotation not found");
  return apiSuccess(res, 200, quotation);
});

// PATCH /api/quotations/:id/decision — Management's vendor-selection approval
// gate. Refuses to select until at least MINIMUM_QUOTATIONS_REQUIRED
// quotations exist for the RFQ/item (RA v2.0 Sec. 8, point 4).
export const decideQuotation = asyncHandler(async (req, res) => {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid decision payload", parsed.error.flatten());

  const quotation = await Quotation.findById(req.params.id);
  if (!quotation) return apiError(res, 404, "Quotation not found");

  if (parsed.data.decision === "APPROVED") {
    try {
      await assertMinimumQuotations(quotation.rfqRef, quotation.item);
    } catch (err) {
      return apiError(res, err.statusCode || 400, err.message);
    }

    await Quotation.updateMany(
      { rfqRef: quotation.rfqRef, item: quotation.item, _id: { $ne: quotation._id } },
      { $set: { selected: false } }
    );
    quotation.selected = true;
    quotation.reasonForSelection = parsed.data.reasonForSelection;
  } else {
    quotation.selected = false;
    quotation.reasonForSelection = parsed.data.reasonForSelection;
  }

  await quotation.save();
  return apiSuccess(
    res,
    200,
    quotation,
    `Quotation ${parsed.data.decision === "APPROVED" ? "selected" : "not selected"}`
  );
});
