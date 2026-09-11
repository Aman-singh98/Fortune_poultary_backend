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

const wageMasterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "Wages A"
    // Applies to a PERMANENT rate OR a specific WAGES sub-category
    appliesTo: {
      type: String,
      enum: ["PERMANENT", "CONSTRUCTION_LABOUR", "PAINTER", "MAINTENANCE", "ELECTRICIAN"],
      required: true,
    },
    dayRate: { type: Number, required: true, min: 0 }, // per day (or per-month equivalent for permanent, per doc)
    overtimeRatePerHour: { type: Number, required: true, min: 0, default: 0 },
    yearlyIncrementPercent: { type: Number, min: 0, default: 0 },
    // Egg/Bird sales incentive rates (flat rate per unit sold). Slab-based rates are an
    // open point per the requirement doc (Sec. 8) — flat-per-unit is the default until confirmed.
    eggCommissionRate: { type: Number, min: 0, default: 0 },
    birdCommissionRate: { type: Number, min: 0, default: 0 },
    site: { type: mongoose.Schema.Types.ObjectId, ref: "Site", default: null }, // null = applies across sites
    rateHistory: [rateHistoryEntry],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("WageMaster", wageMasterSchema);
