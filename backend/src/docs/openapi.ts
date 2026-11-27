import { Json, int, ref } from "./helpers.js";
import { paths } from "./paths.js";
import { schemas } from "./schemas.js";

export const TAGS: { name: string; description: string }[] = [
  { name: "System", description: "Server health and status" },
  { name: "Auth", description: "Registration, login, OTP, and password reset" },
  { name: "Users", description: "Profile, password, and transaction PIN" },
  { name: "Onboarding", description: "Account onboarding progress" },
  { name: "Wallet", description: "Balances, account lookup, funding, and transfers" },
  { name: "Payments", description: "Paystack webhook and verification" },
  { name: "Transactions", description: "Transaction history and details" },
  { name: "KYC", description: "Identity verification submissions and status" },
  { name: "Notifications", description: "In-app alerts and read status" },
  { name: "Feedback", description: "User feedback and admin review" },
  { name: "AI", description: "Spending insights, categorization, and assistant" },
  { name: "Admin", description: "Admin user, KYC, transaction, and audit management" },
];

const errorResponse = (description: string, schemaName = "Error"): Json => ({
  description,
  content: {
    "application/json": { schema: ref(schemaName) },
  },
});

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "NIBSS Wallet API",
    version: "1.0.0",
    description:
      "REST API for the NIBSS Wallet demo application (test mode only).",
  },
  servers: [{ url: "/api/v1" }],
  tags: TAGS,
  paths,
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "refreshToken",
      },
    },
    parameters: {
      Page: {
        name: "page",
        in: "query",
        required: false,
        description: "Page number (1-indexed)",
        schema: int(undefined, { minimum: 1, default: 1 }),
      },
      Limit: {
        name: "limit",
        in: "query",
        required: false,
        description: "Items per page",
        schema: int(undefined, { minimum: 1, maximum: 100, default: 20 }),
      },
    },
    responses: {
      BadRequest: errorResponse("Bad request or validation error", "ValidationError"),
      Unauthorized: errorResponse("Missing or invalid authentication"),
      Forbidden: errorResponse("Insufficient permissions or account restricted"),
      NotFound: errorResponse("Resource not found"),
      Conflict: errorResponse("Resource conflict or duplicate request"),
      TooManyRequests: errorResponse("Rate limit exceeded"),
      BadGateway: errorResponse("Upstream payment provider error"),
    },
    schemas,
  },
};
