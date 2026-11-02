import User from "../models/user.model.js";
import Wallet from "../models/wallet.model.js";
import {
  generateTokenPair,
  verifyRefreshToken,
  JwtPayload,
} from "../utils/jwt.utils.js";
import { IUser } from "../types/user.types.js";
import { Types } from "mongoose";
import { generateAccountNumber } from "../utils/accountNumber.utils.js";
import { sendVerificationEmail, generateOTP } from "../utils/email.utils.js";
import AppError from "../utils/AppError.js";
import { generateSecureOtp, hashOtp, safeEqual } from "../utils/otp.utils.js";
import { sendPasswordResetEmail } from "../utils/email.utils.js";
import { createNotification } from "./notification.service.js";

// ─── Register ────────────────────────────────────────────────────
export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
}

const RESET_TTL_MS = 10 * 60 * 1000;
const RESET_COOLDOWN_MS = 60 * 1000;
const MAX_RESET_ATTEMPTS = 5;

export const registerUser = async (input: RegisterInput) => {
  const { firstName, lastName, email, phone, password } = input;

  // Check if email already exists
  const existingEmail = await User.findOne({ email });
  if (existingEmail) {
    throw new Error("EMAIL_EXISTS");
  }

  // Check if phone already exists
  const existingPhone = await User.findOne({ phone });
  if (existingPhone) {
    throw new Error("PHONE_EXISTS");
  }

  // Generate OTP
  const otp = generateOTP();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Create user — password is hashed automatically by pre-save hook
  const user = await User.create({
    firstName,
    lastName,
    email,
    phone,
    password,
    emailVerificationOTP: otp,
    emailVerificationOTPExpiry: otpExpiry,
    isEmailVerified: false,
  });

  // Send verification email
  await sendVerificationEmail(email, firstName, otp);

  // Generate tokens
  const payload: JwtPayload = {
    userId: (user._id as Types.ObjectId).toString(),
    role: user.role,
  };

  const tokens = generateTokenPair(payload);

  return { user, tokens };
};

// ─── Login ───────────────────────────────────────────────────────
export interface LoginInput {
  email: string;
  password: string;
}

export const loginUser = async (input: LoginInput) => {
  const { email, password } = input;

  // Find user — explicitly select password since it has select: false
  const user = (await User.findOne({ email }).select(
    "+password",
  )) as IUser | null;

  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  // Check account status
  if (user.status === "frozen") {
    throw new Error("ACCOUNT_FROZEN");
  }

  if (user.status === "suspended") {
    throw new Error("ACCOUNT_SUSPENDED");
  }
  if (!user.isEmailVerified) {
    throw new Error("EMAIL_NOT_VERIFIED");
  }
  // Verify password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new Error("INVALID_CREDENTIALS");
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Generate tokens
  const payload: JwtPayload = {
    userId: (user._id as Types.ObjectId).toString(),
    role: user.role,
  };

  const tokens = generateTokenPair(payload);

  return { user, tokens };
};

// ─── Refresh Token ───────────────────────────────────────────────
export const refreshUserToken = async (refreshToken: string, iat?: number) => {
  // Verify the token first — throws if expired or tampered
  const verified = verifyRefreshToken(refreshToken);

  const user = await User.findById(verified.userId);

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  if (user.status !== "active") {
    throw new Error("ACCOUNT_INACTIVE");
  }

  const tokenIat = verified.iat ?? iat;
  if (
    user.passwordChangedAt &&
    tokenIat &&
    user.passwordChangedAt.getTime() > tokenIat * 1000
  ) {
    throw new Error("SESSION_INVALID");
  }

  const payload: JwtPayload = {
    userId: (user._id as Types.ObjectId).toString(),
    role: user.role,
  };

  const tokens = generateTokenPair(payload);

  return { tokens };
};

