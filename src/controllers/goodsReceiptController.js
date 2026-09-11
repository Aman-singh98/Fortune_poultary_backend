import { z } from "zod";
import GoodsReceipt from "../models/GoodsReceipt.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import { generateSequentialId } from "../utils/generateId.js";
import { increaseStock } from "../services/stockService.js";
import { asyncHandler, apiError, apiSuccess } from "../utils/apiResponse.js";

const createGrnSchema = z.object({
  poRef: z.string().min(1),
  site: z.string().min(1),
  vehicleNumber: z.string().optional().default(""),
  invoiceNumber: z.string().optional().default(""),
  receivedQuantity: z.number().min(0),
  batchLotNumber: z.string().optional().default(""),
  storeLocation: z.string().optional().default(""),
  acceptedQuantity: z.number().min(0).optional().default(0),
  rejectedQuantity: z.number().min(0).optional().default(0),
  qualityStatus: z.enum(["PENDING", "PASSED", "FAILED"]).optional().default("PENDING"),
});

const verifySchema = z.object({
  acceptedQuantity: z.number().min(0),
  rejectedQuantity: z.number().min(0),
  batchLotNumber: z.string().optional().default(""),
  storeLocation: z.string().optional().default(""),
  qualityStatus: z.enum(["PENDING", "PASSED", "FAILED"]).optional().default("PASSED"),
});

// POST /api/goods-receipts — Store Keeper (verifies on the spot) or Accounts
// (logs the vehicle/invoice arrival only). Accepted/rejected quantities are
// only ever set by a Store Keeper (RA v2.0 Sec. 8, point 7) — an Accounts-
// created record leaves them at 0/PENDING until PATCH /:id/verify.
export const createGoodsReceipt = asyncHandler(async (req, res) => {
  const parsed = createGrnSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid goods receipt payload", parsed.error.flatten());

  const po = await PurchaseOrder.findById(parsed.data.poRef);
  if (!po) return apiError(res, 404, "Purchase order not found");

  const isStoreKeeper = req.user.role === "STORE_KEEPER" || req.user.role === "SUPER_ADMIN";
  let acceptedQuantity = 0;
  let rejectedQuantity = 0;
  let qualityStatus = "PENDING";
  let verifiedBy = null;

  if (isStoreKeeper) {
    if (parsed.data.acceptedQuantity + parsed.data.rejectedQuantity > parsed.data.receivedQuantity) {
      return apiError(res, 400, "Accepted + rejected quantity cannot exceed received quantity.");
    }
    acceptedQuantity = parsed.data.acceptedQuantity;
    rejectedQuantity = parsed.data.rejectedQuantity;
    qualityStatus = parsed.data.qualityStatus;
    verifiedBy = req.user._id;
  }

  const grnNumber = await generateSequentialId(GoodsReceipt, "grnNumber", "GRN", 1000);
  const grn = await GoodsReceipt.create({
    grnNumber,
    poRef: po._id,
    vendor: po.vendor,
    site: parsed.data.site,
    vehicleNumber: parsed.data.vehicleNumber,
    invoiceNumber: parsed.data.invoiceNumber,
    item: po.item,
    orderedQuantity: po.quantity,
    receivedQuantity: parsed.data.receivedQuantity,
    acceptedQuantity,
    rejectedQuantity,
    shortExcessQuantity: parsed.data.receivedQuantity - po.quantity,
    batchLotNumber: parsed.data.batchLotNumber,
    qualityStatus,
    storeLocation: parsed.data.storeLocation,
    verifiedBy,
  });

  if (acceptedQuantity > 0) {
    await increaseStock(po.item, parsed.data.site, acceptedQuantity);
  }

  return apiSuccess(res, 201, grn, "Goods receipt recorded");
});

// PATCH /api/goods-receipts/:id/verify — Store Keeper confirms accepted/
// rejected quantities for a GRN Accounts logged without them, and
// increments Stock accordingly (RA v2.0 Sec. 8, point 7).
export const verifyGoodsReceipt = asyncHandler(async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid verification payload", parsed.error.flatten());

  const grn = await GoodsReceipt.findById(req.params.id);
  if (!grn) return apiError(res, 404, "Goods receipt not found");

  if (grn.verifiedBy) {
    return apiError(res, 400, "This goods receipt has already been verified.");
  }

  if (parsed.data.acceptedQuantity + parsed.data.rejectedQuantity > grn.receivedQuantity) {
    return apiError(res, 400, "Accepted + rejected quantity cannot exceed received quantity.");
  }

  grn.acceptedQuantity = parsed.data.acceptedQuantity;
  grn.rejectedQuantity = parsed.data.rejectedQuantity;
  grn.batchLotNumber = parsed.data.batchLotNumber || grn.batchLotNumber;
  grn.storeLocation = parsed.data.storeLocation || grn.storeLocation;
  grn.qualityStatus = parsed.data.qualityStatus;
  grn.verifiedBy = req.user._id;
  await grn.save();

  if (grn.acceptedQuantity > 0) {
    await increaseStock(grn.item, grn.site, grn.acceptedQuantity);
  }

  return apiSuccess(res, 200, grn, "Goods receipt verified and stock updated");
});

// GET /api/goods-receipts?poRef=&site=&vendor=
export const listGoodsReceipts = asyncHandler(async (req, res) => {
  const { poRef, site, vendor } = req.query;
  const filter = {};
  if (poRef) filter.poRef = poRef;
  if (site) filter.site = site;
  else if (req.user.role === "STORE_KEEPER") filter.site = req.user.site;
  if (vendor) filter.vendor = vendor;

  const receipts = await GoodsReceipt.find(filter)
    .populate("poRef", "poNumber")
    .populate("vendor", "name vendorCode")
    .populate("item", "name itemCode unit")
    .populate("site", "name")
    .populate("verifiedBy", "name")
    .sort({ createdAt: -1 });

  return apiSuccess(res, 200, receipts);
});

// GET /api/goods-receipts/:id
export const getGoodsReceipt = asyncHandler(async (req, res) => {
  const grn = await GoodsReceipt.findById(req.params.id)
    .populate("poRef")
    .populate("vendor")
    .populate("item")
    .populate("site", "name")
    .populate("verifiedBy", "name");
  if (!grn) return apiError(res, 404, "Goods receipt not found");
  return apiSuccess(res, 200, grn);
});
