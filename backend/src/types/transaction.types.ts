import { Document, Types } from "mongoose";

export type TransactionType = "transfer" | "reversal";
export type TransactionStatus = "pending" | "success" | "failed";
export type TransactionDirection = "debit" | "credit";

export interface ITransaction extends Document {
  reference: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  currency: string;
  senderId: Types.ObjectId;
  receiverId: Types.ObjectId;
  senderWalletId: Types.ObjectId;
  receiverWalletId: Types.ObjectId;
  direction: TransactionDirection;
  balanceBefore: number;
  balanceAfter: number;
  description?: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  receiptUrl?: string;
  receiptGeneratedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
