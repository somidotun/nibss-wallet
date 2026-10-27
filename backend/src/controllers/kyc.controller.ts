import { Request, Response, NextFunction } from "express";
import { submitKyc, getKycStatus } from "../services/kyc.service.js";

export const submit = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { nin, bvn } = req.body;
    const user = await submitKyc(req.user!.userId, { nin, bvn });

    res.status(200).json({
      status: "success",
      message: "KYC submitted successfully and is pending review",
      data: {
        kyc: {
          currentTier: user.kyc.currentTier,
          requestedTier: user.kyc.requestedTier,
          status: user.kyc.status,
          submittedAt: user.kyc.submittedAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const kyc = await getKycStatus(req.user!.userId);
    res.status(200).json({ status: "success", data: { kyc } });
  } catch (error) {
    next(error);
  }
};
