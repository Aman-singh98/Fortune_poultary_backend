import mongoose from "mongoose";

const goodsReceiptSchema = new mongoose.Schema(
  {
    grnNumber: { type: String, required: true, unique: true, trim: true, uppercase: true }, // e.g. GRN1001, auto-generated
    grnDate: { type: Date, default: Date.now },

    poRef: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseOrder", required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
    site: { type: mongoose.Schema.Types.ObjectId, ref: "Site", required: true },

    vehicleNumber: { type: String, trim: true },
    invoiceNumber: { type: String, trim: true },

    item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    orderedQuantity: { type: Number, required: true, min: 0 },
    receivedQuantity: { type: Number, required: true, min: 0 },

    // Accepted/rejected quantities are verified and confirmed by the Store
    // Keeper only (RA v2.0 Sec. 8, point 7) — enforced in the controller.
    acceptedQuantity: { type: Number, min: 0, default: 0 },
    rejectedQuantity: { type: Number, min: 0, default: 0 },
    shortExcessQuantity: { type: Number, default: 0 }, // receivedQuantity - orderedQuantity

    batchLotNumber: { type: String, trim: true },
    qualityStatus: { type: String, enum: ["PENDING", "PASSED", "FAILED"], default: "PENDING" },
    storeLocation: { type: String, trim: true },

    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // Store Keeper
  },
  { timestamps: true }
);

export default mongoose.model("GoodsReceipt", goodsReceiptSchema);
