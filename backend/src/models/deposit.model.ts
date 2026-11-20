import mongoose, { Schema } from "mongoose";
import { IDeposit, DEPOSIT_STATUSES } from "../types/deposit.types.js";

const DepositSchema = new Schema<IDeposit>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    walletId: { type: Schema.Types.ObjectId, ref: "Wallet", required: true },
    reference: { type: String, required: true, unique: true },
    amountKobo: { type: Number, required: true, min: 10000 }, // paystack uses kobo
    currency: { type: String, enum: ["NGN"], default: "NGN" },
    status: { type: String, enum: [...DEPOSIT_STATUSES], default: "pending" },
    accessCode: String,
    paidAt: Date,
    failureReason: String,
  },
  { timestamps: true },
);

DepositSchema.index({ userId: 1, createdAt: -1 });

const Deposit = mongoose.model<IDeposit>("Deposit", DepositSchema);
export default Deposit;