// ─── Verify Email ─────────────────────────────────────────────────
export const verifyEmail = async (userId: string, otp: string) => {
  const user = await User.findById(userId).select(
    "+emailVerificationOTP +emailVerificationOTPExpiry",
  );

  if (!user) throw new AppError("User not found", 404);

  if (user.isEmailVerified) {
    throw new AppError("Email already verified", 400);
  }

  if (!user.emailVerificationOTP || !user.emailVerificationOTPExpiry) {
    throw new AppError("No OTP found. Please request a new one.", 400);
  }

  if (new Date() > user.emailVerificationOTPExpiry) {
    throw new AppError("OTP has expired. Please request a new one.", 400);
  }

  if (user.emailVerificationOTP !== otp) {
    throw new AppError("Invalid OTP", 400);
  }

  // Mark as verified and clear OTP
  user.isEmailVerified = true;
  user.emailVerificationOTP = undefined;
  user.emailVerificationOTPExpiry = undefined;
  user.status = "active";
  await user.save();

  // create a wallet for the user
  const accountNumber = await generateAccountNumber();

  // Auto-create wallet for new user
  await Wallet.create({
    userId: user._id,
    accountNumber,
    balance: 50000,
    currency: "NGN",
    dailyTransferLimit: 50000, // Tier 1 limit
  });

  await createNotification({
    userId: user._id,
    type: "welcome",
    title: "Welcome to Nibss Wallet",
    message: "Your email is verified and your wallet is ready with ₦50,000.",
  });

  return user;
};

// ─── Resend OTP ───────────────────────────────────────────────────
export const resendVerificationOTP = async (userId: string) => {
  const user = await User.findById(userId);

  if (!user) throw new AppError("User not found", 404);
  if (user.isEmailVerified) throw new AppError("Email already verified", 400);

  const otp = generateOTP();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

  user.emailVerificationOTP = otp;
  user.emailVerificationOTPExpiry = otpExpiry;
  await user.save();

  await sendVerificationEmail(user.email, user.firstName, otp);

  return user;
};

// ─── Request a reset code ─────────────────────────────────────────
// Never reveals whether the email exists: it just returns quietly
export const requestPasswordReset = async (email: string): Promise<void> => {
  const user = await User.findOne({ email }).select("+passwordResetExpiry");
  if (!user || !user.isEmailVerified || user.status !== "active") return;

  // One code per minute per account
  const issuedAt = user.passwordResetExpiry
    ? user.passwordResetExpiry.getTime() - RESET_TTL_MS
    : 0;
  if (Date.now() - issuedAt < RESET_COOLDOWN_MS) return;

  const otp = generateSecureOtp();
  user.passwordResetToken = hashOtp(otp);
  user.passwordResetExpiry = new Date(Date.now() + RESET_TTL_MS);
  user.passwordResetAttempts = 0;
  await user.save();

  try {
    await sendPasswordResetEmail(user.email, user.firstName, otp);
  } catch (error) {
    // Do not let an email failure change the response and leak that the account exists
    console.error(
      "Password reset email failed:",
      error instanceof Error ? error.message : error,
    );
  }
};

// ─── Reset the password ───────────────────────────────────────────
export const resetPassword = async (
  email: string,
  otp: string,
  newPassword: string,
): Promise<void> => {
  const invalid = () => new AppError("Invalid or expired code", 400);

  const user = await User.findOne({ email }).select(
    "+password +passwordResetToken +passwordResetExpiry +passwordResetAttempts",
  );
  if (!user || !user.passwordResetToken || !user.passwordResetExpiry) {
    throw invalid();
  }

  const clearReset = () => {
    user.passwordResetToken = undefined;
    user.passwordResetExpiry = undefined;
    user.passwordResetAttempts = 0;
  };

  const attempts = user.passwordResetAttempts ?? 0;
  if (user.passwordResetExpiry < new Date() || attempts >= MAX_RESET_ATTEMPTS) {
    clearReset();
    await user.save();
    throw invalid();
  }

  if (!safeEqual(hashOtp(otp), user.passwordResetToken)) {
    user.passwordResetAttempts = attempts + 1;
    if (user.passwordResetAttempts >= MAX_RESET_ATTEMPTS) clearReset();
    await user.save();
    throw invalid();
  }

  if (await user.comparePassword(newPassword)) {
    throw new AppError(
      "New password must be different from your current password",
      400,
    );
  }

  user.password = newPassword; // hashed by the pre-save hook
  clearReset();
  await user.save();

  await createNotification({
    userId: user._id,
    type: "password_changed",
    title: "Password reset",
    message:
      "Your password was reset and all other sessions were signed out. If this was not you, contact support immediately.",
  });
};
