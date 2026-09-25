import User from "../models/user.model.js";
import AppError from "../utils/AppError.js";

// ─── Get Current User ─────────────────────────────────────────────
export const getCurrentUser = async (userId: string) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user;
};

// ─── Update Profile ───────────────────────────────────────────────
export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export const updateProfile = async (
  userId: string,
  input: UpdateProfileInput,
) => {
  const { firstName, lastName, phone } = input;

  // Check if phone is taken by another user
  if (phone) {
    const existingPhone = await User.findOne({
      phone,
      _id: { $ne: userId },
    });

    if (existingPhone) {
      throw new AppError("Phone number is already in use", 409);
    }
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { firstName, lastName, phone },
    { new: true, runValidators: true },
  );

  if (!user) {
    throw new AppError("User not found", 404);
  }

  // Mark profile step as complete in onboarding
  if (!user.onboarding.steps.profile) {
    user.onboarding.steps.profile = true;
    if (user.onboarding.steps.kyc && user.onboarding.steps.pin) {
      user.onboarding.isComplete = true;
    }
    await user.save();
  }

  return user;
};

// ─── Change Password ──────────────────────────────────────────────
export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export const changePassword = async (
  userId: string,
  input: ChangePasswordInput,
) => {
  const { currentPassword, newPassword } = input;

  // Explicitly select password since it has select: false
  const user = await User.findById(userId).select("+password");

  if (!user) {
    throw new AppError("User not found", 404);
  }

  // Verify current password
  const isPasswordValid = await user.comparePassword(currentPassword);
  if (!isPasswordValid) {
    throw new AppError("Current password is incorrect", 401);
  }

  // Prevent using the same password
  const isSamePassword = await user.comparePassword(newPassword);
  if (isSamePassword) {
    throw new AppError(
      "New password must be different from current password",
      400,
    );
  }

  // Update password — pre-save hook will hash it automatically
  user.password = newPassword;
  await user.save();

  return user;
};
