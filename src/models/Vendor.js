import mongoose from "mongoose";

const vendorSchema = new mongoose.Schema(
  {
    vendorCode: { type: String, required: true, unique: true, trim: true, uppercase: true }, // e.g. VEN1001, auto-generated
    name: { type: String, required: true, trim: true },
    contactPerson: { type: String, trim: true },
    mobile: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },

    gstNumber: { type: String, trim: true, uppercase: true },
    pan: { type: String, trim: true, uppercase: true },
    bankDetails: {
      accountName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      ifsc: { type: String, trim: true, uppercase: true },
      bankName: { type: String, trim: true },
    },

    paymentTerms: { type: String, trim: true }, // e.g. "Net 30"
    creditDays: { type: Number, min: 0, default: 0 },
    category: { type: String, trim: true },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Vendor", vendorSchema);
