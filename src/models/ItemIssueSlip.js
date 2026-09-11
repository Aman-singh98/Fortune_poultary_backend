import mongoose from "mongoose";

const itemIssueSlipSchema = new mongoose.Schema(
  {
    issueSlipNumber: { type: String, required: true, unique: true, trim: true, uppercase: true }, // e.g. ISS1001, auto-generated
    requirementRef: { type: mongoose.Schema.Types.ObjectId, ref: "ItemRequirement", required: true },

    item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    quantity: { type: Number, required: true, min: 0 },
    site: { type: mongoose.Schema.Types.ObjectId, ref: "Site", required: true },

    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Admin
    issuedTo: { type: String, trim: true }, // department / person the item was handed to
  },
  { timestamps: true }
);

export default mongoose.model("ItemIssueSlip", itemIssueSlipSchema);
