import mongoose from "mongoose";

const stockSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    site: { type: mongoose.Schema.Types.ObjectId, ref: "Site", required: true }, // one store per site (RA v2.0 Sec. 8, point 10 — unchanged)
    quantity: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true }
);

// One running-balance document per item, per site.
stockSchema.index({ item: 1, site: 1 }, { unique: true });

export default mongoose.model("Stock", stockSchema);
