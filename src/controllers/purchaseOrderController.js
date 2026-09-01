import { z } from "zod";
import PurchaseOrder from "../models/PurchaseOrder.js";
import Quotation from "../models/Quotation.js";
import Item from "../models/Item.js";
import { generateSequentialId } from "../utils/generateId.js";
import { calculateLandedCost } from "../services/landedCostService.js";
import { asyncHandler, apiError, apiSuccess } from "../utils/apiResponse.js";

const createPoSchema = z.object({
  quotationRef: z.string().min(1),
  deliveryLocation: z.string().optional().default(""),
  deliveryDate: z.string().optional(),
  paymentTerms: z.string().optional().default(""),
  specialInstructions: z.string().optional().default(""),
  hsnCode: z.string().optional(),
});

// POST /api/purchase-orders — Accounts, built only from a Management-approved
// (selected) quotation. Default: no separate PO approval gate (RA v2.0 Sec.
// 9 / OP-7) unless the client confirms otherwise.
export const createPurchaseOrder = asyncHandler(async (req, res) => {
  const parsed = createPoSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid purchase order payload", parsed.error.flatten());

  const quotation = await Quotation.findById(parsed.data.quotationRef).populate("rfqRef");
  if (!quotation) return apiError(res, 404, "Quotation not found");
  if (!quotation.selected) {
    return apiError(res, 400, "A Purchase Order can only be raised from a Management-approved (selected) quotation.");
  }

  const rfq = quotation.rfqRef;
  if (!rfq) return apiError(res, 400, "The RFQ behind this quotation could not be found.");

  const item = await Item.findById(quotation.item);

  const totalAmount = calculateLandedCost({
    rate: quotation.rate,
    quantity: quotation.quantity,
    gst: quotation.gst,
    freight: quotation.freight,
    otherCharges: quotation.otherCharges,
    discount: quotation.discount,
  });

  const poNumber = await generateSequentialId(PurchaseOrder, "poNumber", "PO", 1000);
  const po = await PurchaseOrder.create({
    poNumber,
    vendor: quotation.vendor,
    prRef: rfq.prRef,
    quotationRef: quotation._id,
    item: quotation.item,
    quantity: quotation.quantity,
    rate: quotation.rate,
    discount: quotation.discount,
    gst: quotation.gst,
    hsnCode: parsed.data.hsnCode || item?.hsnCode || "",
    freight: quotation.freight,
    otherCharges: quotation.otherCharges,
    totalAmount,
    deliveryLocation: parsed.data.deliveryLocation,
    deliveryDate: parsed.data.deliveryDate ? new Date(parsed.data.deliveryDate) : undefined,
    paymentTerms: parsed.data.paymentTerms || quotation.paymentTerms,
    specialInstructions: parsed.data.specialInstructions,
    createdBy: req.user._id,
  });

  return apiSuccess(res, 201, po, "Purchase order created");
});

// GET /api/purchase-orders?status=&vendor=&prRef=
// Open to Accounts (edit) and Purchase Manager (view-only) — read-only
// access is enforced simply by not authorizing the write routes below for
// Purchase Manager, rather than hiding buttons in the UI.
export const listPurchaseOrders = asyncHandler(async (req, res) => {
  const { status, vendor, prRef } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (vendor) filter.vendor = vendor;
  if (prRef) filter.prRef = prRef;

  const orders = await PurchaseOrder.find(filter)
    .populate("vendor", "name vendorCode")
    .populate("item", "name itemCode unit")
    .populate("prRef", "prNumber")
    .populate("createdBy", "name")
    .sort({ createdAt: -1 });

  return apiSuccess(res, 200, orders);
});

// GET /api/purchase-orders/:id
export const getPurchaseOrder = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findById(req.params.id)
    .populate("vendor")
    .populate("item")
    .populate("prRef")
    .populate("quotationRef")
    .populate("createdBy", "name");
  if (!po) return apiError(res, 404, "Purchase order not found");
  return apiSuccess(res, 200, po);
});

// PATCH /api/purchase-orders/:id/close — Accounts only
export const closePurchaseOrder = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po) return apiError(res, 404, "Purchase order not found");

  po.status = "CLOSED";
  await po.save();
  return apiSuccess(res, 200, po, "Purchase order closed");
});
