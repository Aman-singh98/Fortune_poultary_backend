import Stock from "../models/Stock.js";
import { getLowStockPositions } from "../services/stockService.js";
import { asyncHandler, apiSuccess } from "../utils/apiResponse.js";

// GET /api/stock?site=&item= — running balances per item per site
export const listStock = asyncHandler(async (req, res) => {
  const { site, item } = req.query;
  const filter = {};

  if (site) filter.site = site;
  else if (req.user.role === "ADMIN" || req.user.role === "STORE_KEEPER") filter.site = req.user.site;

  if (item) filter.item = item;

  const stock = await Stock.find(filter)
    .populate("item", "name itemCode unit reorderLevel minStockLevel maxStockLevel")
    .populate("site", "name")
    .sort({ updatedAt: -1 });

  return apiSuccess(res, 200, stock);
});

// GET /api/stock/low?site= — reorder-level alerts feeding the dashboard
// (RA v1.0 OP-6: dashboard indicator only, no email/SMS alerting).
export const listLowStock = asyncHandler(async (req, res) => {
  let site = req.query.site || null;
  if (!site && (req.user.role === "ADMIN" || req.user.role === "STORE_KEEPER")) {
    site = req.user.site;
  }

  const positions = await getLowStockPositions(site);
  return apiSuccess(res, 200, positions);
});
