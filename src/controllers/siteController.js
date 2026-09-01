import { z } from "zod";
import Site from "../models/Site.js";
import { asyncHandler, apiError, apiSuccess } from "../utils/apiResponse.js";

const createSiteSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  location: z.string().optional(),
});

const updateSiteSchema = createSiteSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// GET /api/sites — both roles can list. Admins only see their own site.
export const listSites = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.user.role === "ADMIN") {
    filter._id = req.user.site;
  }
  const sites = await Site.find(filter).sort({ name: 1 });
  return apiSuccess(res, 200, sites);
});

export const getSite = asyncHandler(async (req, res) => {
  const site = await Site.findById(req.params.id);
  if (!site) return apiError(res, 404, "Site not found");

  if (req.user.role === "ADMIN" && String(site._id) !== String(req.user.site)) {
    return apiError(res, 403, "You cannot view another site.");
  }
  return apiSuccess(res, 200, site);
});

// POST /api/sites — SuperAdmin only
export const createSite = asyncHandler(async (req, res) => {
  const parsed = createSiteSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid site payload", parsed.error.flatten());

  const site = await Site.create(parsed.data);
  return apiSuccess(res, 201, site, "Site created");
});

// PUT /api/sites/:id — SuperAdmin only
export const updateSite = asyncHandler(async (req, res) => {
  const parsed = updateSiteSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid site payload", parsed.error.flatten());

  const site = await Site.findByIdAndUpdate(req.params.id, parsed.data, {
    new: true,
    runValidators: true,
  });
  if (!site) return apiError(res, 404, "Site not found");
  return apiSuccess(res, 200, site, "Site updated");
});
