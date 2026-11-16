import { Router } from "express";
import {
  register,
  login,
  logout,
  refreshToken,
  verifyEmailOTP,
  resendOTP,
  resetPasswordController,
  forgotPassword,
} from "../controllers/auth.controller.js";
import {
  registerValidator,
  loginValidator,
  resetPasswordValidator,
  forgotPasswordValidator,
} from "../middlewares/validators/auth.validator.js";
import validate from "../middlewares/validate.middleware.js";
import { protect } from "../middlewares/auth.middleware.js";
import {
  loginLimiter,
  otpLimiter,
  registerLimiter,
} from "../middlewares/rateLimit.middleware.js";

const router = Router();

router.post(
  "/register",
  registerLimiter,
  registerValidator,
  validate,
  register,
);
router.post("/login", loginLimiter, loginValidator, validate, login);
router.post("/logout", logout);
router.post("/refresh-token", refreshToken);
router.post("/verify-email", otpLimiter, protect, verifyEmailOTP);
router.post("/resend-otp", otpLimiter, protect, resendOTP);
router.post(
  "/forgot-password",
  otpLimiter,
  forgotPasswordValidator,
  validate,
  forgotPassword,
);
router.post(
  "/reset-password",
  otpLimiter,
  resetPasswordValidator,
  validate,
  resetPasswordController,
);

export default router;
