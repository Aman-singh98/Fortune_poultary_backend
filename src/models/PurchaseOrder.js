import mongoose from "mongoose";

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: { type: String, required: true, unique: true, trim: true, uppercase: true }, // e.g. PO1001, auto-generated
    poDate: { type: Date, default: Date.now },

    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
    prRef: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseRequisition", required: true },
    quotationRef: { type: mongoose.Schema.Types.ObjectId, ref: "Quotation", required: true }, // must be `selected: true`

    item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    quantity: { type: Number, required: true, min: 0 },
    rate: { type: Number, required: true, min: 0 },
    discount: { type: Number, min: 0, default: 0 },

    // Required at PO level as well as Item level (RA v2.0 Sec. 8, point 6).
    gst: { type: Number, min: 0, default: 0 },
    hsnCode: { type: String, trim: true },

    freight: { type: Number, min: 0, default: 0 },
    otherCharges: { type: Number, min: 0, default: 0 },
    totalAmount: { type: Number, min: 0, default: 0 }, // computed by landedCostService, same formula as Quotation

    deliveryLocation: { type: String, trim: true },
    deliveryDate: { type: Date },
    paymentTerms: { type: String, trim: true },
    specialInstructions: { type: String, trim: true },

    // No separate PO approval gate is implemented by default — see RA v2.0
    // Sec. 9 (OP-7) and Dev Task List Sec. 5. status here just tracks
    // fulfilment, not an approval decision, unless OP-7 is confirmed otherwise.
    status: { type: String, enum: ["OPEN", "CLOSED", "CANCELLED"], default: "OPEN" },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Accounts
  },
  { timestamps: true }
);

export default mongoose.model("PurchaseOrder", purchaseOrderSchema);
