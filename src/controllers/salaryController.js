import { z } from "zod";
import Salary from "../models/Salary.js";
import Employee from "../models/Employee.js";
import { calculateMonthlySalary, addDeduction as addDeductionService } from "../services/salaryService.js";
import { asyncHandler, apiError, apiSuccess } from "../utils/apiResponse.js";

const generateSchema = z.object({
  employee: z.string().min(1),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000),
});

const deductionSchema = z.object({
  type: z.enum(["ADVANCE", "FINE", "EXPENSE"]),
  amount: z.number().positive(),
  isPercentage: z.boolean().optional().default(false),
  remark: z.string().min(1, "A remark/reason is required for every deduction"),
});

async function assertEmployeeSiteAccess(user, employee) {
  if (user.role === "SUPER_ADMIN") return true;
  return String(employee.site) === String(user.site);
}

// POST /api/salaries/generate — { employee, month, year }
export const generateSalary = asyncHandler(async (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid generate-salary payload", parsed.error.flatten());

  const { employee: employeeId, month, year } = parsed.data;

  const employee = await Employee.findById(employeeId);
  if (!employee) return apiError(res, 404, "Employee not found");

  const allowed = await assertEmployeeSiteAccess(req.user, employee);
  if (!allowed) return apiError(res, 403, "You cannot generate salary for another site's employee.");

  try {
    const salary = await calculateMonthlySalary(employeeId, month, year, req.user._id);
    const populated = await salary.populate([
      { path: "employee", select: "name labourId employeeType wagesSubCategory" },
      { path: "site", select: "name" },
    ]);
    return apiSuccess(res, 200, populated, "Salary generated");
  } catch (err) {
    return apiError(res, err.statusCode || 500, err.message || "Could not generate salary");
  }
});

// POST /api/salaries/:id/deduction — { type, amount, isPercentage, remark }
export const addDeduction = asyncHandler(async (req, res) => {
  const parsed = deductionSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "Invalid deduction payload", parsed.error.flatten());

  const salary = await Salary.findById(req.params.id);
  if (!salary) return apiError(res, 404, "Salary record not found");

  const allowed = req.user.role === "SUPER_ADMIN" || String(salary.site) === String(req.user.site);
  if (!allowed) return apiError(res, 403, "You cannot modify salary for another site's employee.");

  const updated = await addDeductionService(req.params.id, parsed.data, req.user._id);
  return apiSuccess(res, 200, updated, "Deduction added");
});

// GET /api/salaries?site=&month=&year=&employee=
export const listSalaries = asyncHandler(async (req, res) => {
  const { site, month, year, employee } = req.query;
  const filter = {};

  if (req.user.role === "ADMIN") {
    filter.site = req.user.site;
  } else if (site) {
    filter.site = site;
  }

  if (month) filter.month = Number(month);
  if (year) filter.year = Number(year);
  if (employee) filter.employee = employee;

  const salaries = await Salary.find(filter)
    .populate("employee", "name labourId employeeType wagesSubCategory")
    .populate("site", "name")
    .sort({ year: -1, month: -1, createdAt: -1 });

  return apiSuccess(res, 200, salaries);
});
