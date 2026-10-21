import { Request, Response, NextFunction } from "express";
import {
  registerUser,
  loginUser,
  refreshUserToken,
} from "../services/auth.service.js";

import {
  verifyEmail,
  resendVerificationOTP,
} from "../services/auth.service.js";

// ─── Register ────────────────────────────────────────────────────
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;

    const { user, tokens } = await registerUser({
      firstName,
      lastName,
      email,
      phone,
      password,
    });

    // Set refresh token in httpOnly cookie
    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      status: "success",
      message: "Account created successfully",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          kyc: {
            currentTier: user.kyc.currentTier,
            status: user.kyc.status,
          },
          onboarding: user.onboarding,
          createdAt: user.createdAt,
        },
        accessToken: tokens.accessToken,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === "EMAIL_EXISTS") {
        res.status(409).json({
          status: "error",
          message: "An account with this email already exists",
        });
        return;
      }
      if (error.message === "PHONE_EXISTS") {
        res.status(409).json({
          status: "error",
          message: "An account with this phone number already exists",
        });
        return;
      }
    }
    next(error);
  }
};

// ─── Login ───────────────────────────────────────────────────────
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { email, password } = req.body;

    const { user, tokens } = await loginUser({ email, password });

    // Set refresh token in httpOnly cookie
    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      status: "success",
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          kyc: {
            currentTier: user.kyc.currentTier,
            status: user.kyc.status,
          },
          onboarding: user.onboarding,
          lastLogin: user.lastLogin,
        },
        accessToken: tokens.accessToken,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      // ─── Email Not Verified ──────────────────────────────────────
      if (error.message === "EMAIL_NOT_VERIFIED") {
        res.status(403).json({
          status: "error",
          message: "Please verify your email address before logging in",
        });
        return;
      }

      // ─── Invalid Credentials ─────────────────────────────────────
      if (error.message === "INVALID_CREDENTIALS") {
        res.status(401).json({
          status: "error",
          message: "Invalid email or password",
        });
        return;
      }

      // ─── Account Frozen ──────────────────────────────────────────
      if (error.message === "ACCOUNT_FROZEN") {
        res.status(403).json({
          status: "error",
          message: "Your account has been frozen. Contact support.",
        });
        return;
      }

      // ─── Account Suspended ───────────────────────────────────────
      if (error.message === "ACCOUNT_SUSPENDED") {
        res.status(403).json({
          status: "error",
          message: "Your account has been suspended. Contact support.",
        });
        return;
      }
    }
    next(error);
  }
};

// ─── Logout ──────────────────────────────────────────────────────
export const logout = async (req: Request, res: Response): Promise<void> => {
  // Clear the refresh token cookie
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  res.status(200).json({
    status: "success",
    message: "Logged out successfully",
  });
};

// ─── Refresh Token ───────────────────────────────────────────────
export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = req.cookies?.refreshToken;

    if (!token) {
      res.status(401).json({
        status: "error",
        message: "No refresh token provided",
      });
      return;
    }

    // Delegate to service — verification happens inside refreshUserToken
    const { tokens } = await refreshUserToken(token);

    // Set new refresh token cookie
    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      status: "success",
      message: "Token refreshed successfully",
      data: {
        accessToken: tokens.accessToken,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (
        error.message === "USER_NOT_FOUND" ||
        error.message === "ACCOUNT_INACTIVE"
      ) {
        res.status(401).json({
          status: "error",
          message: "Session expired. Please login again.",
        });
        return;
      }
    }
    next(error);
  }
};

// ─── Verify Email ─────────────────────────────────────────────────
export const verifyEmailOTP = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { otp } = req.body;
    const user = await verifyEmail(req.user!.userId, otp);

    res.status(200).json({
      status: "success",
      message: "Email verified successfully",
      data: {
        user: {
          id: user._id,
          email: user.email,
          isEmailVerified: user.isEmailVerified,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Resend OTP ───────────────────────────────────────────────────
export const resendOTP = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await resendVerificationOTP(req.user!.userId);

    res.status(200).json({
      status: "success",
      message: "Verification email sent successfully",
    });
  } catch (error) {
    next(error);
  }
};
