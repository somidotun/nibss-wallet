import mongoose from "mongoose";
import User from "../models/user.model.js";
import Wallet from "../models/wallet.model.js";
import Transaction from "../models/transaction.model.js";
import AuditLog from "../models/auditLog.model.js";
import AppError from "../utils/AppError.js";
import { pageOptions, paginationMeta } from "../utils/pagination.js";
import { createNotification } from "./notification.service.js";
import { reviewKyc } from "./kyc.service.js";
import { AUDIT_ACTIONS } from "../types/audit.types.js";

const USER_STATUSES = ["active", "suspended", "frozen"];
const ROLES = ["user", "admin"];
const KYC_STATUSES = ["not_started", "pending", "verified", "rejected"];
const TX_STATUSES = ["pending", "success", "failed"];
const TX_TYPES = ["transfer", "reversal"];

// Only these fields ever leave the API for a user
const LIST_FIELDS =
  "firstName lastName email phone role status isEmailVerified kyc.currentTier kyc.requestedTier kyc.status onboarding lastLogin createdAt";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const oneOf = (allowed: readonly string[], value?: string) =>
  value && allowed.includes(value) ? value : undefined;

export interface AdminQuery {
  page?: number;
  limit?: number;
  status?: string;
  role?: string;
  kycStatus?: string;
  search?: string;
  type?: string;
  direction?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  action?: string;
}

// ─── Users ────────────────────────────────────────────────────────
export const listUsers = async (query: AdminQuery) => {
  const { page, limit, skip } = pageOptions(query.page, query.limit);
  const filter: Record<string, unknown> = {};

  const status = oneOf(USER_STATUSES, query.status);
  if (status) filter.status = status;
  const role = oneOf(ROLES, query.role);
  if (role) filter.role = role;
  const kycStatus = oneOf(KYC_STATUSES, query.kycStatus);
  if (kycStatus) filter["kyc.status"] = kycStatus;

  if (query.search) {
    const rx = new RegExp(escapeRegex(query.search.slice(0, 50)), "i");
    filter.$or = [
      { email: rx },
      { firstName: rx },
      { lastName: rx },
      { phone: rx },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select(LIST_FIELDS)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);
  return { users, pagination: paginationMeta(total, page, limit) };
};

export const getUserDetail = async (id: string) => {
  const user = await User.findById(id).select("+kyc.nin +kyc.bvn");
  if (!user) throw new AppError("User not found", 404);

  const [wallet, transactionCount] = await Promise.all([
    Wallet.findOne({ userId: id }).select(
      "accountNumber balance currency status dailyTransferLimit dailyTransferUsed",
    ),
    Transaction.countDocuments({
      $or: [
        { senderId: id, direction: "debit" },
        { receiverId: id, direction: "credit" },
      ],
    }),
  ]);

  return {
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      isEmailVerified: user.isEmailVerified,
      onboarding: user.onboarding,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      kyc: {
        currentTier: user.kyc.currentTier,
        requestedTier: user.kyc.requestedTier,
        status: user.kyc.status,
        nin: user.getMaskedNin(),
        bvn: user.getMaskedBvn(),
        submittedAt: user.kyc.submittedAt,
        verifiedAt: user.kyc.verifiedAt,
        rejectedAt: user.kyc.rejectedAt,
        rejectionReason: user.kyc.rejectionReason,
      },
    },
    wallet,
    transactionCount,
  };
};

export const getUserWallet = async (userId: string) => {
  const wallet = await Wallet.findOne({ userId });
  if (!wallet) throw new AppError("Wallet not found", 404);
  return wallet;
};

