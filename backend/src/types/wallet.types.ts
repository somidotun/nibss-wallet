import { Document, Types } from "mongoose";

export type WalletStatus = "active" | "frozen" | "suspended";
export type WalletCurrency = "NGN";

export interface IWallet extends Document {
  userId: Types.ObjectId;
  balance: number;
  currency: WalletCurrency;
  status: WalletStatus;
  dailyTransferLimit: number;
  dailyTransferUsed: number;
  lastTransferReset: Date;
  pin?: string;
  createdAt: Date;
  updatedAt: Date;
}
