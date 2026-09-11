import mongoose from "mongoose";

// Singleton document holding the current site-wide travel rate (₹/km). Individual
// TRAVEL ledger entries snapshot this rate at the moment they're logged, so changing
// it here only ever affects trips logged *after* the change — past entries, and any
// salary already generated from them, are untouched.
const travelRateSettingSchema = new mongoose.Schema(
  {
    ratePerKm: { type: Number, required: true, min: 0, default: 3.5 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

travelRateSettingSchema.statics.getSingleton = async function () {
  let doc = await this.findOne();
  if (!doc) doc = await this.create({ ratePerKm: 3.5 });
  return doc;
};

export default mongoose.model("TravelRateSetting", travelRateSettingSchema);
