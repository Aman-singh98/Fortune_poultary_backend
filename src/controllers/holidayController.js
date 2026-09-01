import { z } from "zod";
import Holiday from "../models/Holiday.js";
import { asyncHandler, apiError, apiSuccess } from "../utils/apiResponse.js";

const createHolidaySchema = z.object({
  name: z.string().min(1),
  date: z.string().min(1),
});

const decisionSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    sites: z.array(z.string()).optional().default([]),
  })
  .refine((data) => data.decision !== "APPROVED" || data.sites.length > 0, {
    message: "At least one site must be selected when approving a holiday.",
    path: ["sites"],
  });

function startOfDay(d) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

// POST /api/holidays — Admin proposes a holiday date
export const proposeHoliday = asyncHandler(async (req, res) => {
  const parsed = createHolidaySchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid holiday payload", parsed.error.flatten());

  const holiday = await Holiday.create({
    name: parsed.data.name,
    date: startOfDay(parsed.data.date),
    // Site applicability is not automatic across all sites — it's confirmed at
    // approval time by the Super Admin (requirement doc Sec. 6). If an Admin
    // proposes it, we record their own site as the suggested default.
    sites: req.user.role === "ADMIN" && req.user.site ? [req.user.site] : [],
    proposedBy: req.user._id,
  });

  return apiSuccess(res, 201, holiday, "Holiday proposed, pending Super Admin approval");
});

// GET /api/holidays?status=&year=
export const listHolidays = asyncHandler(async (req, res) => {
  const { status, year } = req.query;
  const filter = {};

  if (status) filter.status = status;
  if (year) {
    const start = new Date(Number(year), 0, 1);
    const end = new Date(Number(year) + 1, 0, 1);
    filter.date = { $gte: start, $lt: end };
  }

  if (req.user.role === "ADMIN") {
    // Admins see holidays they proposed, plus any already approved for their site.
    filter.$or = [{ proposedBy: req.user._id }, { sites: req.user.site }];
  }

  const holidays = await Holiday.find(filter)
    .populate("sites", "name")
    .populate("proposedBy", "name")
    .populate("approvedBy", "name")
    .sort({ date: 1 });

  return apiSuccess(res, 200, holidays);
});

// PATCH /api/holidays/:id/decision — SuperAdmin approves/rejects and confirms site applicability
export const decideHoliday = asyncHandler(async (req, res) => {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid decision payload", parsed.error.flatten());

  const holiday = await Holiday.findById(req.params.id);
  if (!holiday) return apiError(res, 404, "Holiday not found");

  if (holiday.status !== "PENDING") {
    return apiError(res, 400, "This holiday has already been decided.");
  }

  holiday.status = parsed.data.decision;
  holiday.sites = parsed.data.decision === "APPROVED" ? parsed.data.sites : holiday.sites;
  holiday.approvedBy = req.user._id;
  holiday.decidedAt = new Date();
  await holiday.save();

  return apiSuccess(res, 200, holiday, `Holiday ${holiday.status.toLowerCase()}`);
});
