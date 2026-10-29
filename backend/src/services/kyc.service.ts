import User from "../models/user.model.js";
import Wallet from "../models/wallet.model.js";
import AppError from "../utils/AppError.js";
import { createNotification } from "./notification.service.js";

export interface SubmitKycInput {
  nin: string;
  bvn: string;
}

// Daily transfer limits per tier
export const TIER_LIMITS: Record<number, number> = {
  1: 50000,
  2: 200000,
  3: Number.MAX_SAFE_INTEGER,
};

// ─── Submit KYC ───────────────────────────────────────────────────
export const submitKyc = async (userId: string, input: SubmitKycInput) => {
  const user = await User.findById(userId).select("+kyc.nin +kyc.bvn");
  if (!user) throw new AppError("User not found", 404);

  if (user.kyc.status === "pending") {
    throw new AppError("Your KYC is already under review", 400);
  }

  if (user.kyc.currentTier >= 2 && user.kyc.status === "verified") {
    throw new AppError("Your KYC is already verified", 400);
  }

  // The pre-save hook validates the 11-digit format and encrypts both values
  user.kyc.nin = input.nin;
  user.kyc.bvn = input.bvn;
  user.kyc.requestedTier = 2;
  user.kyc.status = "pending";
  user.kyc.submittedAt = new Date();
  user.kyc.rejectedAt = undefined;
  user.kyc.rejectionReason = undefined;
  user.onboarding.steps.kyc = true;

  await user.save();

  await createNotification({
    userId: user._id,
    type: "kyc_submitted",
    title: "KYC submitted",
    message: "Your documents are under review.",
  });
  return user;
};

// ─── Get KYC Status ───────────────────────────────────────────────
export const getKycStatus = async (userId: string) => {
  const user = await User.findById(userId).select("+kyc.nin +kyc.bvn");
  if (!user) throw new AppError("User not found", 404);

  return {
    currentTier: user.kyc.currentTier,
    requestedTier: user.kyc.requestedTier,
    status: user.kyc.status,
    nin: user.getMaskedNin(),
    bvn: user.getMaskedBvn(),
    submittedAt: user.kyc.submittedAt,
    verifiedAt: user.kyc.verifiedAt,
    rejectedAt: user.kyc.rejectedAt,
    rejectionReason: user.kyc.rejectionReason,
  };
};

// ─── Review KYC (used by admin routes later) ──────────────────────
export const reviewKyc = async (
  userId: string,
  decision: "approve" | "reject",
  reason?: string,
) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError("User not found", 404);

  if (user.kyc.status !== "pending" || !user.kyc.requestedTier) {
    throw new AppError("No pending KYC request for this user", 400);
  }

  if (decision === "approve") {
    user.kyc.currentTier = user.kyc.requestedTier;
    user.kyc.requestedTier = null;
    user.kyc.status = "verified";
    user.kyc.verifiedAt = new Date();

    // Raise the wallet's daily limit to match the new tier
    await Wallet.findOneAndUpdate(
      { userId },
      { dailyTransferLimit: TIER_LIMITS[user.kyc.currentTier] },
    );
  } else {
    user.kyc.requestedTier = null;
    user.kyc.status = "rejected";
    user.kyc.rejectedAt = new Date();
    user.kyc.rejectionReason = reason || "KYC could not be verified";
  }

  await user.save();

  await createNotification(
    decision === "approve"
      ? {
          userId: user._id,
          type: "kyc_approved",
          title: "KYC approved",
          message: `You are now Tier ${user.kyc.currentTier}. Your daily limit has increased.`,
        }
      : {
          userId: user._id,
          type: "kyc_rejected",
          title: "KYC rejected",
          message:
            user.kyc.rejectionReason ?? "Your KYC could not be verified.",
        },
  );
  return user;
};
