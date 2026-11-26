export const APP_NAME = "Nibss Wallet"; // change here when you rename the project

export interface FaqEntry {
  id: string;
  keywords: string[];
  question: string;
  answer: string;
}

export const FAQ: FaqEntry[] = [
  {
    id: "demo",
    keywords: ["real money", "demo", "test mode", "is this real"],
    question: "Is this real money?",
    answer: `${APP_NAME} is a demo running in test mode. Balances and payments are not real money.`,
  },
  {
    id: "funding",
    keywords: ["fund", "top up", "add money", "deposit", "paystack"],
    question: "How do I fund my wallet?",
    answer:
      "Choose Fund wallet, enter an amount from ₦100 to ₦50,000, and pay on the Paystack page. In test mode use a Paystack test card, so no real money is charged. Your balance updates once the payment is confirmed.",
  },
  {
    id: "transfer",
    keywords: [
      "send money",
      "transfer money",
      "how do i transfer",
      "how to transfer",
      "account number",
    ],
    question: "How do I send money?",
    answer:
      "Enter the recipient's 10-digit account number, check the name shown, enter the amount (minimum ₦100) and confirm with your 4-digit transaction PIN. You can download a PDF receipt afterwards.",
  },
  {
    id: "transfer_failed",
    keywords: [
      "fail",
      "failed",
      "not go through",
      "declined",
      "did not work",
      "didn't work",
    ],
    question: "Why did my transfer fail?",
    answer:
      "Common reasons: not enough balance, you reached your daily transfer limit, the transaction PIN was wrong, the account number does not exist, or one of the wallets is frozen. When a transfer fails, no money is deducted.",
  },
  {
    id: "pin",
    keywords: ["pin", "transaction pin"],
    question: "What is the transaction PIN?",
    answer:
      "It is a 4-digit code you set once and enter for every transfer. Keep it private. We will never ask you for it.",
  },
  {
    id: "limits",
    keywords: [
      "limit",
      "tier",
      "kyc",
      "upgrade",
      "verify my identity",
      "nin",
      "bvn",
    ],
    question: "What are the transfer limits and KYC tiers?",
    answer:
      "Tier 1 allows ₦50,000 per day. Submit your NIN and BVN (11 digits each) for Tier 2, which allows ₦200,000 per day after review. Tier 3 has no daily limit and needs admin approval.",
  },
  {
    id: "password",
    keywords: [
      "forgot password",
      "reset password",
      "change password",
      "cannot log in",
      "can't log in",
    ],
    question: "I forgot my password",
    answer:
      "Use Forgot password and enter your email. A 6-digit code is sent that lasts 10 minutes, and you have 5 attempts to enter it correctly. Signing in again is required after a reset.",
  },
  {
    id: "verify_email",
    keywords: ["verify my email", "verification code", "otp", "confirm email"],
    question: "How do I verify my email?",
    answer:
      "Enter the 6-digit code we emailed you within 10 minutes. If it expired, request a new code. Your wallet is created once your email is verified.",
  },
  {
    id: "frozen",
    keywords: ["frozen", "suspended", "locked", "blocked"],
    question: "My account is frozen",
    answer:
      "Frozen accounts cannot log in or move money. Please contact support to have it reviewed.",
  },
  {
    id: "receipt",
    keywords: ["receipt", "proof of payment"],
    question: "Can I get a receipt?",
    answer:
      "Yes. Open a transfer you sent in your history and download its PDF receipt.",
  },
];

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Keywords match at word starts, so "fund" matches "funding" but not "refund"
const COMPILED = FAQ.map((entry) => ({
  entry,
  patterns: entry.keywords.map((k) => new RegExp(`\\b${escapeRegex(k)}`, "i")),
}));

export const findFaqAnswer = (message: string): FaqEntry | null => {
  let best: { entry: FaqEntry; score: number } | null = null;
  for (const { entry, patterns } of COMPILED) {
    const score = patterns.filter((p) => p.test(message)).length;
    if (score > 0 && (!best || score > best.score)) best = { entry, score };
  }
  return best?.entry ?? null;
};
