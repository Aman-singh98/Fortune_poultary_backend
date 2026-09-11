import mongoose from "mongoose";

// A single day-to-day money entry against an employee/labour person, logged as it
// happens (birds/eggs bought on credit, an advance handed out, a fine, or a travel
// trip) rather than waiting for month-end salary generation. Each entry carries its
// own mandatory remark and an optional supporting document/photo, and stays PENDING
// until it's automatically pulled into that person's Salary for its month — at which
// point it's marked SETTLED and linked, so it can never be counted twice.
const salaryLedgerEntrySchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    site: { type: mongoose.Schema.Types.ObjectId, ref: "Site", required: true },

    // DAILY_DEDUCTION — e.g. birds/eggs bought by the person on credit, deducted from
    //   salary like an expense.
    // ADVANCE / FINE — mirror the Salary model's existing deduction types.
    // TRAVEL — a reimbursable amount (km x rate) added to salary, not deducted.
    type: {
      type: String,
      enum: ["DAILY_DEDUCTION", "ADVANCE", "FINE", "TRAVEL"],
      required: true,
    },

    date: { type: Date, required: true, default: Date.now },
    // Denormalized from `date` at write time so a person's pay-period entries can be
    // queried directly, and so a later edit to `date` (there isn't one today, but this
    // keeps the door open) can't silently move an already-settled entry's period.
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },

    amount: { type: Number, required: true, min: 0 },

    // Only populated for TRAVEL — km travelled and the rate/km applied, snapshotted at
    // entry time so a future rate change never rewrites already-logged trips.
    km: { type: Number, min: 0, default: null },
    ratePerKm: { type: Number, min: 0, default: null },

    remark: { type: String, required: true, trim: true },

    // Small supporting document/photo (receipt, signed slip, bill), stored in
    // Cloudinary — only the URL/public ID live here, never the raw file bytes.
    document: {
      name: { type: String, default: null },
      mimeType: { type: String, default: null },
      url: { type: String, default: null },
      publicId: { type: String, default: null },
      resourceType: { type: String, default: null },
    },

    // PENDING until pulled into a generated/regenerated Salary for its month/year.
    status: { type: String, enum: ["PENDING", "SETTLED"], default: "PENDING" },
    salary: { type: mongoose.Schema.Types.ObjectId, ref: "Salary", default: null },

    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

salaryLedgerEntrySchema.index({ employee: 1, date: -1 });
salaryLedgerEntrySchema.index({ site: 1, date: -1 });
salaryLedgerEntrySchema.index({ employee: 1, month: 1, year: 1, status: 1 });

export default mongoose.model("SalaryLedgerEntry", salaryLedgerEntrySchema);
