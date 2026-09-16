import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";
import { IUser } from "../types/user.types.js";
import { encrypt, decrypt, maskValue } from "../utils/encryption.utils.js";

const UserSchema = new Schema<IUser>(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    kyc: {
      currentTier: {
        type: Number,
        enum: [1, 2, 3],
        default: 1,
      },
      requestedTier: {
        type: Number,
        enum: [1, 2, 3],
        default: null,
      },
      status: {
        type: String,
        enum: ["not_started", "pending", "verified", "rejected"],
        default: "not_started",
      },
      nin: {
        type: String,
        select: false, // never returned in normal queries
      },
      bvn: {
        type: String,
        select: false, // never returned in normal queries
      },
      submittedAt: Date,
      verifiedAt: Date,
      rejectedAt: Date,
      rejectionReason: String,
    },
    status: {
      type: String,
      enum: ["active", "suspended", "frozen"],
      default: "active",
    },
    onboarding: {
      isComplete: { type: Boolean, default: false },
      steps: {
        profile: { type: Boolean, default: false },
        kyc: { type: Boolean, default: false },
        pin: { type: Boolean, default: false },
      },
    },
    transactionPin: {
      type: String,
      select: false,
      validate: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        validator: function (this: any, value: string) {
          // validate before hashing — only on raw input
          if (this && typeof this.isModified === "function" && this.isModified("transactionPin")) {
            return /^\d{4}$/.test(value);
          }
          return true;
        },
        message: "Transaction PIN must be exactly 4 numeric digits",
      },
    },
    lastLogin: Date,
  },
  {
    timestamps: true,
  },
);

// ─── Pre-save: Hash Password ─────────────────────────────────────
UserSchema.pre("save", async function (this: IUser) {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// ─── Pre-save: Hash Transaction PIN ──────────────────────────────
UserSchema.pre("save", async function (this: IUser) {
  if (!this.isModified("transactionPin")) return;
  if (this.transactionPin) {
    this.transactionPin = await bcrypt.hash(this.transactionPin, 12);
  }
});

// ─── Pre-save: Encrypt NIN ───────────────────────────────────────
UserSchema.pre("save", async function (this: IUser) {
  if (!this.isModified("kyc.nin")) return;
  if (this.kyc?.nin) {
    // Validate format before encrypting
    if (!/^\d{11}$/.test(this.kyc.nin)) {
      throw new Error("NIN must be exactly 11 digits");
    }
    this.kyc.nin = encrypt(this.kyc.nin);
  }
});

// ─── Pre-save: Encrypt BVN ───────────────────────────────────────
UserSchema.pre("save", async function (this: IUser) {
  if (!this.isModified("kyc.bvn")) return;
  if (this.kyc?.bvn) {
    // Validate format before encrypting
    if (!/^\d{11}$/.test(this.kyc.bvn)) {
      throw new Error("BVN must be exactly 11 digits");
    }
    this.kyc.bvn = encrypt(this.kyc.bvn);
  }
});

// ─── Instance Methods ────────────────────────────────────────────

UserSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.comparePin = async function (
  candidatePin: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePin, this.transactionPin);
};

// Returns masked NIN — decrypts only to get last 4 digits
UserSchema.methods.getMaskedNin = function (): string | null {
  if (!this.kyc?.nin) return null;
  try {
    const decrypted = decrypt(this.kyc.nin);
    return maskValue(decrypted);
  } catch {
    return null;
  }
};

// Returns masked BVN — decrypts only to get last 4 digits
UserSchema.methods.getMaskedBvn = function (): string | null {
  if (!this.kyc?.bvn) return null;
  try {
    const decrypted = decrypt(this.kyc.bvn);
    return maskValue(decrypted);
  } catch {
    return null;
  }
};

const User = mongoose.model<IUser>("User", UserSchema);
export default User;
