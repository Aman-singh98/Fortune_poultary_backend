import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import Holiday from "../models/Holiday.js";
import Salary from "../models/Salary.js";
import SalaryLedgerEntry from "../models/SalaryLedgerEntry.js";

// Maps a ledger entry's type to the Salary model's deduction `type` enum, and
// prefixes the remark so its origin stays visible on the payslip even once it's
// just another line in `deductions`.
const LEDGER_DEDUCTION_LABEL = {
  DAILY_DEDUCTION: { salaryType: "EXPENSE", prefix: "Daily Deduction (Birds/Eggs)" },
  ADVANCE: { salaryType: "ADVANCE", prefix: "Advance" },
  FINE: { salaryType: "FINE", prefix: "Fine" },
};

function monthRange(month, year) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1); // exclusive
  return { start, end };
}

function dateKey(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;
}

function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

/**
 * Computes the effective amount a single deduction entry subtracts from gross earning.
 * Fixed deductions subtract `amount` directly; percentage-based deductions (only
 * meaningful for FINE per the requirement doc) subtract amount% of gross earning.
 */
export function deductionEffectiveAmount(deduction, grossEarning) {
  if (deduction.isPercentage) {
    return Math.round(((grossEarning * deduction.amount) / 100) * 100) / 100;
  }
  return deduction.amount;
}

/**
 * Recomputes totalIncentives, totalDeductions and netSalary on a Salary document
 * from its current incentives/deductions arrays + grossEarning. Does not save.
 * Net salary = grossEarning + totalIncentives - totalDeductions.
 */
function recomputeTotals(salaryDoc) {
  const totalDeductions = salaryDoc.deductions.reduce(
    (sum, d) => sum + deductionEffectiveAmount(d, salaryDoc.grossEarning),
    0
  );
  const totalIncentives = (salaryDoc.incentives || []).reduce((sum, i) => sum + i.amount, 0);

  salaryDoc.totalDeductions = Math.round(totalDeductions * 100) / 100;
  salaryDoc.totalIncentives = Math.round(totalIncentives * 100) / 100;
  salaryDoc.netSalary =
    Math.round((salaryDoc.grossEarning + salaryDoc.totalIncentives - salaryDoc.totalDeductions) * 100) / 100;
}

/**
 * Calculates (and upserts) a single employee's monthly salary from their attendance
 * records for the month, the linked Wage Master's rates, and the site's approved
 * Holiday calendar (absences/attendance falling on an approved holiday for the
 * employee's site are treated as paid — no deduction).
 *
 * If a Salary document already exists for this employee/month/year, its earnings
 * and attendance summary are recalculated but any deductions already recorded on
 * it are preserved (re-generating a salary does not wipe out advances/fines/expenses
 * already logged against it).
 */
