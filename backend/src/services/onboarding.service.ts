import User from "../models/user.model.js";
import AppError from "../utils/AppError.js";

export type OnboardingStepKey = "email" | "profile" | "pin" | "kyc";

export const getOnboardingStatus = async (userId: string) => {
  const user = await User.findById(userId);

  if (!user) throw new AppError("User not found", 404);

  const { steps: done } = user.onboarding;

  const steps: { key: OnboardingStepKey; label: string; completed: boolean }[] =
    [
      {
        key: "email",
        label: "Verify your email",
        completed: user.isEmailVerified,
      },
      {
        key: "profile",
        label: "Complete your profile",
        completed: done.profile,
      },
      { key: "pin", label: "Set your transaction PIN", completed: done.pin },
      {
        key: "kyc",
        label: "Submit your KYC (NIN and BVN)",
        completed: done.kyc,
      },
    ];

  const completedCount = steps.filter((s) => s.completed).length;
  const next = steps.find((s) => !s.completed);

  return {
    steps,
    completedCount,
    totalSteps: steps.length,
    percent: Math.round((completedCount / steps.length) * 100),
    nextStep: next?.key ?? null,
    isComplete: !next,
  };
};
