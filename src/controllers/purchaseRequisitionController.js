import { z } from "zod";
import PurchaseRequisition from "../models/PurchaseRequisition.js";
import Item from "../models/Item.js";
import { generateSequentialId } from "../utils/generateId.js";
import { asyncHandler, apiError, apiSuccess } from "../utils/apiResponse.js";

const createRequisitionSchema = z.object({
  department: z.string().min(1),
  site: z.string().min(1),
  item: z.string().min(1),
  quantity: z.number().positive(),
  requiredDate: z.string().min(1),
  purpose: z.string().optional().default(""),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional().default("MEDIUM"),
});

const decisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  decisionRemark: z.string().optional().default(""),
});

function siteFilterFor(user, requestedSite) {
  if (user.role === "ADMIN" || user.role === "STORE_KEEPER") return { site: user.site };
  return requestedSite ? { site: requestedSite } : {};
}

// POST /api/purchase-requisitions — Admin (site-scoped) raises a requisition directly,
// independent of the Item Requirement path (a PR can also be standalone).
export const createPurchaseRequisition = asyncHandler(async (req, res) => {
  const parsed = createRequisitionSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid purchase requisition payload", parsed.error.flatten());

  const { site, ...rest } = parsed.data;
  if (req.user.role === "ADMIN" && String(site) !== String(req.user.site)) {
    return apiError(res, 403, "Admins can only raise requisitions for their own site.");
  }

  const item = await Item.findById(rest.item);
  if (!item) return apiError(res, 404, "Item not found");

  const prNumber = await generateSequentialId(PurchaseRequisition, "prNumber", "PR", 1000);
  const requisition = await PurchaseRequisition.create({
    ...rest,
    prNumber,
    site,
    requiredDate: new Date(rest.requiredDate),
    requestedBy: req.user._id,
  });

  return apiSuccess(res, 201, requisition, "Purchase requisition raised");
});

// GET /api/purchase-requisitions?status=&site=&department=
// Purchase Manager may only ever see APPROVED requisitions — enforced here
// server-side, not just hidden in the UI (RA v2.0 Sec. 8, point 3).
export const listPurchaseRequisitions = asyncHandler(async (req, res) => {
  const { status, site, department } = req.query;
  const filter = siteFilterFor(req.user, site);

  if (req.user.role === "PURCHASE_MANAGER") {
    filter.status = "APPROVED";
  } else if (status) {
    filter.status = status;
  }

  if (department) filter.department = department;

  const requisitions = await PurchaseRequisition.find(filter)
    .populate("item", "name itemCode unit")
    .populate("site", "name")
    .populate("requestedBy", "name")
    .populate("decidedBy", "name")
    .populate("requirement")
    .sort({ createdAt: -1 });

  return apiSuccess(res, 200, requisitions);
});

// GET /api/purchase-requisitions/:id
export const getPurchaseRequisition = asyncHandler(async (req, res) => {
  const requisition = await PurchaseRequisition.findById(req.params.id)
    .populate("item")
    .populate("site", "name")
    .populate("requestedBy", "name")
    .populate("decidedBy", "name");

  if (!requisition) return apiError(res, 404, "Purchase requisition not found");

  if (req.user.role === "PURCHASE_MANAGER" && requisition.status !== "APPROVED") {
    return apiError(res, 403, "Purchase Manager can only view approved requisitions.");
  }

  return apiSuccess(res, 200, requisition);
});

// PATCH /api/purchase-requisitions/:id/decision — Management's approval gate
export const decidePurchaseRequisition = asyncHandler(async (req, res) => {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid decision payload", parsed.error.flatten());

  const requisition = await PurchaseRequisition.findById(req.params.id);
  if (!requisition) return apiError(res, 404, "Purchase requisition not found");

  if (requisition.status !== "PENDING") {
    return apiError(res, 400, "This requisition has already been decided.");
  }

  requisition.status = parsed.data.decision;
  requisition.decisionRemark = parsed.data.decisionRemark;
  requisition.decidedBy = req.user._id;
  requisition.decidedAt = new Date();
  await requisition.save();

  return apiSuccess(res, 200, requisition, `Purchase requisition ${requisition.status.toLowerCase()}`);
});
