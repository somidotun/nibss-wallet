import mongoose, { Schema } from "mongoose";
import { ITransaction } from "../types/transaction.types.js";
import { v4 as uuidv4 } from "uuid";

const TransactionSchema = new Schema<ITransaction>(
  {
    reference: {
      type: String,
      unique: true,
      default: () => `TXN-${uuidv4().toUpperCase()}`,
    },
    type: {
      type: String,
      enum: ["transfer", "reversal"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },
    amount: {
      type: Number,
      required: true,
      min: [1, "Amount must be at least ₦1"],
    },
    currency: {
      type: String,
      default: "NGN",
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderWalletId: {
      type: Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
    },
    receiverWalletId: {
      type: Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
    },
    direction: {
      type: String,
      enum: ["debit", "credit"],
      required: true,
    },
    balanceBefore: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    receiptUrl: {
      type: String,
    },
    receiptGeneratedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for fast queries
TransactionSchema.index({ senderId: 1, createdAt: -1 });
TransactionSchema.index({ receiverId: 1, createdAt: -1 });
TransactionSchema.index({ reference: 1 });
TransactionSchema.index({ idempotencyKey: 1 });

const Transaction = mongoose.model<ITransaction>(
  "Transaction",
  TransactionSchema,
);

export default Transaction;
