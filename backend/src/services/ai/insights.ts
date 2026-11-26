import Transaction from "../../models/transaction.model.js";
import User from "../../models/user.model.js";
import Wallet from "../../models/wallet.model.js";
import { categorizeTransaction } from "./categorize.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const round = (n: number) => Math.round(n * 100) / 100;
const sum = (list: { amount: number }[]) =>
  round(list.reduce((total, t) => total + t.amount, 0));

export const getSpendingInsights = async (userId: string, days: number) => {
  const now = Date.now();
  const periodStart = new Date(now - days * DAY_MS);

  // One query covers this period and the one before, for the comparison
  const rows = await Transaction.find({
    status: "success",
    type: { $in: ["transfer", "funding"] },
    createdAt: { $gte: new Date(now - 2 * days * DAY_MS) },
    $or: [
      { senderId: userId, direction: "debit" },
      { receiverId: userId, direction: "credit" },
    ],
  })
    .select("type direction amount description receiverId createdAt")
    .sort({ createdAt: -1 })
    .limit(1000)
    .lean();

  const current = rows.filter((t) => new Date(t.createdAt) >= periodStart);
  const before = rows.filter((t) => new Date(t.createdAt) < periodStart);
  const isSpend = (t: (typeof rows)[number]) =>
    t.type === "transfer" && t.direction === "debit";

  const spent = current.filter(isSpend);
  const totalSpent = sum(spent);
  const previousSpent = sum(before.filter(isSpend));
  const received = sum(
    current.filter((t) => t.type === "transfer" && t.direction === "credit"),
  );
  const funded = sum(current.filter((t) => t.type === "funding"));

  const changePercent =
    previousSpent > 0
      ? Math.round(((totalSpent - previousSpent) / previousSpent) * 100)
      : null;

  // Recipients and largest transfer
  const recipientIds = [...new Set(spent.map((t) => String(t.receiverId)))];
  const people = await User.find({ _id: { $in: recipientIds } })
    .select("firstName lastName")
    .lean();
  const nameOf = new Map(
    people.map((u) => [String(u._id), `${u.firstName} ${u.lastName}`]),
  );

  const byRecipient = new Map<string, { total: number; count: number }>();
  for (const t of spent) {
    const id = String(t.receiverId);
    const entry = byRecipient.get(id) ?? { total: 0, count: 0 };
    entry.total += t.amount;
    entry.count += 1;
    byRecipient.set(id, entry);
  }
  const topRecipients = [...byRecipient.entries()]
    .map(([id, v]) => ({
      name: nameOf.get(id) ?? "Unknown",
      total: round(v.total),
      count: v.count,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  const largestRow = spent.reduce<(typeof spent)[number] | null>(
    (max, t) => (!max || t.amount > max.amount ? t : max),
    null,
  );
  const largest = largestRow
    ? {
        amount: largestRow.amount,
        to: nameOf.get(String(largestRow.receiverId)) ?? "Unknown",
        date: largestRow.createdAt,
        category: categorizeTransaction(largestRow.description),
      }
    : null;

  // Spending by category
  const byCategory = new Map<string, { total: number; count: number }>();
  for (const t of spent) {
    const category = categorizeTransaction(t.description);
    const entry = byCategory.get(category) ?? { total: 0, count: 0 };
    entry.total += t.amount;
    entry.count += 1;
    byCategory.set(category, entry);
  }
  const categories = [...byCategory.entries()]
    .map(([category, v]) => ({
      category,
      total: round(v.total),
      count: v.count,
      percent: totalSpent > 0 ? Math.round((v.total / totalSpent) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // How much of today's transfer limit is used
  const wallet = await Wallet.findOne({ userId })
    .select("dailyTransferLimit dailyTransferUsed lastTransferReset")
    .lean();
  const usedToday =
    wallet &&
    new Date(wallet.lastTransferReset).toDateString() ===
      new Date().toDateString()
      ? wallet.dailyTransferUsed
      : 0;
  const limitPercent =
    wallet && wallet.dailyTransferLimit > 0
      ? Math.round((usedToday / wallet.dailyTransferLimit) * 100)
      : 0;

  // Plain-language observations from simple rules
  const observations: string[] = [];
  if (spent.length === 0) {
    observations.push(`You have not sent any money in the last ${days} days.`);
  } else {
    if (changePercent !== null && changePercent >= 25) {
      observations.push(
        `Your spending is up ${changePercent}% compared with the previous ${days} days.`,
      );
    } else if (changePercent !== null && changePercent <= -25) {
      observations.push(
        `Your spending is down ${Math.abs(changePercent)}% compared with the previous ${days} days.`,
      );
    }
    const top = categories[0];
    if (top && top.category !== "other" && top.percent >= 50) {
      observations.push(
        `${top.percent}% of your spending went on ${top.category}.`,
      );
    }
    if (totalSpent > received + funded) {
      observations.push(
        "You spent more than you received or added in this period.",
      );
    }
  }
  if (limitPercent >= 80) {
    observations.push(
      `You have used ${limitPercent}% of today's transfer limit.`,
    );
  }

  return {
    period: {
      days,
      from: periodStart.toISOString(),
      to: new Date(now).toISOString(),
    },
    totals: {
      spent: totalSpent,
      received,
      funded,
      net: round(received + funded - totalSpent),
      sentCount: spent.length,
      averageTransfer: spent.length ? round(totalSpent / spent.length) : 0,
      dailyAverage: round(totalSpent / days),
    },
    comparison: { previousSpent, changePercent },
    largest,
    topRecipients,
    categories,
    dailyLimit: { percentUsed: limitPercent },
    observations,
  };
};

export type SpendingInsights = Awaited<ReturnType<typeof getSpendingInsights>>;
