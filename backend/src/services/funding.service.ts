import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import User from "../models/user.model.js";
import Wallet from "../models/wallet.model.js";
import Deposit from "../models/deposit.model.js";
import Transaction from "../models/transaction.model.js";
import AppError from "../utils/AppError.js";
import { createNotification } from "./notification.service.js";
import { initializeTransaction, verifyTransaction } from "./paystack.client.js";

export const MIN_DEPOSIT = 100;
export const MAX_DEPOSIT = 50000;
export const MAX_WALLET_BALANCE = 500000;

// ─── Start a payment ──────────────────────────────────────────────
export const initializeFunding = async (
  userId: string,
  amountNaira: number,
) => {
  const [user, wallet] = await Promise.all([
    User.findById(userId),
    Wallet.findOne({ userId }),
  ]);
  if (!user) throw new AppError("User not found", 404);
  if (!wallet) throw new AppError("Wallet not found", 404);
  if (wallet.status !== "active")
    throw new AppError("Your wallet is not active", 403);

  if (wallet.balance + amountNaira > MAX_WALLET_BALANCE) {
    throw new AppError(
      `Funding would take your wallet above the ₦${MAX_WALLET_BALANCE.toLocaleString()} limit`,
      400,
    );
  }

  const reference = `FUND-${uuidv4().toUpperCase()}`;
  const deposit = await Deposit.create({
    userId: user._id,
    walletId: wallet._id,
    reference,
    amountKobo: amountNaira * 100,
  });

  try {
    const data = await initializeTransaction({
      email: user.email,
      amountKobo: deposit.amountKobo,
      reference,
      callbackUrl:
        process.env.PAYSTACK_CALLBACK_URL ??
        `${process.env.FRONTEND_URL ?? ""}/wallet/fund/callback`,
    });
    deposit.accessCode = data.access_code;
    await deposit.save();
    return {
      reference,
      amount: amountNaira,
      authorizationUrl: data.authorization_url,
    };
  } catch (error) {
    console.error(
      "Paystack initialize failed:",
      error instanceof Error ? error.message : error,
    );
    await Deposit.updateOne(
      { _id: deposit._id },
      { status: "failed", failureReason: "Could not start payment" },
    );
    throw new AppError(
      "Payment provider is unavailable. Please try again.",
      502,
    );
  }
};

// ─── Settle a payment (safe to call any number of times) ─────────
export type SettleOutcome =
  | "credited"
  | "already_settled"
  | "pending"
  | "failed"
  | "not_found";

export const confirmDeposit = async (
  reference: string,
): Promise<{ outcome: SettleOutcome }> => {
  const deposit = await Deposit.findOne({ reference });
  if (!deposit) return { outcome: "not_found" };
  if (deposit.status === "success") return { outcome: "already_settled" };
  if (deposit.status === "failed") return { outcome: "failed" };

  // Ask Paystack. Neither the webhook body nor the browser is trusted for money.
  const verified = await verifyTransaction(reference);
  if (verified.status !== "success") return { outcome: "pending" };

  if (verified.amount !== deposit.amountKobo || verified.currency !== "NGN") {
    await Deposit.updateOne(
      { _id: deposit._id, status: "pending" },
      { status: "failed", failureReason: "Amount or currency mismatch" },
    );
    return { outcome: "failed" };
  }

  const amountNaira = deposit.amountKobo / 100;
  let credited = false;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      credited = false; // the callback can be retried by the driver

      // Only one caller can move a deposit from pending to success
      const claimed = await Deposit.findOneAndUpdate(
        { _id: deposit._id, status: "pending" },
        { status: "success", paidAt: new Date() },
        { session },
      );
      if (!claimed) return;

      const wallet = await Wallet.findOneAndUpdate(
        { _id: deposit.walletId },
        { $inc: { balance: amountNaira } },
        { session, new: true },
      );
      if (!wallet) throw new AppError("Wallet not found", 404);

      await Transaction.create(
        [
          {
            reference: deposit.reference,
            type: "funding",
            status: "success",
            amount: amountNaira,
            currency: "NGN",
            senderId: deposit.userId,
            receiverId: deposit.userId,
            senderWalletId: wallet._id,
            receiverWalletId: wallet._id,
            direction: "credit",
            balanceBefore: wallet.balance - amountNaira,
            balanceAfter: wallet.balance,
            description: "Wallet funding via Paystack",
            idempotencyKey: `funding:${deposit.reference}`,
          },
        ],
        { session },
      );
      credited = true;
    });
  } finally {
    await session.endSession();
  }

  if (!credited) return { outcome: "already_settled" };

  await createNotification({
    userId: deposit.userId,
    type: "wallet_funded",
    title: "Wallet funded",
    message: `Your wallet was funded with ₦${amountNaira.toLocaleString()}.`,
    metadata: { reference: deposit.reference, amount: amountNaira },
  });
  return { outcome: "credited" };
};

// ─── The user checks their own payment ────────────────────────────
export const verifyUserDeposit = async (userId: string, reference: string) => {
  const owned = await Deposit.findOne({ reference, userId });
  if (!owned) throw new AppError("Payment not found", 404);

  try {
    await confirmDeposit(reference);
  } catch (error) {
    console.error(
      "Paystack verify failed:",
      error instanceof Error ? error.message : error,
    );
    throw new AppError(
      "Could not reach the payment provider. Please try again.",
      502,
    );
  }

  const deposit = await Deposit.findById(owned._id);
  return {
    reference,
    status: deposit!.status,
    amount: deposit!.amountKobo / 100,
  };
};
