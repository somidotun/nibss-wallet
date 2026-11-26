import AiUsage from "../../models/aiUsage.model.js";

const today = () => new Date().toISOString().slice(0, 10); // UTC day

const increment = (key: string, day: string) =>
  AiUsage.findOneAndUpdate(
    { key, day },
    { $inc: { count: 1 } },
    { upsert: true, new: true },
  );

// Atomic: concurrent callers each get a distinct count, so the limit holds
export const tryConsume = async (
  key: string,
  limit: number,
): Promise<boolean> => {
  const day = today();
  let doc;
  try {
    doc = await increment(key, day);
  } catch (error) {
    // two first-ever calls can race on the unique index; the loser just increments
    if ((error as { code?: number }).code === 11000)
      doc = await increment(key, day);
    else throw error;
  }
  return doc!.count <= limit;
};

export const usedToday = async (key: string): Promise<number> =>
  (await AiUsage.findOne({ key, day: today() }))?.count ?? 0;

export const userLimit = (): number =>
  Number(process.env.AI_USER_DAILY_LIMIT ?? 10);
export const globalLimit = (): number =>
  Number(process.env.AI_GLOBAL_DAILY_LIMIT ?? 100);
