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
    },
    grossEarning: { type: Number, default: 0 },

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
