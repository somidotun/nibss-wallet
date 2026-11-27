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
  op,
  pageParams,
  pathParam,
  queryParam,
  ref,
  str,
} from "./helpers.js";

const idParam = (what = "Record") =>
  pathParam("id", `${what} id`, {
    pattern: "^[a-f0-9]{24}$",
    example: "64b000000000000000000000",
  });

const PASSWORD_RULE =
  "At least 8 characters with an uppercase letter, a lowercase letter, a number and a special character.";

export const paths: Record<string, Json> = {
  // ── System ─────────────────────────────────────────────────────
  "/health": {
    servers: [{ url: "/api" }],
    get: op({
      tag: "System",
      summary: "Health check",
      auth: "none",
      success: {
        description: "The server is running",
        schema: obj({
          status: enumOf(["success"]),
          message: str(),
          timestamp: date(),
        }),
      },
    }),
  },

  // ── Auth ───────────────────────────────────────────────────────
  "/auth/register": {
    post: op({
      tag: "Auth",
      summary: "Create an account",
      description:
        "Emails a 6-digit code that expires in 10 minutes. The wallet (with the ₦50,000 demo balance) is created after the email is verified. An earlier unverified signup with the same email or phone is replaced.",
      auth: "none",
      body: obj(
        {
          firstName: str(),
          lastName: str(),
          email: str(undefined, { format: "email" }),
          phone: str("Nigerian number", { example: "08012345678" }),
          password: str(PASSWORD_RULE),
        },
        ["firstName", "lastName", "email", "phone", "password"],
      ),
      example: {
        firstName: "Ada",
        lastName: "Obi",
        email: "ada@example.com",
        phone: "08012345678",
        password: "Password123!",
      },
      success: {
        code: 201,
        description: "Account created",
        schema: ref("AuthResponse"),
      },
      errors: [400, 409, 429],
    }),
  },
  "/auth/login": {
    post: op({
      tag: "Auth",
      summary: "Log in",
      description:
        "Returns an access token and sets the refresh token as an httpOnly cookie. Blocked for unverified, frozen or suspended accounts. Only failed attempts count towards the rate limit.",
      auth: "none",
      body: obj(
        { email: str(undefined, { format: "email" }), password: str() },
        ["email", "password"],
      ),
      example: { email: "ada@example.com", password: "Password123!" },
      success: { description: "Logged in", schema: ref("AuthResponse") },
      errors: [400, 401, 403, 429],
    }),
  },
  "/auth/logout": {
    post: op({
      tag: "Auth",
      summary: "Log out",
      description: "Clears the refresh token cookie.",
      auth: "none",
      success: { description: "Logged out" },
    }),
  },
  "/auth/refresh-token": {
    post: op({
      tag: "Auth",
      summary: "Get a new access token",
      description:
        "Uses the refresh token cookie. Tokens issued before a password change are rejected.",
      auth: "cookie",
      success: {
        description: "New access token",
        schema: ref("AccessTokenResponse"),
      },
      errors: [401],
    }),
  },
  "/auth/verify-email": {
    post: op({
      tag: "Auth",
      summary: "Verify your email",
      description: "Creates your wallet on success.",
      body: obj(
        { otp: str("6-digit code from the email", { example: "123456" }) },
        ["otp"],
      ),
      success: { description: "Email verified" },
      errors: [400, 429],
    }),
  },
  "/auth/resend-otp": {
    post: op({
      tag: "Auth",
      summary: "Send a new verification code",
      success: { description: "Code sent" },
      errors: [400, 429],
    }),
  },
  "/auth/forgot-password": {
    post: op({
      tag: "Auth",
      summary: "Request a password reset code",
      description:
        "Always answers the same way, whether or not the email exists. A 6-digit code is emailed to verified accounts. One request per minute per account.",
      auth: "none",
      body: obj({ email: str(undefined, { format: "email" }) }, ["email"]),
      success: { description: "Request accepted" },
      errors: [400, 429],
    }),
  },
  "/auth/reset-password": {
    post: op({
      tag: "Auth",
      summary: "Reset the password with a code",
      description:
        "The code expires after 10 minutes and locks after 5 wrong attempts. Signs out all older sessions.",
      auth: "none",
      body: obj(
        {
          email: str(undefined, { format: "email" }),
          otp: str("6 digits"),
          newPassword: str(PASSWORD_RULE),
        },
        ["email", "otp", "newPassword"],
      ),
      success: { description: "Password reset" },
      errors: [400, 429],
    }),
  },

  // ── Users ──────────────────────────────────────────────────────
  "/users/me": {
    get: op({
      tag: "Users",
      summary: "Get my profile",
      success: {
        description: "Your profile",
        schema: envelope(obj({ user: ref("UserSummary") })),
      },
    }),
    patch: op({
      tag: "Users",
      summary: "Update my profile",
      body: obj({ firstName: str(), lastName: str(), phone: str() }),
      success: {
        description: "Profile updated",
        schema: envelope(obj({ user: ref("UserSummary") })),
      },
      errors: [400, 409],
    }),
  },
  "/users/me/change-password": {
    patch: op({
      tag: "Users",
      summary: "Change my password",
      description: "Signs out all other sessions.",
      body: obj({ currentPassword: str(), newPassword: str(PASSWORD_RULE) }, [
        "currentPassword",
        "newPassword",
      ]),
      success: { description: "Password changed" },
      errors: [400],
    }),
  },
  "/users/me/set-pin": {
    post: op({
      tag: "Users",
      summary: "Set my transaction PIN",
      description: "A 4-digit PIN, stored hashed. Required for every transfer.",
      body: obj({ pin: str("Exactly 4 digits", { pattern: "^\\d{4}$" }) }, [
        "pin",
      ]),
      success: { description: "PIN set" },
      errors: [400],
    }),
  },

  // ── Wallet ─────────────────────────────────────────────────────
  "/wallet": {
    get: op({
      tag: "Wallet",
      summary: "Get my wallet",
      success: {
        description: "Your wallet",
        schema: envelope(obj({ wallet: ref("Wallet") })),
      },
      errors: [404],
    }),
  },
  "/wallet/balance": {
    get: op({
      tag: "Wallet",
      summary: "Get my balance and limits",
      success: {
        description: "Balance",
        schema: envelope(ref("WalletBalance")),
      },
      errors: [403, 404],
    }),
  },
  "/wallet/lookup/{accountNumber}": {
    get: op({
      tag: "Wallet",
      summary: "Look up an account name",
      description: "Use it to confirm the recipient before sending.",
      parameters: [
        pathParam("accountNumber", "10-digit account number", {
          example: "9077027286",
        }),
      ],
      success: {
        description: "Account found",
        schema: envelope(
          obj({ accountNumber: str(), accountName: str(), bankName: str() }),
        ),
      },
      errors: [404],
    }),
  },
  "/wallet/transfer": {
    post: op({
      tag: "Wallet",
      summary: "Send money to another wallet",
      description:
        "Debit, credit and both records are saved in one database transaction, so a transfer either completes fully or not at all. Send a fresh `idempotencyKey` for each new transfer and reuse it when retrying, so a retry can never charge twice. Limited to 10 attempts per minute per user.",
      body: obj(
        {
          accountNumber: str("10 digits", { pattern: "^\\d{10}$" }),
          amount: num("₦100 to ₦1,000,000", { minimum: 100, maximum: 1000000 }),
          pin: str("Your 4-digit transaction PIN", { pattern: "^\\d{4}$" }),
          idempotencyKey: str("Unique per transfer, 1 to 100 characters"),
          description: str("Optional note, up to 100 characters"),
        },
        ["accountNumber", "amount", "pin", "idempotencyKey"],
      ),
      example: {
        accountNumber: "9077027286",
        amount: 5000,
        pin: "1234",
        idempotencyKey: "3f6c2b1e-0d1a-4c7e-9b2a-5d1f7a9c1e22",
        description: "Lunch",
      },
      success: {
        description:
          "Transfer completed (or the original result, for a repeated key)",
        schema: envelope(obj({ transaction: ref("Transaction") })),
      },
      errors: [400, 401, 403, 404, 429],
    }),
  },
  "/wallet/fund": {
    post: op({
      tag: "Wallet",
      summary: "Start a wallet funding payment (Paystack test mode)",
      description:
        "Returns a Paystack checkout link. Test mode only, so no real money moves. ₦100 to ₦50,000 per payment, up to a ₦500,000 wallet balance, 10 attempts per hour. Your balance is credited once the payment is confirmed.",
      body: obj(
        {
          amount: int("Whole naira, 100 to 50000", {
            minimum: 100,
            maximum: 50000,
          }),
        },
        ["amount"],
      ),
      example: { amount: 5000 },
      success: {
        code: 201,
        description: "Payment started",
        schema: envelope(
          obj({ reference: str(), amount: num(), authorizationUrl: str() }),
        ),
      },
      errors: [400, 403, 404, 429, 502],
    }),
  },
  "/wallet/transactions/{id}/receipt": {
    get: op({
      tag: "Wallet",
      summary: "Download a PDF receipt",
      description: "Only the sender can download it.",
      parameters: [idParam("Transaction")],
      success: {
        description: "PDF receipt",
        content: {
          "application/pdf": { schema: { type: "string", format: "binary" } },
        },
      },
      errors: [403, 404],
    }),
  },

  // ── Transactions ───────────────────────────────────────────────
  "/transactions": {
    get: op({
      tag: "Transactions",
      summary: "My transaction history",
      description:
        "Newest first. Each transfer appears once for the sender (debit) and once for the receiver (credit).",
      parameters: [
        ...pageParams,
        queryParam(
          "type",
          enumOf(["transfer", "reversal", "funding"]),
          "Filter by type",
        ),
        queryParam(
          "status",
          enumOf(["pending", "success", "failed"]),
          "Filter by status",
        ),
        queryParam("direction", enumOf(["debit", "credit"]), "Money out or in"),
        queryParam("startDate", date(), "From this date"),
        queryParam("endDate", date(), "Up to this date"),
      ],
      success: {
        description: "Transactions",
        schema: envelope(ref("TransactionList")),
      },
    }),
  },
  "/transactions/{id}": {
    get: op({
      tag: "Transactions",
      summary: "Get one transaction",
      parameters: [idParam("Transaction")],
      success: {
        description: "The transaction",
        schema: envelope(obj({ transaction: ref("Transaction") })),
      },
      errors: [400, 403, 404],
    }),
  },

  // ── Payments ───────────────────────────────────────────────────
  "/paystack/webhook": {
    post: op({
      tag: "Payments",
      summary: "Paystack webhook",
      description:
        "Called by Paystack, not by you. The raw body is checked against the `x-paystack-signature` header (HMAC-SHA512). The payment is then confirmed with Paystack's verify API before the wallet is credited, once, however many times the event is delivered.",
      auth: "none",
      parameters: [
        {
          name: "x-paystack-signature",
          in: "header",
          required: true,
          schema: str(),
        },
      ],
      body: obj({
        event: str(undefined, { example: "charge.success" }),
        data: obj({ reference: str() }),
      }),
      success: { description: "Event acknowledged" },
      errors: [400],
    }),
  },
  "/paystack/verify/{reference}": {
    get: op({
      tag: "Payments",
      summary: "Check my payment",
      description:
        "Confirms the payment with Paystack and credits the wallet if it succeeded. Safe to call repeatedly.",
      parameters: [
        pathParam("reference", "Payment reference from /wallet/fund", {
          pattern: "^FUND-[0-9A-F-]{36}$",
        }),
      ],
      success: {
        description: "Payment status",
        schema: envelope(
          obj({
            reference: str(),
            status: enumOf(["pending", "success", "failed"]),
            amount: num(),
          }),
        ),
      },
      errors: [400, 404, 502],
    }),
  },

  // ── KYC ────────────────────────────────────────────────────────
  "/kyc/submit": {
    post: op({
      tag: "KYC",
      summary: "Submit NIN and BVN for Tier 2",
      description:
        "Stored encrypted (AES-256-GCM) and never returned in full. This project uses test values, and the format check is the only check.",
      body: obj(
        {
          nin: str("11 digits", { pattern: "^\\d{11}$" }),
          bvn: str("11 digits", { pattern: "^\\d{11}$" }),
        },
        ["nin", "bvn"],
      ),
      example: { nin: "12345678901", bvn: "10987654321" },
      success: { description: "Submitted, pending review" },
      errors: [400],
    }),
  },
  "/kyc/status": {
    get: op({
      tag: "KYC",
      summary: "My KYC status",
      success: {
        description: "Status with masked values",
        schema: envelope(obj({ kyc: ref("KycStatus") })),
      },
    }),
  },

  // ── Notifications ──────────────────────────────────────────────
  "/notifications": {
    get: op({
      tag: "Notifications",
      summary: "My notifications",
      parameters: [
        ...pageParams,
        queryParam("unreadOnly", bool(), "Only unread notifications"),
      ],
      success: {
        description: "Notifications",
        schema: envelope(ref("NotificationList")),
      },
    }),
  },
  "/notifications/read-all": {
    patch: op({
      tag: "Notifications",
      summary: "Mark all as read",
      success: { description: "Done" },
    }),
  },
  "/notifications/{id}/read": {
    patch: op({
      tag: "Notifications",
      summary: "Mark one as read",
      parameters: [idParam("Notification")],
      success: {
        description: "Updated",
        schema: envelope(obj({ notification: ref("Notification") })),
      },
      errors: [400, 404],
    }),
  },
  "/notifications/{id}": {
    delete: op({
      tag: "Notifications",
      summary: "Delete a notification",
      parameters: [idParam("Notification")],
      success: { description: "Deleted" },
      errors: [400, 404],
    }),
  },

  // ── Onboarding ─────────────────────────────────────────────────
  "/onboarding/status": {
    get: op({
      tag: "Onboarding",
      summary: "Onboarding progress",
      description: "Which steps are done and what to do next.",
      success: {
        description: "Progress",
        schema: envelope(obj({ onboarding: ref("OnboardingStatus") })),
      },
    }),
  },

  // ── Feedback ───────────────────────────────────────────────────
  "/feedback": {
    post: op({
      tag: "Feedback",
      summary: "Send feedback",
      description: "Limited to 5 per hour per user.",
      body: obj(
        {
          category: enumOf(["bug", "feature_request", "complaint", "general"]),
          message: str("10 to 1000 characters"),
          rating: int("Optional, 1 to 5", { minimum: 1, maximum: 5 }),
        },
        ["category", "message"],
      ),
      success: {
        code: 201,
        description: "Feedback received",
        schema: envelope(obj({ feedback: ref("Feedback") })),
      },
      errors: [400, 429],
    }),
    get: op({
      tag: "Feedback",
      summary: "All feedback",
      auth: "admin",
      parameters: [
        ...pageParams,
        queryParam(
          "status",
          enumOf(["open", "reviewed", "resolved"]),
          "Filter by status",
        ),
        queryParam(
          "category",
          enumOf(["bug", "feature_request", "complaint", "general"]),
          "Filter by category",
        ),
      ],
      success: {
        description: "Feedback with authors",
        schema: envelope(ref("FeedbackList")),
      },
    }),
  },
  "/feedback/mine": {
    get: op({
      tag: "Feedback",
      summary: "My feedback",
      parameters: pageParams,
      success: {
        description: "Your feedback, without admin notes",
        schema: envelope(ref("FeedbackList")),
      },
    }),
  },
  "/feedback/{id}": {
    patch: op({
      tag: "Feedback",
      summary: "Update feedback status or note",
      auth: "admin",
      parameters: [idParam("Feedback")],
      body: obj({
        status: enumOf(["open", "reviewed", "resolved"]),
        adminNote: str("Up to 500 characters"),
      }),
      success: {
        description: "Updated",
        schema: envelope(obj({ feedback: ref("Feedback") })),
      },
      errors: [400, 404],
    }),
    delete: op({
      tag: "Feedback",
      summary: "Delete feedback",
      auth: "admin",
      parameters: [idParam("Feedback")],
      success: { description: "Deleted" },
      errors: [400, 404],
    }),
  },

  // ── AI ─────────────────────────────────────────────────────────
  "/ai/status": {
    get: op({
      tag: "AI",
      summary: "AI provider status and my remaining budget",
      success: {
        description: "Status",
        schema: envelope(
          obj({
            provider: str(),
            modelAnswersEnabled: bool(),
            dailyLimit: int(),
            remainingToday: int(),
          }),
        ),
      },
    }),
  },
  "/ai/insights": {
    get: op({
      tag: "AI",
      summary: "Spending insights",
      description:
        "The figures are computed in code, from your own transactions only, and always returned. With `narrate=true` and a configured provider, a short Gemini summary is added; if the provider is unavailable the figures are still returned.",
      parameters: [
        queryParam(
          "days",
          int(undefined, { minimum: 7, maximum: 90, default: 30 }),
          "Period length",
        ),
        queryParam("narrate", bool(), "Add a written summary"),
      ],
      success: {
        description: "Insights",
        schema: envelope(
          obj({
            insights: ref("Insights"),
            narrative: obj({
              text: str(undefined, { nullable: true }),
              source: str(undefined, { nullable: true }),
              status: enumOf([
                "not_requested",
                "ok",
                "disabled",
                "limit_reached",
                "busy",
                "unavailable",
              ]),
            }),
          }),
        ),
      },
      errors: [400, 429],
    }),
  },
  "/ai/categorize": {
    get: op({
      tag: "AI",
      summary: "My transactions with categories",
      description:
        "Rule-based categories, so it costs nothing and needs no provider.",
      parameters: pageParams,
      success: {
        description: "Transactions with a category each",
        schema: envelope(ref("TransactionList")),
      },
      errors: [400, 429],
    }),
  },
  "/ai/chat": {
    post: op({
      tag: "AI",
      summary: "Ask the support assistant",
      description:
        "Answers from a built-in FAQ first. Other questions go to Gemini (when configured) with long numbers and emails removed, and fall back to a safe answer otherwise. The assistant cannot see accounts or balances.",
      body: obj({ message: str("1 to 500 characters") }, ["message"]),
      example: { message: "How do I fund my wallet?" },
      success: { description: "Answer", schema: envelope(ref("ChatAnswer")) },
      errors: [400, 429],
    }),
  },

  // ── Admin ──────────────────────────────────────────────────────
  "/admin/users": {
    get: op({
      tag: "Admin",
      summary: "List users",
      auth: "admin",
      parameters: [
        ...pageParams,
        queryParam(
          "status",
          enumOf(["active", "suspended", "frozen"]),
          "Filter by status",
        ),
        queryParam("role", enumOf(["user", "admin"]), "Filter by role"),
        queryParam(
          "kycStatus",
          enumOf(["not_started", "pending", "verified", "rejected"]),
          "Filter by KYC status",
        ),
        queryParam(
          "search",
          str(undefined, { maxLength: 50 }),
          "Name, email or phone (literal text)",
        ),
      ],
      success: {
        description: "Users, without sensitive fields",
        schema: envelope(
          obj({ users: arr(ref("AdminUser")), pagination: ref("Pagination") }),
        ),
      },
      errors: [400],
    }),
  },
  "/admin/users/{id}": {
    get: op({
      tag: "Admin",
      summary: "Get a user with wallet and masked KYC",
      auth: "admin",
      parameters: [idParam("User")],
      success: {
        description: "User detail",
        schema: envelope(
          obj({
            user: ref("AdminUser"),
            wallet: ref("Wallet"),
            transactionCount: int(),
          }),
        ),
      },
      errors: [400, 404],
    }),
  },
  "/admin/users/{id}/freeze": {
    patch: op({
      tag: "Admin",
      summary: "Freeze an account",
      description:
        "The user and wallet status and the audit entry change in one database transaction. Admins cannot be frozen.",
      auth: "admin",
      parameters: [idParam("User")],
      body: obj({ reason: str("5 to 200 characters") }, ["reason"]),
      success: { description: "Account frozen" },
      errors: [400, 404],
    }),
  },
  "/admin/users/{id}/unfreeze": {
    patch: op({
      tag: "Admin",
      summary: "Unfreeze an account",
      auth: "admin",
      parameters: [idParam("User")],
      body: obj({ reason: str("Optional, up to 200 characters") }),
      success: { description: "Account unfrozen" },
      errors: [400, 404],
    }),
  },
  "/admin/wallets/{userId}": {
    get: op({
      tag: "Admin",
      summary: "Get any user's wallet",
      auth: "admin",
      parameters: [
        pathParam("userId", "User id", { pattern: "^[a-f0-9]{24}$" }),
      ],
      success: {
        description: "Wallet",
        schema: envelope(obj({ wallet: ref("Wallet") })),
      },
      errors: [400, 404],
    }),
  },
  "/admin/transactions": {
    get: op({
      tag: "Admin",
      summary: "All transactions",
      description:
        "Each transfer is stored as a debit and a credit record. The default view shows debits only, so every transfer appears once. Use `direction=all` for both.",
      auth: "admin",
      parameters: [
        ...pageParams,
        queryParam(
          "status",
          enumOf(["pending", "success", "failed"]),
          "Filter by status",
        ),
        queryParam(
          "type",
          enumOf(["transfer", "reversal", "funding"]),
          "Filter by type",
        ),
        queryParam(
          "direction",
          enumOf(["debit", "credit", "all"]),
          "Default: debit",
        ),
        queryParam(
          "userId",
          str(undefined, { pattern: "^[a-f0-9]{24}$" }),
          "Only transactions involving this user",
        ),
        queryParam("startDate", date(), "From this date"),
        queryParam("endDate", date(), "Up to this date"),
      ],
      success: {
        description: "Transactions",
        schema: envelope(ref("TransactionList")),
      },
      errors: [400],
    }),
  },
  "/admin/stats": {
    get: op({
      tag: "Admin",
      summary: "Platform statistics",
      auth: "admin",
      success: {
        description: "Statistics",
        schema: envelope(
          obj({
            stats: obj({
              users: obj({ total: int(), verified: int(), frozen: int() }),
              kyc: obj({ pending: int(), verified: int() }),
              transfers: obj({ total: int(), volume: num(), last24h: int() }),
              wallets: obj({ total: int(), totalBalance: num() }),
            }),
          }),
        ),
      },
    }),
  },
  "/admin/kyc/pending": {
    get: op({
      tag: "Admin",
      summary: "KYC review queue",
      description: "Oldest first. NIN and BVN are masked, even for admins.",
      auth: "admin",
      parameters: pageParams,
      success: {
        description: "Pending requests",
        schema: envelope(
          obj({
            requests: arr(
              obj({
                id: str(),
                firstName: str(),
                lastName: str(),
                email: str(),
                requestedTier: int(),
                submittedAt: date(),
                nin: str(),
                bvn: str(),
              }),
            ),
            pagination: ref("Pagination"),
          }),
        ),
      },
      errors: [400],
    }),
  },
  "/admin/kyc/{id}": {
    patch: op({
      tag: "Admin",
      summary: "Approve or reject a KYC request",
      description:
        "Approval raises the tier and the wallet daily limit. A rejection needs a reason. Admins cannot review their own KYC.",
      auth: "admin",
      parameters: [idParam("User")],
      body: obj(
        {
          decision: enumOf(["approve", "reject"]),
          reason: str("Required when rejecting, 5 to 200 characters"),
        },
        ["decision"],
      ),
      example: { decision: "reject", reason: "NIN could not be verified" },
      success: { description: "Reviewed" },
      errors: [400, 404],
    }),
  },
  "/admin/audit-logs": {
    get: op({
      tag: "Admin",
      summary: "Audit log of admin actions",
      auth: "admin",
      parameters: [
        ...pageParams,
        queryParam(
          "action",
          enumOf(["freeze_user", "unfreeze_user", "kyc_approve", "kyc_reject"]),
          "Filter by action",
        ),
      ],
      success: {
        description: "Log entries, newest first",
        schema: envelope(
          obj({ logs: arr(ref("AuditLog")), pagination: ref("Pagination") }),
        ),
      },
      errors: [400],
    }),
  },
};
