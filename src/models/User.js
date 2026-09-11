import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// ---------------------------------------------------------------------------
// Roles & scope (see Stock, Purchase & Inventory RA v2.0 Sec. 4, and the Dev
// Task List Sec. 2.1 / Sec. 5).
//
//   SUPER_ADMIN       — global. System-wide administration, every module.
//   ADMIN              — site-scoped. Raises Item Requirements / Purchase
//                         Requisitions, generates Item Issue Slips, own site only.
//   MANAGEMENT         — global. The two approval gates: Purchase Requisition
//                         approval and Quotation/vendor-selection approval.
//   PURCHASE_MANAGER   — global. Views approved Purchase Requisitions only,
//                         raises RFQs/Quotations, view-only on PO & Receiving.
//                         Global because purchasing is a central function, not
//                         run per-site — see Task List Sec. 5 if this needs
//                         revisiting once the client confirms.
//   ACCOUNTS           — global. Creates Purchase Orders, records Goods
//                         Receipts, records/matches Bills, processes payment.
//   STORE_KEEPER       — site-scoped. Physically receives goods and verifies
//                         Returnable Gate Pass material at a specific site's
//                         store/gate, so (unlike Purchasing/Accounts/
//                         Management) this role IS tied to one site.
//
// Roles requiring a site: ADMIN, STORE_KEEPER.
// Roles that must NOT have a site: SUPER_ADMIN, MANAGEMENT, PURCHASE_MANAGER, ACCOUNTS.
// ---------------------------------------------------------------------------
const SITE_SCOPED_ROLES = ["ADMIN", "STORE_KEEPER"];
const GLOBAL_ROLES = ["SUPER_ADMIN", "MANAGEMENT", "PURCHASE_MANAGER", "ACCOUNTS"];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: {
      type: String,
      enum: [...SITE_SCOPED_ROLES, ...GLOBAL_ROLES],
      required: true,
    },
    designation: { type: String, trim: true }, // e.g. "HR Executive" for Sumit
    // Site-scoped roles (ADMIN, STORE_KEEPER) must have exactly one site.
    // Global roles (SUPER_ADMIN, MANAGEMENT, PURCHASE_MANAGER, ACCOUNTS) leave this null.
    site: { type: mongoose.Schema.Types.ObjectId, ref: "Site", default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Site-scoped roles (Admin, Store Keeper) must be tied to a site;
// global roles (Super Admin, Management, Purchase Manager, Accounts) must not be.
userSchema.pre("validate", function (next) {
  if (SITE_SCOPED_ROLES.includes(this.role) && !this.site) {
    return next(new Error(`${this.role} users must be assigned to a site`));
  }
  if (GLOBAL_ROLES.includes(this.role)) {
    this.site = null;
  }
  next();
});

export const ROLES = { SITE_SCOPED: SITE_SCOPED_ROLES, GLOBAL: GLOBAL_ROLES };
export default mongoose.model("User", userSchema);
