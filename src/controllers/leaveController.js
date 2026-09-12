import { z } from "zod";
import Leave from "../models/Leave.js";
import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import { asyncHandler, apiError, apiSuccess } from "../utils/apiResponse.js";

const createLeaveSchema = z
  .object({
    employee: z.string().min(1),
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2000),
    fromDate: z.string().min(1),
    toDate: z.string().min(1),
    reason: z.string().optional().default(""),
  })
  .refine((data) => new Date(data.fromDate) <= new Date(data.toDate), {
    message: "fromDate must be on or before toDate",
    path: ["toDate"],
  });

const decisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  decisionRemark: z.string().optional().default(""),
});

function startOfDay(d) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function eachDateInRange(from, to) {
  const dates = [];
  const cur = startOfDay(from);
  const end = startOfDay(to);
  while (cur <= end) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// POST /api/leaves — Admin (site-scoped) requests leave for an employee
export const createLeave = asyncHandler(async (req, res) => {
  const parsed = createLeaveSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid leave request payload", parsed.error.flatten());

  const { employee: employeeId, ...rest } = parsed.data;

  const employee = await Employee.findById(employeeId);
  if (!employee) return apiError(res, 404, "Employee not found");

  if (req.user.role === "ADMIN" && String(employee.site) !== String(req.user.site)) {
    return apiError(res, 403, "Admins can only request leave for their own site's employees.");
  }

  const leave = await Leave.create({
    employee: employeeId,
    site: employee.site,
    fromDate: startOfDay(rest.fromDate),
    toDate: startOfDay(rest.toDate),
    month: rest.month,
    year: rest.year,
    reason: rest.reason,
    requestedBy: req.user._id,
  });

  return apiSuccess(res, 201, leave, "Leave request submitted");
});

// GET /api/leaves?site=&status=&month=&year=&employee=
export const listLeaves = asyncHandler(async (req, res) => {
  const { site, status, month, year, employee } = req.query;
  const filter = {};

  if (req.user.role === "ADMIN") {
    filter.site = req.user.site;
  } else if (site) {
    filter.site = site;
  }

  if (status) filter.status = status;
  if (month) filter.month = Number(month);
  if (year) filter.year = Number(year);
  if (employee) filter.employee = employee;

  const leaves = await Leave.find(filter)
    .populate("employee", "name labourId employeeCode employeeType")
    .populate("site", "name")
    .populate("requestedBy", "name")
    .populate("decidedBy", "name")
    .sort({ createdAt: -1 });

  return apiSuccess(res, 200, leaves);
});

// PATCH /api/leaves/:id/decision — SuperAdmin only, final authority
export const decideLeave = asyncHandler(async (req, res) => {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid decision payload", parsed.error.flatten());

  const leave = await Leave.findById(req.params.id);
  if (!leave) return apiError(res, 404, "Leave request not found");

  if (leave.status !== "PENDING") {
    return apiError(res, 400, "This leave request has already been decided.");
  }

  leave.status = parsed.data.decision;
  leave.decisionRemark = parsed.data.decisionRemark;
  leave.decidedBy = req.user._id;
  leave.decidedAt = new Date();
  await leave.save();

  // Approved leave automatically reflects in the employee's attendance calendar
  // with the "Leave" status (requirement doc Sec. 5).
  if (leave.status === "APPROVED") {
    const dates = eachDateInRange(leave.fromDate, leave.toDate);
    const ops = dates.map((date) => ({
      updateOne: {
        filter: { employee: leave.employee, date },
        update: {
          $set: {
            site: leave.site,
            status: "LEAVE",
            markedBy: req.user._id,
            markedAt: new Date(),
          },
          $setOnInsert: { overtimeHours: 0, eggsSold: 0, birdsSold: 0, remarks: "Approved leave" },
        },
        upsert: true,
      },
    }));
    if (ops.length > 0) {
      await Attendance.bulkWrite(ops);
    }
  }

  return apiSuccess(res, 200, leave, `Leave ${leave.status.toLowerCase()}`);
});
