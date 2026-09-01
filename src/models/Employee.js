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
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    site: { type: mongoose.Schema.Types.ObjectId, ref: "Site", required: true },

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

    // Required so salary calculation always has a rate to work from.
    wageMaster: { type: mongoose.Schema.Types.ObjectId, ref: "WageMaster", required: true },

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
  next();
});

export default mongoose.model("Employee", employeeSchema);
