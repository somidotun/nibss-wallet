import User from "../models/user.model.js";
import { generateTokenPair, verifyRefreshToken, JwtPayload } from "../utils/jwt.utils.js";
import { IUser } from "../types/user.types.js";
import { Types } from "mongoose";

// ─── Register ────────────────────────────────────────────────────
export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
}

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

  // Create user — password is hashed automatically by pre-save hook
  const user = await User.create({
    firstName,
    lastName,
    email,
    phone,
    password,
  });

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
export const refreshUserToken = async (refreshToken: string) => {
  // Verify the token first — throws if expired or tampered
  const verified = verifyRefreshToken(refreshToken);

  const user = await User.findById(verified.userId);

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  if (user.status !== "active") {
    throw new Error("ACCOUNT_INACTIVE");
  }

  const payload: JwtPayload = {
    userId: (user._id as Types.ObjectId).toString(),
    role: user.role,
  };

  const tokens = generateTokenPair(payload);

  return { tokens };
};
