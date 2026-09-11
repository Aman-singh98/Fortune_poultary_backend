import { z } from "zod";
import ItemRequirement from "../models/ItemRequirement.js";
import Item from "../models/Item.js";
import ItemIssueSlip from "../models/ItemIssueSlip.js";
import PurchaseRequisition from "../models/PurchaseRequisition.js";
import { getAvailableQuantity, decreaseStock } from "../services/stockService.js";
import { recordIssueAgainstRequirement } from "../services/purchaseFlowService.js";
import { generateSequentialId } from "../utils/generateId.js";
import { asyncHandler, apiError, apiSuccess } from "../utils/apiResponse.js";

const createRequirementSchema = z.object({
  department: z.string().min(1),
  item: z.string().min(1),
  quantity: z.number().positive(),
  site: z.string().min(1),
});

const processSchema = z.object({
  requiredDate: z.string().optional(),
  purpose: z.string().optional().default(""),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional().default("MEDIUM"),
});

// POST /api/item-requirements — Admin, site-scoped
export const createItemRequirement = asyncHandler(async (req, res) => {
  const parsed = createRequirementSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid item requirement payload", parsed.error.flatten());

  const { site, item: itemId, ...rest } = parsed.data;

  if (req.user.role === "ADMIN" && String(site) !== String(req.user.site)) {
    return apiError(res, 403, "Admins can only raise requirements for their own site.");
  }

  const item = await Item.findById(itemId);
  if (!item) return apiError(res, 404, "Item not found");

  const requirement = await ItemRequirement.create({
    ...rest,
    item: itemId,
    site,
    requestedBy: req.user._id,
  });

  return apiSuccess(res, 201, requirement, "Item requirement raised");
});

// GET /api/item-requirements?site=&status=&department=
export const listItemRequirements = asyncHandler(async (req, res) => {
  const { site, status, department } = req.query;
  const filter = {};

  if (req.user.role === "ADMIN") {
    filter.site = req.user.site;
  } else if (site) {
    filter.site = site;
  }
  if (status) filter.status = status;
  if (department) filter.department = department;

  const requirements = await ItemRequirement.find(filter)
    .populate("item", "name itemCode unit reorderLevel")
    .populate("site", "name")
    .populate("requestedBy", "name")
    .sort({ createdAt: -1 });

  return apiSuccess(res, 200, requirements);
});

// GET /api/item-requirements/:id
export const getItemRequirement = asyncHandler(async (req, res) => {
  const requirement = await ItemRequirement.findById(req.params.id)
    .populate("item")
    .populate("site", "name")
    .populate("requestedBy", "name");
  if (!requirement) return apiError(res, 404, "Item requirement not found");
  return apiSuccess(res, 200, requirement);
});

// POST /api/item-requirements/:id/process — the availability check.
// Path A: whatever is in stock is issued immediately via an Item Issue Slip.
// Path B: whatever can't be covered from stock becomes a linked Purchase
// Requisition for the shortfall (RA v2.0 Sec. 8 / OP-5 pattern).
export const processItemRequirement = asyncHandler(async (req, res) => {
  const parsed = processSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid payload", parsed.error.flatten());

  const requirement = await ItemRequirement.findById(req.params.id).populate("item");
  if (!requirement) return apiError(res, 404, "Item requirement not found");
  if (requirement.status === "FULFILLED") {
    return apiError(res, 400, "This requirement is already fully fulfilled.");
  }

  const remainingQty = requirement.quantity - requirement.quantityIssued;
  const available = await getAvailableQuantity(requirement.item._id, requirement.site);

  const result = { issueSlip: null, purchaseRequisition: null };

  // Path A — issue immediately from whatever stock is available.
  if (available > 0) {
    const issueQty = Math.min(available, remainingQty);
    await decreaseStock(requirement.item._id, requirement.site, issueQty);

    const issueSlipNumber = await generateSequentialId(ItemIssueSlip, "issueSlipNumber", "ISS", 1000);
    result.issueSlip = await ItemIssueSlip.create({
      issueSlipNumber,
      requirementRef: requirement._id,
      item: requirement.item._id,
      quantity: issueQty,
      site: requirement.site,
      issuedBy: req.user._id,
      issuedTo: requirement.department,
    });

    await recordIssueAgainstRequirement(requirement._id, issueQty);
  }

  const updated = await ItemRequirement.findById(requirement._id);
  const stillShort = updated.quantity - updated.quantityIssued;

  // Path B — whatever couldn't be covered from stock goes to Purchasing.
  if (stillShort > 0) {
    const existingPR = await PurchaseRequisition.findOne({
      requirement: requirement._id,
      status: { $in: ["PENDING", "APPROVED"] },
    });

    if (existingPR) {
      result.purchaseRequisition = existingPR;
    } else {
      const prNumber = await generateSequentialId(PurchaseRequisition, "prNumber", "PR", 1000);
      const requiredDate = parsed.data.requiredDate
        ? new Date(parsed.data.requiredDate)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      result.purchaseRequisition = await PurchaseRequisition.create({
        prNumber,
        requirement: requirement._id,
        department: requirement.department,
        requestedBy: requirement.requestedBy,
        site: requirement.site,
        item: requirement.item._id,
        quantity: stillShort,
        requiredDate,
        purpose: parsed.data.purpose || `Shortfall against Item Requirement ${requirement._id}`,
        priority: parsed.data.priority,
      });
    }
  }

  const message =
    result.issueSlip && result.purchaseRequisition
      ? "Partially issued from stock; a Purchase Requisition was raised for the shortfall."
      : result.issueSlip
      ? "Fully issued from available stock."
      : "No stock available; a Purchase Requisition was raised for the full quantity.";

  return apiSuccess(res, 200, { requirement: updated, ...result }, message);
});
