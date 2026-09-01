import mongoose from "mongoose";

const purchaseRequisitionSchema = new mongoose.Schema(
  {
    prNumber: { type: String, required: true, unique: true, trim: true, uppercase: true }, // e.g. PR1001, auto-generated

    // Optional link back to the Item Requirement that triggered this PR
    // (Path B — item not in stock). A PR can also be raised standalone.
    requirement: { type: mongoose.Schema.Types.ObjectId, ref: "ItemRequirement", default: null },

    department: { type: String, required: true, trim: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    site: { type: mongoose.Schema.Types.ObjectId, ref: "Site", required: true },

    item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    quantity: { type: Number, required: true, min: 0 },
    requiredDate: { type: Date, required: true },
    purpose: { type: String, trim: true },
    priority: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], default: "MEDIUM" },

    // Management is the sole approval gate for a PR (RA v2.0 Sec. 5, Sec. 8 point 1/2).
    // Purchase Manager may only raise an RFQ against an APPROVED requisition
    // (RA v2.0 Sec. 8, point 3) — enforced in the controller, not here.
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    decidedAt: { type: Date, default: null },
    decisionRemark: { type: String, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model("PurchaseRequisition", purchaseRequisitionSchema);
