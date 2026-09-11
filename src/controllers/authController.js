import { z } from "zod";
import User from "../models/User.js";
import { generateToken } from "../utils/generateToken.js";
import { asyncHandler, apiError, apiSuccess } from "../utils/apiResponse.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const login = asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return apiError(res, 400, "Invalid login payload", parsed.error.flatten());
  }
  const { email, password } = parsed.data;

  const user = await User.findOne({ email }).select("+password").populate("site", "name");
  if (!user || !user.isActive) {
    return apiError(res, 401, "Invalid email or password");
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return apiError(res, 401, "Invalid email or password");
  }

  const token = generateToken(user);
  const safeUser = user.toObject();
  delete safeUser.password;

  return apiSuccess(res, 200, { token, user: safeUser }, "Login successful");
});

export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate("site", "name");
  return apiSuccess(res, 200, user);
});