export async function calculateMonthlySalary(employeeId, month, year, actingUserId) {
  const employee = await Employee.findById(employeeId).populate("wageMaster").populate("site");
  if (!employee) {
    const err = new Error("Employee not found");
    err.statusCode = 404;
    throw err;
  }
  if (!employee.wageMaster && !employee.basicSalary) {
    const err = new Error(
      "This employee has no Basic Salary or Wage Master assigned — cannot calculate salary."
    );
    err.statusCode = 400;
    throw err;
  }

  const { start, end } = monthRange(month, year);

  // Basic Salary (when set) drives the per-day rate — this is the primary path for
  // permanent employees. Overtime/commission rates still come from the Wage Master
  // when one is also assigned; otherwise they default to 0.
  const dayRate = employee.basicSalary
    ? Math.round((employee.basicSalary / daysInMonth(month, year)) * 100) / 100
    : employee.wageMaster.dayRate;
  const otRate = employee.wageMaster?.overtimeRatePerHour || 0;
  const eggRate = employee.wageMaster?.eggCommissionRate || 0;
  const birdRate = employee.wageMaster?.birdCommissionRate || 0;

  const [attendanceRecords, approvedHolidays] = await Promise.all([
    Attendance.find({ employee: employee._id, date: { $gte: start, $lt: end } }),
    Holiday.find({
      status: "APPROVED",
      sites: employee.site._id,
      date: { $gte: start, $lt: end },
    }),
  ]);

  const holidayDateSet = new Set(approvedHolidays.map((h) => dateKey(h.date)));

  const summary = {
    presentDays: 0,
    halfDays: 0,
    presentX2Days: 0,
    presentHalfDays: 0,
    absentDays: 0,
    leaveDays: 0,
    holidayDays: 0,
    overtimeHours: 0,
  };

  let baseWage = 0;
  let overtimeHoursTotal = 0;
  let eggsSoldTotal = 0;
  let birdsSoldTotal = 0;

  for (const rec of attendanceRecords) {
    overtimeHoursTotal += rec.overtimeHours || 0;
    eggsSoldTotal += rec.eggsSold || 0;
    birdsSoldTotal += rec.birdsSold || 0;

    const onApprovedHoliday = holidayDateSet.has(dateKey(rec.date));

    switch (rec.status) {
      case "PRESENT":
      case "OVERTIME": // OVERTIME is logged as the day's status alongside overtimeHours
        summary.presentDays += 1;
        baseWage += dayRate;
        break;
      case "HALF_DAY":
        summary.halfDays += 1;
        baseWage += dayRate * 0.5;
        break;
      case "PRESENT_X2":
        summary.presentX2Days += 1;
        baseWage += dayRate * 2;
        break;
      case "PRESENT_HALF":
        summary.presentHalfDays += 1;
        baseWage += dayRate * 1.5;
        break;
      case "LEAVE":
        // Approved leave — no deduction per requirement doc Sec. 3.2/5.
        summary.leaveDays += 1;
        baseWage += dayRate;
        break;
      case "HOLIDAY":
        summary.holidayDays += 1;
        baseWage += dayRate;
        break;
      case "ABSENT":
        summary.absentDays += 1;
        if (onApprovedHoliday) {
          // National Holiday — No Deduction Rule (Sec. 4.3): absence on an approved
          // holiday for this site does not reduce salary.
          summary.holidayDays += 1;
          baseWage += dayRate;
        }
        break;
      case "SUNDAY":
        // Sunday paid/unpaid policy is an open point (Sec. 8) — left unpaid (no
        // wage contribution, no deduction) until the client confirms site policy.
        break;
      default:
        break;
    }
  }

  const overtimePay = overtimeHoursTotal * otRate;
  const salesCommission = eggsSoldTotal * eggRate + birdsSoldTotal * birdRate;

  summary.overtimeHours = overtimeHoursTotal;

  // Pull in every daily-ledger entry (daily deductions, advances, fines, travel) that
  // was logged against this person for this exact pay period and hasn't yet been
  // applied to a salary. Regenerating a salary for the same month is therefore safe —
  // already-settled entries are skipped and never re-applied or double-counted.
  const pendingLedgerEntries = await SalaryLedgerEntry.find({
    employee: employee._id,
    month,
    year,
    status: "PENDING",
  });

  let newTravelAllowance = 0;
  const newLedgerTotals = { dailyDeduction: 0, advance: 0, fine: 0 };
  const ledgerDeductions = [];
  for (const entry of pendingLedgerEntries) {
    if (entry.type === "TRAVEL") {
      newTravelAllowance += entry.amount;
      continue;
    }
    const mapping = LEDGER_DEDUCTION_LABEL[entry.type];
    ledgerDeductions.push({
      type: mapping.salaryType,
      amount: entry.amount,
      isPercentage: false,
      remark: `[${mapping.prefix}] ${entry.remark}`,
      addedBy: actingUserId,
      addedAt: entry.date,
    });
    if (entry.type === "DAILY_DEDUCTION") newLedgerTotals.dailyDeduction += entry.amount;
    else if (entry.type === "ADVANCE") newLedgerTotals.advance += entry.amount;
    else if (entry.type === "FINE") newLedgerTotals.fine += entry.amount;
  }
  newTravelAllowance = Math.round(newTravelAllowance * 100) / 100;

  let salary = await Salary.findOne({ employee: employee._id, month, year });

  // Travel allowance already folded into an earlier generate for this pay
  // period is preserved and added to here rather than overwritten — those
  // TRAVEL entries are already marked SETTLED by the time of a regenerate, so
  // they'd never show up in `pendingLedgerEntries` again. Without carrying the
  // previous total forward, a regenerate (e.g. after fixing an attendance
  // mistake) would silently wipe out travel allowance from any earlier run.
  const previousTravelAllowance = salary?.earnings?.travelAllowance || 0;
  const travelAllowance = Math.round((previousTravelAllowance + newTravelAllowance) * 100) / 100;

  // Same carry-forward reasoning as travelAllowance above: entries already
  // folded into an earlier generate for this period are SETTLED by now and
  // won't reappear in `pendingLedgerEntries`, so the previous totals have to
  // be added to rather than replaced.
  const prevLedgerTotals = salary?.ledgerTotals || {};
  const ledgerTotals = {
    dailyDeduction:
      Math.round(((prevLedgerTotals.dailyDeduction || 0) + newLedgerTotals.dailyDeduction) * 100) / 100,
    advance: Math.round(((prevLedgerTotals.advance || 0) + newLedgerTotals.advance) * 100) / 100,
    fine: Math.round(((prevLedgerTotals.fine || 0) + newLedgerTotals.fine) * 100) / 100,
    travel: travelAllowance,
  };

  const grossEarning =
    Math.round((baseWage + overtimePay + salesCommission + travelAllowance) * 100) / 100;

  if (!salary) {
    salary = new Salary({
      employee: employee._id,
      site: employee.site._id,
      month,
      year,
      incentives: [],
      deductions: [],
      generatedBy: actingUserId,
    });
  } else {
    salary.generatedBy = actingUserId;
    salary.generatedAt = new Date();
  }

  salary.earnings = {
    baseWage: Math.round(baseWage * 100) / 100,
    overtimePay: Math.round(overtimePay * 100) / 100,
    salesCommission: Math.round(salesCommission * 100) / 100,
    travelAllowance,
  };
  salary.ledgerTotals = ledgerTotals;
  salary.grossEarning = grossEarning;
  salary.attendanceSummary = summary;
  if (ledgerDeductions.length) {
    salary.deductions.push(...ledgerDeductions);
  }

  recomputeTotals(salary);

  await salary.save();

  if (pendingLedgerEntries.length) {
    await SalaryLedgerEntry.updateMany(
      { _id: { $in: pendingLedgerEntries.map((e) => e._id) } },
      { $set: { status: "SETTLED", salary: salary._id } }
    );
  }

  return salary;
}

