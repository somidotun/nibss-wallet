import { Router } from "express";
import {
  register,
  login,
  logout,
  refreshToken,
  verifyEmailOTP,
  resendOTP,
} from "../controllers/auth.controller.js";
import {
  registerValidator,
  loginValidator,
} from "../middlewares/validators/auth.validator.js";
import validate from "../middlewares/validate.middleware.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/register", registerValidator, validate, register);
router.post("/login", loginValidator, validate, login);
router.post("/logout", logout);
router.post("/refresh-token", refreshToken);
router.post("/verify-email", protect, verifyEmailOTP);
router.post("/resend-otp", protect, resendOTP);

export default router;
