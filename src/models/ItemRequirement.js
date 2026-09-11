import mongoose from "mongoose";

const itemRequirementSchema = new mongoose.Schema(
  {
    department: { type: String, required: true, trim: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    quantity: { type: Number, required: true, min: 0 },
    site: { type: mongoose.Schema.Types.ObjectId, ref: "Site", required: true },

    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // FULFILLED = fully covered by Issue Slip(s); PARTIAL = some quantity issued,
    // shortfall pushed to a linked Purchase Requisition (RA v2.0 Sec. 8, OP-5 pattern).
    status: {
      type: String,
      enum: ["PENDING", "PARTIAL", "FULFILLED"],
      default: "PENDING",
    },

    // How much of `quantity` has been issued out so far via ItemIssueSlip records.
    quantityIssued: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("ItemRequirement", itemRequirementSchema);
