import User from "../models/User.js";
import { asyncHandler, apiSuccess } from "../utils/apiResponse.js";

// GET /api/users?role=&site=&isActive= — a lightweight directory, not a full
// user-management endpoint. Needed by the frontend to populate pickers like
// Gate Pass's mandatory "Approved By" field (RA v2.0 Sec. 7, point 9).
// Only safe, non-sensitive fields are returned; password is already excluded
// via the schema's `select: false`.
export const listUsers = asyncHandler(async (req, res) => {
  const { role, site } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (site) filter.site = site;
  filter.isActive = req.query.isActive === undefined ? true : req.query.isActive === "true";

  const users = await User.find(filter)
    .select("name email role site isActive")
    .populate("site", "name")
    .sort({ name: 1 });

  return apiSuccess(res, 200, users);
});
