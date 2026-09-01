import mongoose from "mongoose";

const rfqLineItemSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    quantity: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const rfqSchema = new mongoose.Schema(
  {
    rfqNumber: { type: String, required: true, unique: true, trim: true, uppercase: true }, // e.g. RFQ1001, auto-generated

    // Must reference an APPROVED Purchase Requisition — enforced in the
    // controller (RA v2.0 Sec. 8, point 3). One PR may have several RFQs
    // (one per vendor it's sent to).
    prRef: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseRequisition", required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },

    items: { type: [rfqLineItemSchema], required: true, validate: (v) => v.length > 0 },

    expectedDeliveryDate: { type: Date },
    quotationDueDate: { type: Date },
    termsAndConditions: { type: String, trim: true },

    status: { type: String, enum: ["OPEN", "CLOSED"], default: "OPEN" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Purchase Manager
  },
  { timestamps: true }
);

export default mongoose.model("Rfq", rfqSchema);
