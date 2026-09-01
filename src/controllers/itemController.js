import { z } from "zod";
import Item from "../models/Item.js";
import { generateSequentialId } from "../utils/generateId.js";
import { getLowStockPositions } from "../services/stockService.js";
import { asyncHandler, apiError, apiSuccess } from "../utils/apiResponse.js";

const createItemSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional().default(""),
  subCategory: z.string().optional().default(""),
  unit: z.string().min(1),
  minStockLevel: z.number().min(0).optional().default(0),
  reorderLevel: z.number().min(0).optional().default(0),
  maxStockLevel: z.number().min(0).optional().default(0),
  preferredVendor: z.string().optional().nullable().default(null),
  standardRate: z.number().min(0).optional().default(0),
  gstPercent: z.number().min(0).max(100).optional().default(0),
  hsnCode: z.string().optional().default(""),
});

const updateItemSchema = createItemSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// POST /api/items — Super Admin, Management
export const createItem = asyncHandler(async (req, res) => {
  const parsed = createItemSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid item payload", parsed.error.flatten());

  const itemCode = await generateSequentialId(Item, "itemCode", "ITM", 1000);
  const item = await Item.create({ ...parsed.data, itemCode });
  return apiSuccess(res, 201, item, "Item created");
});

// GET /api/items?lowStock=true&category=&site=&isActive=
// lowStock=true feeds the dashboard reorder-level indicator (RA v1.0 OP-6).
export const listItems = asyncHandler(async (req, res) => {
  const { lowStock, category, isActive } = req.query;

  if (lowStock === "true") {
    const positions = await getLowStockPositions(req.query.site || null);
    return apiSuccess(res, 200, positions);
  }

  const filter = {};
  if (category) filter.category = category;
  if (isActive !== undefined) filter.isActive = isActive === "true";

  const items = await Item.find(filter).populate("preferredVendor", "name vendorCode").sort({ name: 1 });
  return apiSuccess(res, 200, items);
});

// GET /api/items/:id
export const getItem = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id).populate("preferredVendor", "name vendorCode");
  if (!item) return apiError(res, 404, "Item not found");
  return apiSuccess(res, 200, item);
});

// PUT /api/items/:id — Super Admin, Management
export const updateItem = asyncHandler(async (req, res) => {
  const parsed = updateItemSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid item payload", parsed.error.flatten());

  const item = await Item.findByIdAndUpdate(req.params.id, parsed.data, { new: true, runValidators: true });
  if (!item) return apiError(res, 404, "Item not found");
  return apiSuccess(res, 200, item, "Item updated");
});
