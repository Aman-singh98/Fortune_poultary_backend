import mongoose from "mongoose";

const itemSchema = new mongoose.Schema(
  {
    itemCode: { type: String, required: true, unique: true, trim: true, uppercase: true }, // e.g. ITM1001, auto-generated
    name: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    subCategory: { type: String, trim: true },
    unit: { type: String, required: true, trim: true }, // Kg, Bag, Nos., Ltr., etc.

    minStockLevel: { type: Number, min: 0, default: 0 },
    reorderLevel: { type: Number, min: 0, default: 0 },
    maxStockLevel: { type: Number, min: 0, default: 0 },

    preferredVendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", default: null },
    standardRate: { type: Number, min: 0, default: 0 },

    // Confirmed required at Item level as well as Quotation/PO level
    // (RA v2.0 Sec. 8, point 6).
    gstPercent: { type: Number, min: 0, max: 100, default: 0 },
    hsnCode: { type: String, trim: true },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Item", itemSchema);
