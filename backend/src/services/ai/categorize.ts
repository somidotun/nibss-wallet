export type Category =
  | "airtime"
  | "bills"
  | "transport"
  | "food"
  | "rent"
  | "shopping"
  | "savings"
  | "family"
  | "other";

// First match wins, so order matters ("airtime data" is airtime, not bills)
const RULES: [Category, string[]][] = [
  ["airtime", ["airtime", "recharge", "mtn", "glo", "airtel"]],
  [
    "bills",
    [
      "bill",
      "bills",
      "electricity",
      "nepa",
      "light",
      "water",
      "internet",
      "data",
      "wifi",
      "subscription",
      "dstv",
    ],
  ],
  [
    "transport",
    [
      "transport",
      "fuel",
      "petrol",
      "uber",
      "bolt",
      "taxi",
      "bus",
      "fare",
      "ride",
    ],
  ],
  [
    "food",
    [
      "food",
      "lunch",
      "dinner",
      "breakfast",
      "restaurant",
      "groceries",
      "grocery",
      "snack",
    ],
  ],
  ["rent", ["rent", "landlord", "hostel"]],
  ["shopping", ["shopping", "clothes", "shoes", "market"]],
  ["savings", ["savings", "save", "ajo", "thrift", "investment"]],
  [
    "family",
    ["family", "mum", "mom", "dad", "brother", "sister", "gift", "allowance"],
  ],
];

const COMPILED = RULES.map(
  ([category, words]) =>
    [category, new RegExp(`\\b(${words.join("|")})\\b`, "i")] as [
      Category,
      RegExp,
    ],
);

export const categorizeTransaction = (description?: string): Category => {
  if (!description) return "other";
  return COMPILED.find(([, rx]) => rx.test(description))?.[0] ?? "other";
};
