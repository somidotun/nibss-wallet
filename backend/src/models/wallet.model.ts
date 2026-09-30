import mongoose, { Schema } from "mongoose";
import { IWallet } from "../types/wallet.types.js";

const WalletSchema = new Schema<IWallet>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // one wallet per user
    },
    balance: {
      type: Number,
      default: 0,
      min: [0, "Balance cannot be negative"],
    },
    currency: {
      type: String,
      enum: ["NGN"],
      default: "NGN",
    },
    status: {
      type: String,
      enum: ["active", "frozen", "suspended"],
      default: "active",
    },
    dailyTransferLimit: {
      type: Number,
      default: 50000, // Tier 1 default — ₦50,000
    },
    dailyTransferUsed: {
      type: Number,
      default: 0,
    },
    lastTransferReset: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Index for fast lookup by userId
WalletSchema.index({ userId: 1 });

const Wallet = mongoose.model<IWallet>("Wallet", WalletSchema);
export default Wallet;
