import { z } from "zod";
import Bill from "../models/Bill.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import GoodsReceipt from "../models/GoodsReceipt.js";
import { asyncHandler, apiError, apiSuccess } from "../utils/apiResponse.js";

const createBillSchema = z.object({
  poRef: z.string().min(1),
  grnRef: z.string().optional().nullable(),
  billNumber: z.string().min(1),
  invoiceDate: z.string().min(1),
  irn: z.string().optional().default(""),
  amount: z.number().min(0),
});

// POST /api/bills — Accounts records a vendor's bill against a PO
export const createBill = asyncHandler(async (req, res) => {
  const parsed = createBillSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid bill payload", parsed.error.flatten());

  const po = await PurchaseOrder.findById(parsed.data.poRef);
  if (!po) return apiError(res, 404, "Purchase order not found");

  if (parsed.data.grnRef) {
    const grn = await GoodsReceipt.findById(parsed.data.grnRef);
    if (!grn) return apiError(res, 404, "Goods receipt not found");
  }

  const bill = await Bill.create({
    ...parsed.data,
    invoiceDate: new Date(parsed.data.invoiceDate),
    vendor: po.vendor,
    recordedBy: req.user._id,
  });

  return apiSuccess(res, 201, bill, "Bill recorded");
});

// GET /api/bills?poRef=&vendor=&matchStatus=
export const listBills = asyncHandler(async (req, res) => {
  const { poRef, vendor, matchStatus } = req.query;
  const filter = {};
  if (poRef) filter.poRef = poRef;
  if (vendor) filter.vendor = vendor;
  if (matchStatus) filter.matchStatus = matchStatus;

  const bills = await Bill.find(filter)
    .populate("poRef", "poNumber totalAmount quantity rate")
    .populate("grnRef", "grnNumber acceptedQuantity")
    .populate("vendor", "name vendorCode")
    .populate("recordedBy", "name")
    .sort({ createdAt: -1 });

  return apiSuccess(res, 200, bills);
});

// GET /api/bills/:id
export const getBill = asyncHandler(async (req, res) => {
  const bill = await Bill.findById(req.params.id)
    .populate("poRef")
    .populate("grnRef")
    .populate("vendor")
    .populate("recordedBy", "name");
  if (!bill) return apiError(res, 404, "Bill not found");
  return apiSuccess(res, 200, bill);
});

// PATCH /api/bills/:id/match — runs the 3-way match: PO qty/rate vs GRN
// accepted qty vs Bill amount (RA v2.0 Sec. 8, point 8).
export const matchBill = asyncHandler(async (req, res) => {
  const bill = await Bill.findById(req.params.id).populate("poRef");
  if (!bill) return apiError(res, 404, "Bill not found");

  const po = bill.poRef;
  if (!po) return apiError(res, 400, "This bill's purchase order could not be found.");

  const grn = bill.grnRef
    ? await GoodsReceipt.findById(bill.grnRef)
    : await GoodsReceipt.findOne({ poRef: po._id }).sort({ createdAt: -1 });

  const notes = [];
  let isMatch = true;

  if (!grn) {
    isMatch = false;
    notes.push("No goods receipt found against this purchase order.");
  } else if (grn.acceptedQuantity !== po.quantity) {
    isMatch = false;
    notes.push(`GRN accepted quantity (${grn.acceptedQuantity}) does not match PO quantity (${po.quantity}).`);
  }

  const expectedAmount = po.totalAmount;
  const amountDiff = Math.abs(bill.amount - expectedAmount);
  if (amountDiff > 1) {
    isMatch = false;
    notes.push(`Bill amount (₹${bill.amount}) differs from PO total (₹${expectedAmount}) by ₹${amountDiff.toFixed(2)}.`);
  }

  bill.matchStatus = isMatch ? "MATCHED" : "MISMATCH";
  bill.matchNotes = notes.join(" ") || "PO, GRN and bill amount are in agreement.";

  if (!bill.grnRef && grn) {
    bill.grnRef = grn._id;
  }

  await bill.save();
  return apiSuccess(res, 200, bill, `Bill ${bill.matchStatus.toLowerCase()}`);
});
