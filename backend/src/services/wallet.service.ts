import Wallet from "../models/wallet.model.js";
import AppError from "../utils/AppError.js";

// ─── Get Wallet ───────────────────────────────────────────────────
export const getWallet = async (userId: string) => {
  const wallet = await Wallet.findOne({ userId });

  if (!wallet) {
    throw new AppError("Wallet not found", 404);
  }

  return wallet;
};

// ─── Get Wallet Balance ───────────────────────────────────────────
export const getWalletBalance = async (userId: string) => {
  const wallet = await Wallet.findOne({ userId });

  if (!wallet) {
    throw new AppError("Wallet not found", 404);
  }

  if (wallet.status !== "active") {
    throw new AppError("Wallet is not active", 403);
  }

  return {
    balance: wallet.balance,
    currency: wallet.currency,
    status: wallet.status,
    dailyTransferLimit: wallet.dailyTransferLimit,
    dailyTransferUsed: wallet.dailyTransferUsed,
  };
};

// ─── Check Daily Transfer Limit ───────────────────────────────────
export const checkDailyLimit = async (
  userId: string,
  amount: number,
): Promise<void> => {
  const wallet = await Wallet.findOne({ userId });

  if (!wallet) {
    throw new AppError("Wallet not found", 404);
  }

  // Reset daily limit if it's a new day
  const now = new Date();
  const lastReset = new Date(wallet.lastTransferReset);
  const isNewDay = now.toDateString() !== lastReset.toDateString();

  if (isNewDay) {
    wallet.dailyTransferUsed = 0;
    wallet.lastTransferReset = now;
    await wallet.save();
  }

  // Check if transfer would exceed daily limit
  if (wallet.dailyTransferUsed + amount > wallet.dailyTransferLimit) {
    throw new AppError(
      `Daily transfer limit of ₦${wallet.dailyTransferLimit.toLocaleString()} exceeded`,
      400,
    );
  }
};
