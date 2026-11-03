import { Request, Response, NextFunction } from "express";
import { getOnboardingStatus } from "../services/onboarding.service.js";

export const getStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const onboarding = await getOnboardingStatus(req.user!.userId);
    res.status(200).json({ status: "success", data: { onboarding } });
  } catch (error) {
    next(error);
  }
};