/**
 * Appends an incentive/expense entry (bonus, incentive, or expense reimbursement
 * paid to the employee) to an existing Salary document, requiring a mandatory
 * remark, and recomputes net salary. Unlike deductions, these ADD to net salary.
 */
export async function addIncentive(salaryId, { type, amount, remark }, actingUserId) {
  const salary = await Salary.findById(salaryId);
  if (!salary) {
    const err = new Error("Salary record not found");
    err.statusCode = 404;
    throw err;
  }

  salary.incentives.push({
    type,
    amount,
    remark,
    addedBy: actingUserId,
    addedAt: new Date(),
  });

  recomputeTotals(salary);

  await salary.save();
  return salary;
}

/**
 * Appends a deduction (Advance / Fine / Expense) to an existing Salary document,
 * requiring a mandatory remark, and recomputes net salary.
 */
export async function addDeduction(salaryId, { type, amount, isPercentage, remark }, actingUserId) {
  const salary = await Salary.findById(salaryId);
  if (!salary) {
    const err = new Error("Salary record not found");
    err.statusCode = 404;
    throw err;
  }

  salary.deductions.push({
    type,
    amount,
    isPercentage: !!isPercentage,
    remark,
    addedBy: actingUserId,
    addedAt: new Date(),
  });

  recomputeTotals(salary);

  await salary.save();
  return salary;
}
