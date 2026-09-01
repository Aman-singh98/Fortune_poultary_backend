/**
 * Final Landed Cost = rate + GST + freight + other charges − discount, per
 * quantity ordered. All components are considered, per client's confirmation
 * (RA v2.0 Sec. 8, point 5). Shared by the Quotation and PurchaseOrder
 * controllers so the formula only lives in one place.
 *
 * `gst` here is treated as an amount (already computed from item.gstPercent
 * x rate x quantity by the caller), not a percentage — keeps this function a
 * plain sum and keeps percent-vs-amount conversion logic in one call site.
 */
export function calculateLandedCost({ rate, quantity = 1, gst = 0, freight = 0, otherCharges = 0, discount = 0 }) {
  const base = round2(rate * quantity);
  const total = round2(base + gst + freight + otherCharges - discount);
  return Math.max(total, 0);
}

/**
 * Converts a GST percentage (e.g. an Item's gstPercent, or a rate quoted
 * inclusive of a known GST slab) into a GST amount for a given line value.
 */
export function gstAmountFromPercent(rate, quantity, gstPercent) {
  return round2(rate * quantity * (gstPercent / 100));
}

/**
 * Given a list of quotations (plain objects or Mongoose docs) for the same
 * RFQ/item, flags the one with the lowest finalLandedCost as isLowestRate
 * and clears the flag on every other one. Returns the same array, mutated,
 * so the caller can bulk-save it.
 *
 * Used by the Quotation Comparison screen (RA v2.0 Sec. 8, point 5 — the
 * client called this comparison "very important").
 */
export function flagLowestRate(quotations) {
  if (!quotations.length) return quotations;

  const lowest = quotations.reduce((min, q) =>
    q.finalLandedCost < min.finalLandedCost ? q : min
  , quotations[0]);

  for (const q of quotations) {
    q.isLowestRate = q === lowest;
  }
  return quotations;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
