import mongoose from "mongoose";

const holidaySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    date: { type: Date, required: true },

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },

    // Sites this holiday applies to once approved. Not automatic across all sites.
    sites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Site" }],

    proposedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Holiday", holidaySchema);
