import jwt from "jsonwebtoken";
import User, { ROLES } from "../models/User.js";

// ---------------------------------------------------------------------------
// Roles in this system (see models/User.js for the enforced enum/scope rules):
//
//   SUPER_ADMIN       — global  — full system administration, every module.
//   ADMIN              — site   — HR modules + raises Item Requirements/PRs,
//                                  Item Issue Slips, for their own site only.
//   MANAGEMENT         — global — approves Purchase Requisitions and
//                                  Quotations/vendor selection.
//   PURCHASE_MANAGER   — global — approved-PR visibility only, raises RFQs
//                                  and Quotations, view-only on PO/Receiving.
//   ACCOUNTS           — global — creates Purchase Orders, records Goods
//                                  Receipts, records/matches Bills.
//   STORE_KEEPER       — site   — verifies Goods Receipt and Returnable Gate
//                                  Pass quantities at their own site's store.
//
// authorize(...roles) below accepts any subset of these; enforceSiteScope()
// is a no-op for global roles and applies for the two site-scoped roles.
// ---------------------------------------------------------------------------

/**
 * Verifies the JWT from the Authorization header and attaches the user to req.user.
 */
export async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.split(" ")[1] : null;

    if (!token) {
      return res.status(401).json({ success: false, message: "Not authenticated. No token provided." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: "User no longer exists or is inactive." });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token." });
  }
}

/**
 * Restricts a route to specific roles, e.g. authorize("SUPER_ADMIN")
 */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "You do not have permission to perform this action." });
    }
    next();
  };
}

/**
 * Ensures a site-scoped user (Admin, Store Keeper) can only touch data
 * belonging to their own site. Every global role (Super Admin, Management,
 * Purchase Manager, Accounts) bypasses this check entirely.
 *
 * Usage patterns supported:
 *  - req.params.siteId
 *  - req.body.site
 *  - req.query.site
 * If none of these are present, the route handler is responsible for
 * scoping the DB query itself (e.g. using req.user.site).
 */
export function enforceSiteScope(req, res, next) {
  if (ROLES.GLOBAL.includes(req.user.role)) return next();

  const targetSite =
    req.params.siteId || req.body.site || req.query.site || null;

  if (targetSite && String(targetSite) !== String(req.user.site)) {
    return res.status(403).json({
      success: false,
      message: "You can only access data for your own assigned site.",
    });
  }

  next();
}
