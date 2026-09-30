import { Request, Response, NextFunction } from "express";
import { getWallet, getWalletBalance } from "../services/wallet.service.js";

// ─── Get Wallet ───────────────────────────────────────────────────
export const getMyWallet = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const wallet = await getWallet(req.user!.userId);

    res.status(200).json({
      status: "success",
      data: { wallet },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Get Balance ──────────────────────────────────────────────────
export const getBalance = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const balance = await getWalletBalance(req.user!.userId);

    res.status(200).json({
      status: "success",
      data: balance,
    });
  } catch (error) {
    next(error);
  }
};
