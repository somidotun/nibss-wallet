import { Document, Types } from "mongoose";

export const DEPOSIT_STATUSES = ["pending", "success", "failed"] as const;
export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];

export interface IDeposit extends Document {
  userId: Types.ObjectId;
  walletId: Types.ObjectId;
  reference: string;
  amountKobo: number;
  currency: "NGN";
  status: DepositStatus;
  accessCode?: string;
  paidAt?: Date;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
