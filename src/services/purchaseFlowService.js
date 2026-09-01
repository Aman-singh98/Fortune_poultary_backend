import ItemRequirement from "../models/ItemRequirement.js";
import PurchaseRequisition from "../models/PurchaseRequisition.js";
import Quotation from "../models/Quotation.js";
import ItemIssueSlip from "../models/ItemIssueSlip.js";
import { generateSequentialId } from "../utils/generateId.js";
import { decreaseStock } from "./stockService.js";

function makeError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

// Minimum competing quotations required before any one can be marked
// selected (RA v2.0 Sec. 8, point 4).
export const MINIMUM_QUOTATIONS_REQUIRED = 3;

/**
 * Updates an Item Requirement's fulfilment tracking after an Item Issue Slip
 * is created against it, and derives PENDING / PARTIAL / FULFILLED status.
 * Does not save Stock — that's stockService's job; this only updates the
 * ItemRequirement bookkeeping. Returns the updated document.
 */
export async function recordIssueAgainstRequirement(requirementId, issuedQuantity) {
  const requirement = await ItemRequirement.findById(requirementId);
  if (!requirement) {
    throw makeError("Item Requirement not found", 404);
  }

  requirement.quantityIssued = (requirement.quantityIssued || 0) + issuedQuantity;

  if (requirement.quantityIssued >= requirement.quantity) {
    requirement.status = "FULFILLED";
  } else if (requirement.quantityIssued > 0) {
    requirement.status = "PARTIAL";
  }

  await requirement.save();
  return requirement;
}

/**
 * Single place that performs an actual stock issue against an Item
 * Requirement: decrements Stock, creates the ItemIssueSlip record, and
 * updates the requirement's fulfilment bookkeeping. Shared by the Item
 * Requirement "availability check" (Path A — issue immediately) and the
 * standalone Item Issue Slip controller, so the logic only lives once.
 *
 * `requirement` must be a full ItemRequirement Mongoose document (not just
 * an id) so we can read its item/site and re-save it via
 * recordIssueAgainstRequirement. Throws (400/404) if the quantity requested
 * exceeds what's left on the requirement, or if stock is insufficient.
 */
export async function issueAgainstRequirement({ requirement, quantity, issuedBy, issuedTo }) {
  if (!requirement) {
    throw makeError("Item Requirement not found", 404);
  }
  if (quantity <= 0) {
    throw makeError("Issue quantity must be greater than 0", 400);
  }

  const remaining = requirement.quantity - (requirement.quantityIssued || 0);
  if (quantity > remaining) {
    throw makeError(
      `Cannot issue ${quantity}; only ${remaining} remaining against this requirement.`,
      400
    );
  }

  // Throws if there isn't enough on-hand stock — caller decides what that
  // means (e.g. the Path B purchase-requisition route).
  await decreaseStock(requirement.item, requirement.site, quantity);

  const issueSlipNumber = await generateSequentialId(ItemIssueSlip, "issueSlipNumber", "ISS", 1000);
  const issueSlip = await ItemIssueSlip.create({
    issueSlipNumber,
    requirementRef: requirement._id,
    item: requirement.item,
    quantity,
    site: requirement.site,
    issuedBy,
    issuedTo: issuedTo || requirement.department,
  });

  const updatedRequirement = await recordIssueAgainstRequirement(requirement._id, quantity);
  return { issueSlip, requirement: updatedRequirement };
}

/**
 * Guards RFQ creation: a Purchase Manager may only raise an RFQ against an
 * already-approved Purchase Requisition (RA v2.0 Sec. 8, point 3). Throws a
 * 400 if the PR isn't found or isn't approved; otherwise returns the PR doc.
 */
export async function assertRequisitionApproved(prId) {
  const pr = await PurchaseRequisition.findById(prId);
  if (!pr) {
    throw makeError("Purchase Requisition not found", 404);
  }
  if (pr.status !== "APPROVED") {
    throw makeError(
      "An RFQ can only be raised against an approved Purchase Requisition.",
      400
    );
  }
  return pr;
}

/**
 * Guards vendor selection: refuses to mark a quotation `selected` until at
 * least MINIMUM_QUOTATIONS_REQUIRED quotations exist for the same RFQ + item
 * (RA v2.0 Sec. 8, point 4).
 */
export async function assertMinimumQuotations(rfqId, itemId) {
  const count = await Quotation.countDocuments({ rfqRef: rfqId, item: itemId });
  if (count < MINIMUM_QUOTATIONS_REQUIRED) {
    throw makeError(
      `At least ${MINIMUM_QUOTATIONS_REQUIRED} quotations are required for this item before a vendor can be selected (currently ${count}).`,
      400
    );
  }
  return count;
}
