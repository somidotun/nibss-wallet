import Transaction from "../models/transaction.model.js";
import AppError from "../utils/AppError.js";

export interface TransactionQuery {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  direction?: string;
  startDate?: string;
  endDate?: string;
}

// ─── Get User Transactions ────────────────────────────────────────
export const getUserTransactions = async (
  userId: string,
  query: TransactionQuery,
) => {
  const {
    page = 1,
    limit = 20,
    type,
    status,
    direction,
    startDate,
    endDate,
  } = query;

  const filter: Record<string, unknown> = {};

  if (direction === "debit") {
    filter.senderId = userId;
    filter.direction = "debit";
  } else if (direction === "credit") {
    filter.receiverId = userId;
    filter.direction = "credit";
  } else {
    filter.$or = [
      { senderId: userId, direction: "debit" },
      { receiverId: userId, direction: "credit" },
    ];
  }

  if (type) filter.type = type;
  if (status) filter.status = status;

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate)
      (filter.createdAt as Record<string, unknown>).$gte = new Date(startDate);
    if (endDate)
      (filter.createdAt as Record<string, unknown>).$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;

  const [transactions, total] = await Promise.all([
    Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("senderId", "firstName lastName email")
      .populate("receiverId", "firstName lastName email"),
    Transaction.countDocuments(filter),
  ]);

  return {
    transactions,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPreviousPage: page > 1,
    },
  };
};

// ─── Get Single Transaction ───────────────────────────────────────
export const getTransactionById = async (
  transactionId: string,
  userId: string,
) => {
  const transaction = await Transaction.findById(transactionId)
    .populate("senderId", "firstName lastName email")
    .populate("receiverId", "firstName lastName email");

  if (!transaction) {
    throw new AppError("Transaction not found", 404);
  }

  // Only sender or receiver can view transaction
  const isSender = transaction.senderId._id.toString() === userId;
  const isReceiver = transaction.receiverId._id.toString() === userId;

  if (!isSender && !isReceiver) {
    throw new AppError("Access denied", 403);
  }

  return transaction;
};
