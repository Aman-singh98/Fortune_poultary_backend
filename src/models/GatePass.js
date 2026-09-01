import mongoose from "mongoose";

// Field list sourced verbatim from the client's Returnable_gate_pass_requirement.xlsx
// (see RA v2.0 Sec. 7). Used when material leaves a site expecting to come
// back — repair, job-work, on-approval — as distinct from a normal Item Issue.
const gatePassSchema = new mongoose.Schema(
  {
    gatePassNumber: { type: String, required: true, unique: true, trim: true, uppercase: true }, // e.g. GP1001, auto-generated
    dateTime: { type: Date, default: Date.now },

    department: { type: String, trim: true },
    partyOrVendorName: { type: String, trim: true },
    vehicleNumber: { type: String, trim: true },
    driverName: { type: String, trim: true },
    driverMobile: { type: String, trim: true },

    item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", default: null },
    materialName: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, trim: true },

    purpose: { type: String, trim: true }, // e.g. repair, job-work, on approval
    returnExpectedDate: { type: Date },
    actualReturnDate: { type: Date, default: null },

    conditionAtDispatch: { type: String, trim: true },
    conditionAtReturn: { type: String, trim: true },

    site: { type: mongoose.Schema.Types.ObjectId, ref: "Site", required: true },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Client's own field list includes both Approved By and Security
    // Verification — taken as confirmation that both are required
    // (RA v2.0 Sec. 7, point 9).
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    securityVerification: { type: Boolean, default: false },
    securityVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    securityVerifiedAt: { type: Date, default: null },

    materialReturned: { type: Boolean, default: false },
    returnQuantity: { type: Number, min: 0, default: 0 },
    receiverNameSignature: { type: String, trim: true },

    remarks: { type: String, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model("GatePass", gatePassSchema);
