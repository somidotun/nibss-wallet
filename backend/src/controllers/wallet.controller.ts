import { Request, Response, NextFunction } from "express";
import { getWallet, getWalletBalance } from "../services/wallet.service.js";
import Wallet from "../models/wallet.model.js";
import User from "../models/user.model.js";
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

export const lookupAccount = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { accountNumber } = req.params;
    const wallet = await Wallet.findOne({ accountNumber });

    if (!wallet) {
      res.status(404).json({
        status: "error",
        message: "Account number not found",
      });
      return;
    }

    const user = await User.findById(wallet.userId);

    res.status(200).json({
      status: "success",
      data: {
        accountNumber: wallet.accountNumber,
        accountName: `${user?.firstName} ${user?.lastName}`,
        bankName: "Nibss Wallet",
      },
    });
  } catch (error) {
    next(error);
  }
};
