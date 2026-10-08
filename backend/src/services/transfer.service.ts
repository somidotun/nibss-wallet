import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import Wallet from "../models/wallet.model.js";
import Transaction from "../models/transaction.model.js";
import User from "../models/user.model.js";
import AppError from "../utils/AppError.js";
import { generateTransactionReceipt } from "../utils/receipt.utils.js";

export interface TransferInput {
  senderId: string;
  accountNumber: string;
  amount: number;
  description?: string;
  idempotencyKey: string;
  pin: string;
}

export const transferFunds = async (input: TransferInput) => {
  const { senderId, accountNumber, amount, description, idempotencyKey, pin } =
    input;

  // ─── 1. Check idempotency ─────────────────────────────────
  const existingTransaction = await Transaction.findOne({ idempotencyKey });
  if (existingTransaction) {
    return { transaction: existingTransaction, isDuplicate: true };
  }

  // ─── 2. Get sender ────────────────────────────────────────
  const sender = await User.findById(senderId).select("+transactionPin");
  if (!sender) throw new AppError("Sender not found", 404);

  // ─── 3. Verify PIN ────────────────────────────────────────
  if (!sender.transactionPin) {
    throw new AppError("Please set a transaction PIN first", 400);
  }

  const isPinValid = await sender.comparePin(pin);
  if (!isPinValid) throw new AppError("Invalid transaction PIN", 401);

  // ─── 4. Get recipient ─────────────────────────────────────
  const receiverWallet = await Wallet.findOne({ accountNumber });
  if (!receiverWallet) throw new AppError("Account number not found", 404);

  const recipient = await User.findById(receiverWallet.userId);
  if (!recipient) throw new AppError("Recipient not found", 404);

  if (recipient._id.toString() === senderId) {
    throw new AppError("Cannot transfer to yourself", 400);
  }

  // ─── 5. Get wallets ───────────────────────────────────────
  const senderWallet = await Wallet.findOne({ userId: senderId });
  if (!senderWallet) throw new AppError("Sender wallet not found", 404);

  if (senderWallet.status !== "active") {
    throw new AppError("Your wallet is not active", 403);
  }

  // receiverWallet already fetched via accountNumber lookup above

  if (receiverWallet.status !== "active") {
    throw new AppError("Recipient wallet is not active", 403);
  }

  // ─── 6. Check balance ─────────────────────────────────────
  if (senderWallet.balance < amount) {
    throw new AppError("Insufficient balance", 400);
  }

  // ─── 7. Check daily limit ─────────────────────────────────
  const now = new Date();
  const lastReset = new Date(senderWallet.lastTransferReset);
  const isNewDay = now.toDateString() !== lastReset.toDateString();

  if (isNewDay) {
    senderWallet.dailyTransferUsed = 0;
    senderWallet.lastTransferReset = now;
  }

  if (
    senderWallet.dailyTransferUsed + amount >
    senderWallet.dailyTransferLimit
  ) {
    throw new AppError(
      `Daily transfer limit of ₦${senderWallet.dailyTransferLimit.toLocaleString()} exceeded`,
      400,
    );
  }

  // ─── 8. Atomic transaction ────────────────────────────────
  const session = await mongoose.startSession();

  let debitTransaction;
  //   let creditTransaction;

  try {
    await session.withTransaction(async () => {
      const senderBalanceBefore = senderWallet.balance;
      const receiverBalanceBefore = receiverWallet.balance;

      // Debit sender
      senderWallet.balance -= amount;
      senderWallet.dailyTransferUsed += amount;
      await senderWallet.save({ session });

      // Credit receiver
      receiverWallet.balance += amount;
      await receiverWallet.save({ session });

      const sharedReference = `TXN-${uuidv4().toUpperCase()}`;

      // Create debit record for sender
      [debitTransaction] = await Transaction.create(
        [
          {
            reference: sharedReference,
            type: "transfer",
            status: "success",
            amount,
            currency: "NGN",
            senderId: sender._id,
            receiverId: recipient._id,
            senderWalletId: senderWallet._id,
            receiverWalletId: receiverWallet._id,
            direction: "debit",
            balanceBefore: senderBalanceBefore,
            balanceAfter: senderWallet.balance,
            description: description || "Transfer",
            idempotencyKey,
          },
        ],
        { session },
      );

      // Create credit record for receiver
      // [creditTransaction] =
      await Transaction.create(
        [
          {
            reference: `${sharedReference}-CR`,
            type: "transfer",
            status: "success",
            amount,
            currency: "NGN",
            senderId: sender._id,
            receiverId: recipient._id,
            senderWalletId: senderWallet._id,
            receiverWalletId: receiverWallet._id,
            direction: "credit",
            balanceBefore: receiverBalanceBefore,
            balanceAfter: receiverWallet.balance,
            description: description || "Transfer",
            idempotencyKey: `${idempotencyKey}-credit`,
          },
        ],
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  // ─── 9. Generate PDF receipt ──────────────────────────────
  const senderFullName = `${sender.firstName} ${sender.lastName}`;
  const receiverFullName = `${recipient.firstName} ${recipient.lastName}`;

  const receiptBuffer = await generateTransactionReceipt(
    debitTransaction!,
    senderFullName,
    receiverFullName,
  );

  return {
    transaction: debitTransaction,
    receipt: receiptBuffer,
    isDuplicate: false,
  };
};