// ─── Freeze / unfreeze ────────────────────────────────────────────
export const setAccountFrozen = async (
  adminId: string,
  targetId: string,
  freeze: boolean,
  reason?: string,
) => {
  const target = await User.findById(targetId);
  if (!target) throw new AppError("User not found", 404);
  if (target.role === "admin") {
    throw new AppError("Admin accounts cannot be frozen", 403);
  }
  if (freeze && target.status === "frozen") {
    throw new AppError("Account is already frozen", 400);
  }
  if (!freeze && target.status !== "frozen") {
    throw new AppError("Account is not frozen", 400);
  }

  const newStatus = freeze ? "frozen" : "active";

  // User, wallet and audit entry change together or not at all
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await User.updateOne(
        { _id: target._id },
        { status: newStatus },
        { session },
      );
      await Wallet.updateOne(
        { userId: target._id },
        { status: newStatus },
        { session },
      );
      await AuditLog.create(
        [
          {
            adminId: new mongoose.Types.ObjectId(adminId),
            action: freeze ? "freeze_user" : "unfreeze_user",
            targetUserId: target._id,
            reason,
          },
        ],
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  await createNotification(
    freeze
      ? {
          userId: target._id,
          type: "account_frozen",
          title: "Account frozen",
          message: "Your account has been frozen. Please contact support.",
        }
      : {
          userId: target._id,
          type: "account_unfrozen",
          title: "Account restored",
          message: "Your account is active again.",
        },
  );

  return { id: target._id, status: newStatus };
};

// ─── Transactions ─────────────────────────────────────────────────
// Each transfer is stored as a debit and a credit record, so the default
// view shows the debit side only and every transfer appears once.
export const listTransactions = async (query: AdminQuery) => {
  const { page, limit, skip } = pageOptions(query.page, query.limit);
  const filter: Record<string, unknown> = {};

  const direction = query.direction ?? "debit";
  if (direction === "debit" || direction === "credit")
    filter.direction = direction;

  const status = oneOf(TX_STATUSES, query.status);
  if (status) filter.status = status;
  const type = oneOf(TX_TYPES, query.type);
  if (type) filter.type = type;

  if (query.userId) {
    filter.$or = [{ senderId: query.userId }, { receiverId: query.userId }];
  }

  if (query.startDate || query.endDate) {
    const range: Record<string, Date> = {};
    if (query.startDate) range.$gte = new Date(query.startDate);
    if (query.endDate) range.$lte = new Date(query.endDate);
    filter.createdAt = range;
  }

  const [transactions, total] = await Promise.all([
    Transaction.find(filter)
      .populate("senderId", "firstName lastName email")
      .populate("receiverId", "firstName lastName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Transaction.countDocuments(filter),
  ]);
  return { transactions, pagination: paginationMeta(total, page, limit) };
};

// ─── Stats ────────────────────────────────────────────────────────
export const getStats = async () => {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const successfulTransfers = { direction: "debit" as const, status: "success" as const };

  const [
    totalUsers,
    verifiedUsers,
    frozenUsers,
    pendingKyc,
    approvedKyc,
    transferAgg,
    transfersLast24h,
    walletAgg,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isEmailVerified: true }),
    User.countDocuments({ status: "frozen" }),
    User.countDocuments({ "kyc.status": "pending" }),
    User.countDocuments({ "kyc.status": "verified" }),
    Transaction.aggregate([
      { $match: successfulTransfers },
      {
        $group: { _id: null, count: { $sum: 1 }, volume: { $sum: "$amount" } },
      },
    ]),
    Transaction.countDocuments({
      ...successfulTransfers,
      createdAt: { $gte: dayAgo },
    }),
    Wallet.aggregate([
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalBalance: { $sum: "$balance" },
        },
      },
    ]),
  ]);

  return {
    users: { total: totalUsers, verified: verifiedUsers, frozen: frozenUsers },
    kyc: { pending: pendingKyc, verified: approvedKyc },
    transfers: {
      total: transferAgg[0]?.count ?? 0,
      volume: transferAgg[0]?.volume ?? 0,
      last24h: transfersLast24h,
    },
    wallets: {
      total: walletAgg[0]?.count ?? 0,
      totalBalance: walletAgg[0]?.totalBalance ?? 0,
    },
  };
};

// ─── KYC review ───────────────────────────────────────────────────
export const listPendingKyc = async (query: AdminQuery) => {
  const { page, limit, skip } = pageOptions(query.page, query.limit);
  const filter = { "kyc.status": "pending" as const };

  const [users, total] = await Promise.all([
    User.find(filter)
      .select(
        "firstName lastName email kyc.requestedTier kyc.submittedAt +kyc.nin +kyc.bvn",
      )
      .sort({ "kyc.submittedAt": 1 }) // oldest first
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  return {
    requests: users.map((u) => ({
      id: u._id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      requestedTier: u.kyc.requestedTier,
      submittedAt: u.kyc.submittedAt,
      nin: u.getMaskedNin(),
      bvn: u.getMaskedBvn(),
    })),
    pagination: paginationMeta(total, page, limit),
  };
};

export const reviewUserKyc = async (
  adminId: string,
  targetId: string,
  decision: "approve" | "reject",
  reason?: string,
) => {
  if (adminId === targetId) {
    throw new AppError("You cannot review your own KYC", 403);
  }

  // Updates the tier, the wallet limit and notifies the user
  const user = await reviewKyc(targetId, decision, reason);

  await AuditLog.create({
    adminId: new mongoose.Types.ObjectId(adminId),
    action: decision === "approve" ? "kyc_approve" : "kyc_reject",
    targetUserId: user._id,
    reason,
  });

  return user;
};

// ─── Audit logs ───────────────────────────────────────────────────
export const getAuditLogs = async (query: AdminQuery) => {
  const { page, limit, skip } = pageOptions(query.page, query.limit);
  const filter: Record<string, unknown> = {};
  const action = oneOf(AUDIT_ACTIONS, query.action);
  if (action) filter.action = action;

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate("adminId", "firstName lastName email")
      .populate("targetUserId", "firstName lastName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    AuditLog.countDocuments(filter),
  ]);
  return { logs, pagination: paginationMeta(total, page, limit) };
};
