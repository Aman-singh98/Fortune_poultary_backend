import { z } from "zod";
import Employee from "../models/Employee.js";
import { generateSequentialId } from "../utils/generateId.js";
import { siteVisibilityFilter } from "../utils/siteAccess.js";
import { asyncHandler, apiError, apiSuccess } from "../utils/apiResponse.js";

const WAGES_SUB_CATEGORIES = ["CONSTRUCTION_LABOUR", "PAINTER", "MAINTENANCE", "ELECTRICIAN"];

const baseEmployeeFields = {
  name: z.string().min(1),
  phone: z.string().optional(),
  employeeCode: z.string().optional(),
  designation: z.string().optional(),
  probationPeriod: z.number().nonnegative().optional(),
  remarks: z.string().optional(),
  site: z.string().min(1),
  // Multi-site visibility: either flagged for every site, or a specific extra list.
  allSites: z.boolean().optional().default(false),
  sites: z.array(z.string()).optional().default([]),
  employeeType: z.enum(["PERMANENT", "WAGES"]),
  wagesSubCategory: z.enum(WAGES_SUB_CATEGORIES).optional().nullable(),
  basicSalary: z.number().nonnegative().optional(),
  wageMaster: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
};

const createEmployeeSchema = z
  .object(baseEmployeeFields)
  .refine((data) => data.employeeType !== "WAGES" || !!data.wagesSubCategory, {
    message: "wagesSubCategory is required when employeeType is WAGES",
    path: ["wagesSubCategory"],
  })
  .refine((data) => data.employeeType !== "WAGES" || !!data.wageMaster, {
    message: "Wage master is required for WAGES employees",
    path: ["wageMaster"],
  })
  .refine(
    (data) => data.employeeType !== "PERMANENT" || !!data.wageMaster || !!data.basicSalary,
    {
      message: "Either a basic salary or a wage master is required so salary can be calculated",
      path: ["basicSalary"],
    }
  );

const updateEmployeeSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  employeeCode: z.string().optional(),
  designation: z.string().optional(),
  probationPeriod: z.number().nonnegative().optional(),
  remarks: z.string().optional(),
  allSites: z.boolean().optional(),
  sites: z.array(z.string()).optional(),
  employeeType: z.enum(["PERMANENT", "WAGES"]).optional(),
  wagesSubCategory: z.enum(WAGES_SUB_CATEGORIES).optional().nullable(),
  basicSalary: z.number().nonnegative().optional(),
  wageMaster: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const statusSchema = z.object({
  isActive: z.boolean(),
});

// Restrict an Admin's queries/writes to their own site; SuperAdmin is unrestricted.
// `requestedSite` also matches employees who are visible at that site because
// they're assigned to it as an extra site, or flagged visible on every site.
function siteFilterFor(user, requestedSite) {
  if (user.role === "SUPER_ADMIN") {
    return requestedSite ? siteVisibilityFilter(requestedSite) : {};
  }
  return siteVisibilityFilter(user.site);
}

// GET /api/employees?site=&employeeType=&wagesSubCategory=
export const listEmployees = asyncHandler(async (req, res) => {
  const { employeeType, wagesSubCategory, site, search, isActive } = req.query;

  const filter = siteFilterFor(req.user, site);
  if (employeeType) filter.employeeType = employeeType;
  if (wagesSubCategory) filter.wagesSubCategory = wagesSubCategory;
  if (search) filter.name = { $regex: search, $options: "i" };
  if (isActive !== undefined) filter.isActive = isActive === "true" || isActive === true;

  const employees = await Employee.find(filter)
    .populate("site", "name")
    .populate("sites", "name")
    .populate("wageMaster", "name dayRate overtimeRatePerHour")
    .sort({ createdAt: -1 });

  return apiSuccess(res, 200, employees);
});

// GET /api/employees/:id
export const getEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id)
    .populate("site", "name")
    .populate("sites", "name")
    .populate("wageMaster");

  if (!employee) return apiError(res, 404, "Employee not found");

  if (
    req.user.role === "ADMIN" &&
    !employee.allSites &&
    String(employee.site._id) !== String(req.user.site) &&
    !(employee.sites || []).some((s) => String(s._id) === String(req.user.site))
  ) {
    return apiError(res, 403, "You cannot view an employee from another site.");
  }
  return apiSuccess(res, 200, employee);
});

// POST /api/employees — SuperAdmin (any site) or Admin (their own site only)
export const createEmployee = asyncHandler(async (req, res) => {
  const parsed = createEmployeeSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid employee payload", parsed.error.flatten());

  const data = parsed.data;

  if (req.user.role === "ADMIN" && String(data.site) !== String(req.user.site)) {
    return apiError(res, 403, "Admins can only create employees for their own site.");
  }
  // Admins can't grant all-sites/multi-site visibility to an employee — that's a
  // Super Admin-only decision since it crosses site boundaries.
  if (req.user.role === "ADMIN" && (data.allSites || (data.sites && data.sites.length))) {
    return apiError(res, 403, "Only a Super Admin can assign an employee to multiple sites.");
  }

  const labourId = await generateSequentialId(Employee, "labourId", "LB", 1000);
  const employeeCode = data.employeeCode || (await generateSequentialId(Employee, "employeeCode", "EMP", 1000));

  const employee = await Employee.create({ ...data, labourId, employeeCode });
  return apiSuccess(res, 201, employee, "Employee created");
});

// PUT /api/employees/:id — Super Admin only
export const updateEmployee = asyncHandler(async (req, res) => {
  const parsed = updateEmployeeSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid employee payload", parsed.error.flatten());

  const employee = await Employee.findById(req.params.id);
  if (!employee) return apiError(res, 404, "Employee not found");

  Object.assign(employee, parsed.data);
  await employee.save();

  return apiSuccess(res, 200, employee, "Employee updated");
});

// PATCH /api/employees/:id/status — Super Admin only. Active/inactive toggle.
export const updateEmployeeStatus = asyncHandler(async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid status payload", parsed.error.flatten());

  const employee = await Employee.findById(req.params.id);
  if (!employee) return apiError(res, 404, "Employee not found");

  employee.isActive = parsed.data.isActive;
  await employee.save();

  return apiSuccess(res, 200, employee, `Employee marked ${employee.isActive ? "active" : "inactive"}`);
});

// DELETE /api/employees/:id — Super Admin only
export const deleteEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id);
  if (!employee) return apiError(res, 404, "Employee not found");

  await employee.deleteOne();

  return apiSuccess(res, 200, { _id: req.params.id }, "Employee deleted");
});
