import mongoose from "mongoose";

const billSchema = new mongoose.Schema(
  {
    poRef: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseOrder", required: true },
    grnRef: { type: mongoose.Schema.Types.ObjectId, ref: "GoodsReceipt", default: null },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },

    billNumber: { type: String, required: true, trim: true },
    invoiceDate: { type: Date, required: true },
    irn: { type: String, trim: true }, // plain text field only (RA v1.0 OP-2) — no live GST e-invoicing
    amount: { type: Number, required: true, min: 0 },

    // 3-way match: PO qty/rate vs GRN accepted qty vs Bill amount.
    // Handled jointly by this module and the Accounts module (RA v2.0 Sec. 8, point 8).
    matchStatus: { type: String, enum: ["PENDING", "MATCHED", "MISMATCH"], default: "PENDING" },
    matchNotes: { type: String, trim: true },

    paymentStatus: { type: String, enum: ["UNPAID", "PAID"], default: "UNPAID" },
    paidAt: { type: Date, default: null },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Accounts
  },
  { timestamps: true }
);

export default mongoose.model("Bill", billSchema);
