import { Document } from "mongoose";

export type UserRole = "user" | "admin";
export type AccountStatus = "active" | "suspended" | "frozen";
export type KycStatus = "not_started" | "pending" | "verified" | "rejected";
export type KycTier = 1 | 2 | 3;

export interface IKyc {
  currentTier: KycTier;
  requestedTier: KycTier | null;
  status: KycStatus;
  nin?: string; // stored encrypted
  bvn?: string; // stored encrypted
  submittedAt?: Date;
  verifiedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
}

export interface IOnboarding {
  isComplete: boolean;
  steps: {
    profile: boolean;
    kyc: boolean;
    pin: boolean;
  };
}

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  kyc: IKyc;
  status: AccountStatus;
  onboarding: IOnboarding;
  transactionPin: string;
  lastLogin?: Date;
  // Mongoose timestamps (set by { timestamps: true } in schema options)
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  comparePin(candidatePin: string): Promise<boolean>;
  getMaskedNin(): string | null;
  getMaskedBvn(): string | null;
}
