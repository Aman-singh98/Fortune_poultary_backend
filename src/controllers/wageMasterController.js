import { z } from "zod";
import WageMaster from "../models/WageMaster.js";
import { asyncHandler, apiError, apiSuccess } from "../utils/apiResponse.js";

const APPLIES_TO = ["PERMANENT", "CONSTRUCTION_LABOUR", "PAINTER", "MAINTENANCE", "ELECTRICIAN"];

const createWageMasterSchema = z.object({
  name: z.string().min(1),
  appliesTo: z.enum(APPLIES_TO),
  dayRate: z.number().nonnegative(),
  overtimeRatePerHour: z.number().nonnegative().default(0),
  yearlyIncrementPercent: z.number().nonnegative().default(0),
  site: z.string().optional().nullable(),
});

const updateWageMasterSchema = z.object({
  name: z.string().min(1).optional(),
  appliesTo: z.enum(APPLIES_TO).optional(),
  dayRate: z.number().nonnegative().optional(),
  overtimeRatePerHour: z.number().nonnegative().optional(),
  yearlyIncrementPercent: z.number().nonnegative().optional(),
  eggCommissionRate: z.number().nonnegative().optional(),
  birdCommissionRate: z.number().nonnegative().optional(),
  site: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const overrideSchema = z.object({
  newRate: z.number().nonnegative(),
  reason: z.string().min(1, "A reason is required for a manual rate override"),
});

// GET /api/wage-masters
export const listWageMasters = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.user.role === "ADMIN") {
    filter.$or = [{ site: req.user.site }, { site: null }];
  }
  const wageMasters = await WageMaster.find(filter).populate("site", "name").sort({ createdAt: -1 });
  return apiSuccess(res, 200, wageMasters);
});

// POST /api/wage-masters — SuperAdmin only
export const createWageMaster = asyncHandler(async (req, res) => {
  const parsed = createWageMasterSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid wage master payload", parsed.error.flatten());

  const wageMaster = await WageMaster.create(parsed.data);
  return apiSuccess(res, 201, wageMaster, "Wage master created");
});

// PUT /api/wage-masters/:id — SuperAdmin only
export const updateWageMaster = asyncHandler(async (req, res) => {
  const parsed = updateWageMasterSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid wage master payload", parsed.error.flatten());

  const wageMaster = await WageMaster.findById(req.params.id);
  if (!wageMaster) return apiError(res, 404, "Wage master not found");

  const { dayRate, ...rest } = parsed.data;

  // If the day rate is being changed through a general edit, keep the audit trail intact.
  if (typeof dayRate === "number" && dayRate !== wageMaster.dayRate) {
    wageMaster.rateHistory.push({
      oldRate: wageMaster.dayRate,
      newRate: dayRate,
      reason: "Updated via Wage Master edit",
      changedBy: req.user._id,
      changedAt: new Date(),
    });
    wageMaster.dayRate = dayRate;
  }

  Object.assign(wageMaster, rest);
  await wageMaster.save();

  return apiSuccess(res, 200, wageMaster, "Wage master updated");
});

// DELETE /api/wage-masters/:id — SuperAdmin only
export const deleteWageMaster = asyncHandler(async (req, res) => {
  const wageMaster = await WageMaster.findById(req.params.id);
  if (!wageMaster) return apiError(res, 404, "Wage master not found");

  await wageMaster.deleteOne();

  return apiSuccess(res, 200, { _id: req.params.id }, "Wage master deleted");
});

// PATCH /api/wage-masters/:id/manual-override — SuperAdmin only, mandatory reason
export const manualOverride = asyncHandler(async (req, res) => {
  const parsed = overrideSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid override payload", parsed.error.flatten());

  const { newRate, reason } = parsed.data;
  const wageMaster = await WageMaster.findById(req.params.id);
  if (!wageMaster) return apiError(res, 404, "Wage master not found");

  const oldRate = wageMaster.dayRate;
  wageMaster.dayRate = newRate;
  wageMaster.rateHistory.push({
    oldRate,
    newRate,
    reason,
    changedBy: req.user._id,
    changedAt: new Date(),
  });

  await wageMaster.save();
  return apiSuccess(res, 200, wageMaster, "Manual rate override applied");
});

// PATCH /api/wage-masters/:id/apply-increment — SuperAdmin only
export const applyIncrement = asyncHandler(async (req, res) => {
  const wageMaster = await WageMaster.findById(req.params.id);
  if (!wageMaster) return apiError(res, 404, "Wage master not found");

  if (!wageMaster.yearlyIncrementPercent || wageMaster.yearlyIncrementPercent <= 0) {
    return apiError(res, 400, "This wage master has no yearlyIncrementPercent configured.");
  }

  const oldRate = wageMaster.dayRate;
  const newRate = Math.round(oldRate * (1 + wageMaster.yearlyIncrementPercent / 100) * 100) / 100;

  wageMaster.dayRate = newRate;
  wageMaster.rateHistory.push({
    oldRate,
    newRate,
    reason: `Policy-based yearly increment (${wageMaster.yearlyIncrementPercent}%)`,
    changedBy: req.user._id,
    changedAt: new Date(),
  });

  await wageMaster.save();
  return apiSuccess(res, 200, wageMaster, "Yearly increment applied");
});
