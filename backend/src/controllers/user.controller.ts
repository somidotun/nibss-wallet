import { Request, Response, NextFunction } from "express";
import {
  getCurrentUser,
  updateProfile,
  changePassword,
} from "../services/user.service.js";

// ─── Get Current User ─────────────────────────────────────────────
export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await getCurrentUser(req.user!.userId);

    res.status(200).json({
      status: "success",
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
            requestedTier: user.kyc.requestedTier,
            status: user.kyc.status,
          },
          status: user.status,
          onboarding: user.onboarding,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Update Profile ───────────────────────────────────────────────
export const updateMe = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { firstName, lastName, phone } = req.body;

    const user = await updateProfile(req.user!.userId, {
      firstName,
      lastName,
      phone,
    });

    res.status(200).json({
      status: "success",
      message: "Profile updated successfully",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          onboarding: user.onboarding,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Change Password ──────────────────────────────────────────────
export const updatePassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    await changePassword(req.user!.userId, {
      currentPassword,
      newPassword,
    });

    res.status(200).json({
      status: "success",
      message: "Password changed successfully. Please login again.",
    });
  } catch (error) {
    next(error);
  }
};
