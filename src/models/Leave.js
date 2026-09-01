import mongoose from "mongoose";

const leaveSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    site: { type: mongoose.Schema.Types.ObjectId, ref: "Site", required: true },

    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    reason: { type: String, trim: true },

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },

    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    decidedAt: { type: Date, default: null },
    decisionRemark: { type: String, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model("Leave", leaveSchema);
