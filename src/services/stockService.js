import Stock from "../models/Stock.js";

function makeError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/**
 * Increases the running stock balance for an item at a site, creating the
 * Stock document on first receipt if it doesn't exist yet. Called from
 * GoodsReceipt (on Store Keeper acceptance) — the only point where stock
 * increases (RA v2.0 Sec. 2/3, and OP-1 from v1.0).
 */
export async function increaseStock(itemId, siteId, quantity) {
  if (quantity < 0) {
    throw makeError("increaseStock quantity must be >= 0", 400);
  }
  if (quantity === 0) {
    return Stock.findOne({ item: itemId, site: siteId });
  }

  return Stock.findOneAndUpdate(
    { item: itemId, site: siteId },
    { $inc: { quantity } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

/**
 * Decreases the running stock balance for an item at a site — called from
 * ItemIssueSlip creation. Refuses to go negative; the caller (controller)
 * decides what that means for the requesting Item Requirement (e.g. partial
 * issue, per RA v2.0 Sec. 8 / OP-5 pattern).
 */
export async function decreaseStock(itemId, siteId, quantity) {
  if (quantity <= 0) {
    throw makeError("decreaseStock quantity must be > 0", 400);
  }

  const stock = await Stock.findOne({ item: itemId, site: siteId });
  const available = stock ? stock.quantity : 0;

  if (quantity > available) {
    throw makeError(
      `Cannot issue ${quantity}; only ${available} in stock for this item at this site.`,
      400
    );
  }

  stock.quantity -= quantity;
  await stock.save();
  return stock;
}

/**
 * Returns the current on-hand quantity for an item at a site (0 if no Stock
 * document exists yet — i.e. never received).
 */
export async function getAvailableQuantity(itemId, siteId) {
  const stock = await Stock.findOne({ item: itemId, site: siteId });
  return stock ? stock.quantity : 0;
}

/**
 * Items whose stock at a site (or across all sites, if siteId omitted) is at
 * or below their reorder level — feeds the dashboard low-stock widget
 * (RA v1.0 OP-6: dashboard indicator only, no email/SMS alerting).
 */
export async function getLowStockPositions(siteId = null) {
  const match = siteId ? { site: siteId } : {};
  const positions = await Stock.find(match).populate("item").populate("site");

  return positions.filter(
    (pos) => pos.item && pos.quantity <= (pos.item.reorderLevel ?? 0)
  );
}
