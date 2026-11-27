import {
  Json,
  arr,
  bool,
  date,
  enumOf,
  envelope,
  int,
  num,
  obj,
  ref,
  str,
} from "./helpers.js";

const objectId = (description?: string) =>
  str(description, { example: "64b000000000000000000000" });
const kycStatus = enumOf(["not_started", "pending", "verified", "rejected"]);
const naira = (description: string) => num(`${description} (naira)`);

export const schemas: Record<string, Json> = {
  Success: envelope(),

  Error: obj({ status: enumOf(["error", "fail"]), message: str() }, [
    "status",
    "message",
  ]),

  ValidationError: obj(
    {
      status: enumOf(["error"]),
      message: str(undefined, { example: "Validation failed" }),
      errors: arr(obj({ field: str(), message: str() })),
    },
    ["status", "message"],
  ),

  Pagination: obj({
    total: int(),
    page: int(),
    limit: int(),
    totalPages: int(),
    hasNextPage: bool(),
    hasPreviousPage: bool(),
  }),

  Onboarding: obj({
    isComplete: bool(),
    steps: obj({ profile: bool(), kyc: bool(), pin: bool() }),
  }),

  UserSummary: obj({
    id: objectId(),
    firstName: str(),
    lastName: str(),
    email: str(undefined, { format: "email" }),
    phone: str(),
    role: enumOf(["user", "admin"]),
    kyc: obj({
      currentTier: int(undefined, { enum: [1, 2, 3] }),
      status: kycStatus,
    }),
    onboarding: ref("Onboarding"),
    createdAt: date(),
    lastLogin: date(),
  }),

  AuthResponse: envelope(
    obj({
      user: ref("UserSummary"),
      accessToken: str("JWT access token, valid for 15 minutes"),
    }),
  ),

  AccessTokenResponse: envelope(
    obj({ accessToken: str("New JWT access token") }),
  ),

  Wallet: obj({
    _id: objectId(),
    userId: objectId(),
    accountNumber: str("10 digits, starts with 90", { example: "9077027286" }),
    balance: naira("Current balance"),
    currency: enumOf(["NGN"]),
    status: enumOf(["active", "frozen", "suspended"]),
    dailyTransferLimit: naira("Daily transfer limit"),
    dailyTransferUsed: naira("Amount already sent today"),
    lastTransferReset: date(),
    createdAt: date(),
  }),

  WalletBalance: obj({
    balance: naira("Current balance"),
    currency: enumOf(["NGN"]),
    status: enumOf(["active", "frozen", "suspended"]),
    dailyTransferLimit: naira("Daily transfer limit"),
    dailyTransferUsed: naira("Amount already sent today"),
  }),

  Transaction: obj({
    _id: objectId(),
    reference: str(undefined, {
      example: "TXN-6CC49E78-FC22-4870-AABF-223AA7206DD1",
    }),
    type: enumOf(["transfer", "reversal", "funding"]),
    status: enumOf(["pending", "success", "failed"]),
    amount: naira("Amount"),
    currency: enumOf(["NGN"]),
    direction: enumOf(["debit", "credit"]),
    senderId: str(
      "Sender id, or { firstName, lastName, email } when populated",
    ),
    receiverId: str(
      "Receiver id, or { firstName, lastName, email } when populated",
    ),
    balanceBefore: naira("Balance before"),
    balanceAfter: naira("Balance after"),
    description: str(),
    createdAt: date(),
  }),

  TransactionList: obj({
    transactions: arr(ref("Transaction")),
    pagination: ref("Pagination"),
  }),

  Notification: obj({
    _id: objectId(),
    type: str(undefined, { example: "transfer_received" }),
    title: str(),
    message: str(),
    isRead: bool(),
    readAt: date(),
    createdAt: date(),
  }),

  NotificationList: obj({
    notifications: arr(ref("Notification")),
    unreadCount: int(),
    pagination: ref("Pagination"),
  }),

  KycStatus: obj({
    currentTier: int(undefined, { enum: [1, 2, 3] }),
    requestedTier: int(undefined, { enum: [1, 2, 3], nullable: true }),
    status: kycStatus,
    nin: str("Masked, last 4 digits only", {
      example: "******8901",
      nullable: true,
    }),
    bvn: str("Masked, last 4 digits only", {
      example: "******4321",
      nullable: true,
    }),
    submittedAt: date(),
    verifiedAt: date(),
    rejectedAt: date(),
    rejectionReason: str(),
  }),

  OnboardingStatus: obj({
    steps: arr(
      obj({
        key: enumOf(["email", "profile", "pin", "kyc"]),
        label: str(),
        completed: bool(),
      }),
    ),
    completedCount: int(),
    totalSteps: int(),
    percent: int(),
    nextStep: str(undefined, { nullable: true }),
    isComplete: bool(),
  }),

  Feedback: obj({
    _id: objectId(),
    category: enumOf(["bug", "feature_request", "complaint", "general"]),
    message: str(),
    rating: int(undefined, { minimum: 1, maximum: 5 }),
    status: enumOf(["open", "reviewed", "resolved"]),
    adminNote: str("Only returned to admins"),
    createdAt: date(),
  }),

  FeedbackList: obj({
    feedback: arr(ref("Feedback")),
    pagination: ref("Pagination"),
  }),

  AdminUser: obj({
    _id: objectId(),
    firstName: str(),
    lastName: str(),
    email: str(),
    phone: str(),
    role: enumOf(["user", "admin"]),
    status: enumOf(["active", "suspended", "frozen"]),
    isEmailVerified: bool(),
    lastLogin: date(),
    createdAt: date(),
  }),

  AuditLog: obj({
    _id: objectId(),
    action: enumOf([
      "freeze_user",
      "unfreeze_user",
      "kyc_approve",
      "kyc_reject",
    ]),
    reason: str(),
    adminId: str("Admin id, or a populated { firstName, lastName, email }"),
    targetUserId: str("User id, or a populated { firstName, lastName, email }"),
    createdAt: date(),
  }),

  Insights: obj({
    period: obj({ days: int(), from: date(), to: date() }),
    totals: obj({
      spent: naira("Sent in the period"),
      received: naira("Received from other users"),
      funded: naira("Added through Paystack"),
      net: naira("Received + funded - spent"),
      sentCount: int(),
      averageTransfer: naira("Average transfer"),
      dailyAverage: naira("Average per day"),
    }),
    comparison: obj({
      previousSpent: naira("Previous period"),
      changePercent: int(undefined, { nullable: true }),
    }),
    largest: obj({ amount: num(), to: str(), date: date(), category: str() }),
    topRecipients: arr(obj({ name: str(), total: num(), count: int() })),
    categories: arr(
      obj({ category: str(), total: num(), count: int(), percent: int() }),
    ),
    dailyLimit: obj({ percentUsed: int() }),
    observations: arr(str()),
  }),

  ChatAnswer: obj({
    answer: str(),
    source: enumOf(["faq", "gemini", "fallback"]),
    topic: str("FAQ topic id, when source is faq"),
    reason: enumOf(
      ["disabled", "limit_reached", "busy", "unavailable"],
      "Why the fallback was used",
    ),
  }),
};
