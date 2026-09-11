import mongoose from "mongoose";

const rateHistoryEntry = new mongoose.Schema(
  {
    oldRate: Number,
    newRate: Number,
    reason: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const employeeSchema = new mongoose.Schema(
  {
    labourId: { type: String, required: true, unique: true }, // e.g. LB1001, auto-generated
    // Separate, human-facing employee code (e.g. EMP1001). Auto-generated if not supplied.
    employeeCode: { type: String, trim: true, unique: true, sparse: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },

    // Designation / job title (e.g. "Site Supervisor", "Accountant").
    designation: { type: String, trim: true, default: "" },
    // Probation period, in months. 0 means not applicable / already confirmed.
    probationPeriod: { type: Number, min: 0, default: 0 },
    remarks: { type: String, trim: true, default: "" },

    // Home/primary site — always required, used as the default site for this employee.
    site: { type: mongoose.Schema.Types.ObjectId, ref: "Site", required: true },
    // When true, the employee can be seen and operated on (attendance/salary) from any site.
    allSites: { type: Boolean, default: false },
    // Additional specific sites this employee can be seen/operated on from,
    // besides their home `site`. Ignored when `allSites` is true.
    sites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Site" }],

    employeeType: {
      type: String,
      enum: ["PERMANENT", "WAGES"],
      required: true,
    },
    // Only relevant when employeeType === WAGES. Extensible list per requirement doc.
    wagesSubCategory: {
      type: String,
      enum: ["CONSTRUCTION_LABOUR", "PAINTER", "MAINTENANCE", "ELECTRICIAN", null],
      default: null,
    },

    // Monthly basic salary — primarily used for PERMANENT employees. When set, salary
    // calculation derives a per-day rate from this instead of the Wage Master's day rate.
    basicSalary: { type: Number, min: 0, default: 0 },

    // Required for WAGES employees so salary calculation always has a rate to work from.
    // Optional for PERMANENT employees when basicSalary is set (basicSalary takes over
    // the day-rate calculation), but can still be used for overtime/commission rates.
    wageMaster: { type: mongoose.Schema.Types.ObjectId, ref: "WageMaster" },

    isActive: { type: Boolean, default: true },
    photoUrl: { type: String, default: null },

    // Individual manual rate overrides can also be tracked at the employee level
    rateHistory: [rateHistoryEntry],
  },
  { timestamps: true }
);

employeeSchema.pre("validate", function (next) {
  if (this.employeeType === "WAGES" && !this.wagesSubCategory) {
    return next(new Error("wagesSubCategory is required when employeeType is WAGES"));
  }
  if (this.employeeType === "PERMANENT") {
    this.wagesSubCategory = null;
  }
  if (this.employeeType === "WAGES" && !this.wageMaster) {
    return next(new Error("wageMaster is required for WAGES employees"));
  }
  if (this.employeeType === "PERMANENT" && !this.wageMaster && !this.basicSalary) {
    return next(new Error("Either basicSalary or a wageMaster is required for permanent employees"));
  }
  if (this.allSites) {
    // allSites already covers every site — an explicit sites list would be redundant.
    this.sites = [];
  }
  next();
});

export default mongoose.model("Employee", employeeSchema);
