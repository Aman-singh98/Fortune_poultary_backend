import { z } from "zod";
import ItemIssueSlip from "../models/ItemIssueSlip.js";
import ItemRequirement from "../models/ItemRequirement.js";
import { generateSequentialId } from "../utils/generateId.js";
import { decreaseStock } from "../services/stockService.js";
import { recordIssueAgainstRequirement } from "../services/purchaseFlowService.js";
import { asyncHandler, apiError, apiSuccess } from "../utils/apiResponse.js";

const createIssueSchema = z.object({
  requirementRef: z.string().min(1),
  quantity: z.number().positive(),
  issuedTo: z.string().optional().default(""),
});

// POST /api/item-issues — Admin (site-scoped) fulfils an Item Requirement
// once stock is available; decrements Stock and marks the requirement
// fulfilled/partial via purchaseFlowService.
export const createItemIssueSlip = asyncHandler(async (req, res) => {
  const parsed = createIssueSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid item issue payload", parsed.error.flatten());

  const requirement = await ItemRequirement.findById(parsed.data.requirementRef);
  if (!requirement) return apiError(res, 404, "Item requirement not found");

  if (req.user.role === "ADMIN" && String(requirement.site) !== String(req.user.site)) {
    return apiError(res, 403, "Admins can only issue items for their own site.");
  }

  const remaining = requirement.quantity - requirement.quantityIssued;
  if (parsed.data.quantity > remaining) {
    return apiError(
      res,
      400,
      `Cannot issue ${parsed.data.quantity}; only ${remaining} remains against this requirement.`
    );
  }

  await decreaseStock(requirement.item, requirement.site, parsed.data.quantity);

  const issueSlipNumber = await generateSequentialId(ItemIssueSlip, "issueSlipNumber", "ISS", 1000);
  const issueSlip = await ItemIssueSlip.create({
    issueSlipNumber,
    requirementRef: requirement._id,
    item: requirement.item,
    quantity: parsed.data.quantity,
    site: requirement.site,
    issuedBy: req.user._id,
    issuedTo: parsed.data.issuedTo || requirement.department,
  });

  await recordIssueAgainstRequirement(requirement._id, parsed.data.quantity);

  return apiSuccess(res, 201, issueSlip, "Item issued");
});

// GET /api/item-issues?requirementRef=&site=&item=
export const listItemIssueSlips = asyncHandler(async (req, res) => {
  const { requirementRef, site, item } = req.query;
  const filter = {};
  if (requirementRef) filter.requirementRef = requirementRef;
  if (site) filter.site = site;
  else if (req.user.role === "ADMIN" || req.user.role === "STORE_KEEPER") filter.site = req.user.site;
  if (item) filter.item = item;

  const slips = await ItemIssueSlip.find(filter)
    .populate("item", "name itemCode unit")
    .populate("site", "name")
    .populate("issuedBy", "name")
    .populate("requirementRef", "department status")
    .sort({ createdAt: -1 });

  return apiSuccess(res, 200, slips);
});

// GET /api/item-issues/:id
export const getItemIssueSlip = asyncHandler(async (req, res) => {
  const slip = await ItemIssueSlip.findById(req.params.id)
    .populate("item")
    .populate("site", "name")
    .populate("issuedBy", "name")
    .populate("requirementRef");
  if (!slip) return apiError(res, 404, "Item issue slip not found");
  return apiSuccess(res, 200, slip);
});
