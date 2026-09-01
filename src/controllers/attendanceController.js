import { z } from "zod";
import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";
import { asyncHandler, apiError, apiSuccess } from "../utils/apiResponse.js";

const STATUS_VALUES = [
  "PRESENT",
  "ABSENT",
  "HALF_DAY",
  "OVERTIME",
  "PRESENT_X2",
  "PRESENT_HALF",
  "LEAVE",
  "SUNDAY",
  "HOLIDAY",
];

const markSchema = z.object({
  employee: z.string().min(1),
  date: z.string().min(1), // ISO date string, e.g. "2026-08-26"
  status: z.enum(STATUS_VALUES),
  overtimeHours: z.number().nonnegative().optional().default(0),
  eggsSold: z.number().nonnegative().optional().default(0),
  birdsSold: z.number().nonnegative().optional().default(0),
  remarks: z.string().optional().default(""),
});

const markAllPresentSchema = z.object({
  site: z.string().min(1),
  date: z.string().min(1),
});

function startOfDay(dateStr) {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function assertSiteAccess(user, siteId) {
  if (user.role === "SUPER_ADMIN") return true;
  return String(siteId) === String(user.site);
}

// POST /api/attendance/mark — upsert one attendance record per employee per day
export const markAttendance = asyncHandler(async (req, res) => {
  const parsed = markSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid attendance payload", parsed.error.flatten());

  const { employee: employeeId, date, ...rest } = parsed.data;

  const employee = await Employee.findById(employeeId);
  if (!employee) return apiError(res, 404, "Employee not found");

  const allowed = await assertSiteAccess(req.user, employee.site);
  if (!allowed) return apiError(res, 403, "You cannot mark attendance for another site's employee.");

  const day = startOfDay(date);

  const record = await Attendance.findOneAndUpdate(
    { employee: employeeId, date: day },
    {
      $set: {
        ...rest,
        site: employee.site,
        markedBy: req.user._id,
        markedAt: new Date(),
      },
    },
    { new: true, upsert: true, runValidators: true }
  );

  return apiSuccess(res, 200, record, "Attendance marked");
});

// POST /api/attendance/mark-all-present — bulk action for a whole site on a given date
export const markAllPresent = asyncHandler(async (req, res) => {
  const parsed = markAllPresentSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid payload", parsed.error.flatten());

  const { site, date } = parsed.data;

  const allowed = await assertSiteAccess(req.user, site);
  if (!allowed) return apiError(res, 403, "You cannot mark attendance for another site.");

  const day = startOfDay(date);
  const employees = await Employee.find({ site, isActive: true }).select("_id");

  const ops = employees.map((emp) => ({
    updateOne: {
      filter: { employee: emp._id, date: day },
      update: {
        $set: {
          site,
          status: "PRESENT",
          markedBy: req.user._id,
          markedAt: new Date(),
        },
        $setOnInsert: { overtimeHours: 0, eggsSold: 0, birdsSold: 0, remarks: "" },
      },
      upsert: true,
    },
  }));

  if (ops.length > 0) {
    await Attendance.bulkWrite(ops);
  }

  return apiSuccess(res, 200, { updated: ops.length }, "Marked all present");
});

// GET /api/attendance?site=&date=&month=&year=&employee=
export const listAttendance = asyncHandler(async (req, res) => {
  const { site, date, month, year, employee } = req.query;
  const filter = {};

  if (req.user.role === "ADMIN") {
    filter.site = req.user.site;
  } else if (site) {
    filter.site = site;
  }

  if (employee) filter.employee = employee;

  if (date) {
    filter.date = startOfDay(date);
  } else if (month && year) {
    const start = new Date(Number(year), Number(month) - 1, 1);
    const end = new Date(Number(year), Number(month), 1);
    filter.date = { $gte: start, $lt: end };
  }

  const records = await Attendance.find(filter)
    .populate("employee", "name labourId employeeType wagesSubCategory")
    .populate("site", "name")
    .populate("markedBy", "name")
    .sort({ date: -1 });

  return apiSuccess(res, 200, records);
});

// GET /api/attendance/summary?site=&date=
export const attendanceSummary = asyncHandler(async (req, res) => {
  const { site, date } = req.query;
  const day = date ? startOfDay(date) : startOfDay(new Date().toISOString());

  const filter = { date: day };
  if (req.user.role === "ADMIN") {
    filter.site = req.user.site;
  } else if (site) {
    filter.site = site;
  }

  const records = await Attendance.find(filter);

  const totalSites = req.user.role === "SUPER_ADMIN" && !site
    ? await Attendance.distinct("site", { date: day }).then((s) => s.length)
    : 1;

  const totalLabour = await Employee.countDocuments(
    req.user.role === "ADMIN" ? { site: req.user.site, isActive: true } : site ? { site, isActive: true } : { isActive: true }
  );

  const counts = {
    totalSites,
    totalLabour,
    presentToday: 0,
    absent: 0,
    leave: 0,
    overtimeHours: 0,
    presentX2: 0,
    presentHalf: 0,
  };

  for (const r of records) {
    if (r.status === "PRESENT") counts.presentToday += 1;
    if (r.status === "ABSENT") counts.absent += 1;
    if (r.status === "LEAVE") counts.leave += 1;
    if (r.status === "PRESENT_X2") counts.presentX2 += 1;
    if (r.status === "PRESENT_HALF") counts.presentHalf += 1;
    counts.overtimeHours += r.overtimeHours || 0;
  }

  return apiSuccess(res, 200, counts);
});
