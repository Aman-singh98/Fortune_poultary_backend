import mongoose from "mongoose";

const deductionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["ADVANCE", "FINE", "EXPENSE"], required: true },
    amount: { type: Number, required: true, min: 0 },
    isPercentage: { type: Boolean, default: false }, // relevant for FINE
    remark: { type: String, required: true, trim: true }, // mandatory reason
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const incentiveSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["INCENTIVE", "EXPENSE"], required: true },
    amount: { type: Number, required: true, min: 0 },
    remark: { type: String, required: true, trim: true }, // mandatory reason
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const salarySchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    site: { type: mongoose.Schema.Types.ObjectId, ref: "Site", required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },

    earnings: {
      baseWage: { type: Number, default: 0 },
      overtimePay: { type: Number, default: 0 },
      salesCommission: { type: Number, default: 0 },
      // Sum of TRAVEL ledger entries (km x rate/km) for this pay period — see
      // SalaryLedgerEntry / services/salaryService.js.
      travelAllowance: { type: Number, default: 0 },
    },
    grossEarning: { type: Number, default: 0 },

    // Running totals of every SalaryLedgerEntry (Daily Deduction / Advance /
    // Fine / Travel) folded into this salary for this pay period, kept apart
    // from `deductions`/`earnings.travelAllowance` purely so the UI can show
    // a clean "Daily Deduction, Advance, Fine & Travel" breakdown without
    // having to reverse-engineer it from remark text. Travel mirrors
    // earnings.travelAllowance. Carried forward across regenerates the same
    // way travelAllowance is (see calculateMonthlySalary).
    ledgerTotals: {
      dailyDeduction: { type: Number, default: 0 },
      advance: { type: Number, default: 0 },
      fine: { type: Number, default: 0 },
      travel: { type: Number, default: 0 },
    },

    incentives: [incentiveSchema],
    totalIncentives: { type: Number, default: 0 },

    deductions: [deductionSchema],
    totalDeductions: { type: Number, default: 0 },

    netSalary: { type: Number, default: 0 },

    attendanceSummary: {
      presentDays: { type: Number, default: 0 },
      halfDays: { type: Number, default: 0 },
      presentX2Days: { type: Number, default: 0 },
      presentHalfDays: { type: Number, default: 0 },
      absentDays: { type: Number, default: 0 },
      leaveDays: { type: Number, default: 0 },
      holidayDays: { type: Number, default: 0 },
      overtimeHours: { type: Number, default: 0 },
    },

    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

salarySchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });

export default mongoose.model("Salary", salarySchema);
