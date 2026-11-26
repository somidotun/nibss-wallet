import request from "supertest";
import mongoose from "mongoose";
import { jest } from "@jest/globals";
import app from "../app.js";
import Transaction from "../models/transaction.model.js";
import { categorizeTransaction } from "../services/ai/categorize.js";
import { findFaqAnswer } from "../services/ai/faq.js";
import { redact } from "../services/ai/ai.service.js";
import { tryConsume } from "../services/ai/usage.js";
import {
  api,
  authHeader,
  balanceOf,
  createVerifiedUser,
  setPin,
  transfer,
  TestUser,
} from "./helpers.js";

const ENV_KEYS = [
  "AI_PROVIDER",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "AI_USER_DAILY_LIMIT",
  "AI_GLOBAL_DAILY_LIMIT",
];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  ENV_KEYS.forEach((k) => {
    saved[k] = process.env[k];
    delete process.env[k];
  });
});
afterEach(() => {
  ENV_KEYS.forEach((k) => {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  });
  jest.restoreAllMocks();
});

const enableGemini = (extra: Record<string, string> = {}) =>
  Object.assign(process.env, {
    AI_PROVIDER: "gemini",
    GEMINI_API_KEY: "test-gemini-key",
    GEMINI_MODEL: "test-flash",
    ...extra,
  });

const mockGemini = (text: string | null = "Test summary.", status = 200) =>
  jest.spyOn(globalThis, "fetch").mockImplementation(async () => {
    const body =
      text === null
        ? { candidates: [] }
        : { candidates: [{ content: { parts: [{ text }] } }] };
    return new Response(JSON.stringify(body), { status });
  });

const sentBody = (spy: ReturnType<typeof mockGemini>) =>
  JSON.parse(String(spy.mock.calls[0][1]?.body));

const get = (user: TestUser, path: string) =>
  request(app).get(`${api}/ai${path}`).set(authHeader(user.token));

const chat = (user: TestUser, message: unknown) =>
  request(app)
    .post(`${api}/ai/chat`)
    .set(authHeader(user.token))
    .send({ message });

describe("pure helpers", () => {
  it.each([
    ["Electricity bill", "bills"],
    ["MTN airtime", "airtime"],
    ["Airtime data", "airtime"],
    ["Uber to work", "transport"],
    ["Lunch with friends", "food"],
    ["Database fee", "other"],
    ["Transfer", "other"],
    [undefined, "other"],
  ])("categorizes %s as %s", (description, expected) => {
    expect(categorizeTransaction(description as string | undefined)).toBe(
      expected,
    );
  });

  it("finds the right FAQ, and not on partial words", () => {
    expect(findFaqAnswer("How do I fund my wallet?")?.id).toBe("funding");
    expect(findFaqAnswer("Why did my transfer fail?")?.id).toBe(
      "transfer_failed",
    );
    expect(findFaqAnswer("what are the tier limits")?.id).toBe("limits");
    expect(findFaqAnswer("I want a refund")).toBeNull();
    expect(findFaqAnswer("what is the weather today")).toBeNull();
  });

  it("redacts long numbers, spaced card numbers and emails", () => {
    const out = redact(
      "BVN 12345678901, card 4084 0840 8408 4081, mail a@b.com, PIN 1234",
    );
    expect(out).not.toMatch(/\d{6}/);
    expect(out).toContain("[number]");
    expect(out).toContain("[email]");
    expect(out).toContain("1234"); // short numbers are left alone
  });

  it("never lets more calls through than the limit, even concurrently", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => tryConsume("user:test", 5)),
    );
    expect(results.filter(Boolean)).toHaveLength(5);
  });
});

describe("access control", () => {
  it.each([
    ["get", "/status"],
    ["get", "/insights"],
    ["get", "/categorize"],
    ["post", "/chat"],
  ] as const)("%s %s requires a token", async (method, path) => {
    const res = await request(app)[method](`${api}/ai${path}`);
    expect(res.status).toBe(401);
  });
});

describe("GET /ai/status", () => {
  it("reports none without a key, and the remaining budget with one", async () => {
    const user = await createVerifiedUser();
    const off = await get(user, "/status");
    expect(off.body.data).toMatchObject({
      provider: "none",
      modelAnswersEnabled: false,
      remainingToday: 0,
    });

    enableGemini({ AI_USER_DAILY_LIMIT: "4" });
    const on = await get(user, "/status");
    expect(on.body.data).toMatchObject({
      provider: "gemini",
      dailyLimit: 4,
      remainingToday: 4,
    });
  });
});

describe("GET /ai/insights", () => {
  let a: TestUser;
  let b: TestUser;

  beforeEach(async () => {
    a = await createVerifiedUser();
    b = await createVerifiedUser();
    await setPin(a.token);
    await setPin(b.token);
  });

  it("works for a user with no activity", async () => {
    const res = await get(a, "/insights");
    expect(res.status).toBe(200);
    expect(res.body.data.insights.totals.spent).toBe(0);
    expect(res.body.data.insights.observations[0]).toContain(
      "not sent any money",
    );
    expect(res.body.data.narrative.status).toBe("not_requested");
  });

  it("computes totals, categories, recipients and the largest transfer", async () => {
    await transfer(a, b, 5000, { description: "Lunch with friends" });
    await transfer(a, b, 3000, { description: "Electricity bill" });
    await transfer(b, a, 1000, { description: "refund" });

    const { insights } = (await get(a, "/insights")).body.data;
    expect(insights.totals).toMatchObject({
      spent: 8000,
      received: 1000,
      sentCount: 2,
      averageTransfer: 4000,
    });
    expect(insights.totals.net).toBe(-7000);
    expect(insights.largest).toMatchObject({ amount: 5000, category: "food" });
    expect(insights.topRecipients[0]).toMatchObject({ total: 8000, count: 2 });
    expect(insights.categories[0]).toMatchObject({
      category: "food",
      total: 5000,
      percent: 63,
    });
    expect(insights.observations.some((o: string) => o.includes("food"))).toBe(
      true,
    );
    expect(
      insights.observations.some((o: string) => o.includes("spent more than")),
    ).toBe(true);
  });

  it("compares with the previous period", async () => {
    await transfer(a, b, 1000, { description: "old" });
    await Transaction.collection.updateMany(
      { senderId: new mongoose.Types.ObjectId(a.id) },
      { $set: { createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) } },
    );
    await transfer(a, b, 2000, { description: "new" });

    const { insights } = (await get(a, "/insights?days=30")).body.data;
    expect(insights.totals.spent).toBe(2000);
    expect(insights.comparison).toEqual({
      previousSpent: 1000,
      changePercent: 100,
    });
    expect(
      insights.observations.some((o: string) => o.includes("up 100%")),
    ).toBe(true);
  });

  it("never includes anyone else's data", async () => {
    await transfer(b, a, 4000, { description: "gift" });
    const { insights } = (await get(b, "/insights")).body.data;
    const mine = (await get(a, "/insights")).body.data.insights;
    expect(insights.totals.spent).toBe(4000);
    expect(mine.totals.spent).toBe(0);
    expect(mine.totals.received).toBe(4000);
  });

  it.each(["days=3", "days=200", "days=abc", "narrate=maybe"])(
    "rejects %s",
    async (q) => {
      expect((await get(a, `/insights?${q}`)).status).toBe(400);
    },
  );

  describe("with narration", () => {
    it("reports disabled when no provider is configured", async () => {
      const res = await get(a, "/insights?narrate=true");
      expect(res.status).toBe(200);
      expect(res.body.data.narrative).toEqual({
        text: null,
        source: null,
        status: "disabled",
      });
    });

    it("adds a Gemini summary and sends only anonymous aggregates", async () => {
      await transfer(a, b, 5000, { description: "Lunch with friends" });
      enableGemini();
      const spy = mockGemini("You spent ₦5,000 this month.");

      const res = await get(a, "/insights?narrate=true");
      expect(res.body.data.narrative).toEqual({
        text: "You spent ₦5,000 this month.",
        source: "gemini",
        status: "ok",
      });

      const [url, init] = spy.mock.calls[0];
      expect(String(url)).toContain("/models/test-flash:generateContent");
      expect(String(url)).not.toContain("test-gemini-key");
      expect((init?.headers as Record<string, string>)["x-goog-api-key"]).toBe(
        "test-gemini-key",
      );

      const payload = String(init?.body);
      for (const secret of [
        "Lunch",
        "Test User",
        a.email,
        b.email,
        b.accountNumber,
        a.accountNumber,
      ]) {
        expect(payload).not.toContain(secret);
      }
      expect(payload).toContain("maxOutputTokens");
    });

    it.each([
      ["a 429 from Gemini", () => mockGemini("x", 429)],
      ["an empty reply", () => mockGemini(null)],
      [
        "a network error",
        () =>
          jest
            .spyOn(globalThis, "fetch")
            .mockImplementation(() => Promise.reject(new Error("down"))),
      ],
    ])("falls back quietly on %s", async (_label, setup) => {
      enableGemini();
      setup();
      jest.spyOn(console, "error").mockImplementation(() => undefined);
      const res = await get(a, "/insights?narrate=true");
      expect(res.status).toBe(200);
      expect(res.body.data.narrative).toEqual({
        text: null,
        source: null,
        status: "unavailable",
      });
      expect(res.body.data.insights.totals).toBeDefined();
    });

    it("stops at the per-user daily limit without calling Gemini again", async () => {
      enableGemini({ AI_USER_DAILY_LIMIT: "2" });
      const spy = mockGemini();
      await get(a, "/insights?narrate=true");
      await get(a, "/insights?narrate=true");
      const third = await get(a, "/insights?narrate=true");
      expect(third.body.data.narrative.status).toBe("limit_reached");
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it("stops at the global daily budget", async () => {
      enableGemini({ AI_GLOBAL_DAILY_LIMIT: "1" });
      const spy = mockGemini();
      await get(a, "/insights?narrate=true");
      const other = await get(b, "/insights?narrate=true");
      expect(other.body.data.narrative.status).toBe("busy");
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});

describe("GET /ai/categorize", () => {
  it("categorizes spending, marks received money as income and paginates", async () => {
    const a = await createVerifiedUser();
    const b = await createVerifiedUser();
    await setPin(a.token);
    await setPin(b.token);
    await transfer(a, b, 500, { description: "MTN airtime" });
    await transfer(a, b, 600, { description: "Uber to work" });
    await transfer(b, a, 700, { description: "thanks" });

    const res = await get(a, "/categorize");
    const byDescription = Object.fromEntries(
      res.body.data.transactions.map(
        (t: { description: string; category: string }) => [
          t.description,
          t.category,
        ],
      ),
    );
    expect(byDescription).toEqual({
      "MTN airtime": "airtime",
      "Uber to work": "transport",
      thanks: "income",
    });

    const page = await get(a, "/categorize?limit=2");
    expect(page.body.data.transactions).toHaveLength(2);
    expect(page.body.data.pagination.hasNextPage).toBe(true);
  });

  it("rejects bad paging", async () => {
    const user = await createVerifiedUser();
    expect((await get(user, "/categorize?limit=0")).status).toBe(400);
  });
});

describe("POST /ai/chat", () => {
  let user: TestUser;
  beforeEach(async () => {
    user = await createVerifiedUser();
  });

  it("answers from the FAQ without calling a model or using any budget", async () => {
    enableGemini();
    const spy = mockGemini();
    const res = await chat(user, "How do I fund my wallet?");
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ source: "faq", topic: "funding" });
    expect(res.body.data.answer).toContain("Paystack");
    expect(spy).not.toHaveBeenCalled();
    expect((await get(user, "/status")).body.data.remainingToday).toBe(10);
  });

  it("explains failed transfers and says no money is deducted", async () => {
    const res = await chat(user, "why did my transfer fail");
    expect(res.body.data.answer).toContain("no money is deducted");
  });

  it("uses the safe fallback when no provider is configured", async () => {
    const res = await chat(user, "what is the weather today");
    expect(res.body.data).toMatchObject({
      source: "fallback",
      reason: "disabled",
    });
  });

  it("asks Gemini for questions the FAQ cannot answer, with redacted input", async () => {
    enableGemini();
    const spy = mockGemini("Please contact support about that.");
    const res = await chat(
      user,
      "My phone is 12345678901, email me at a@b.com about the weather",
    );
    expect(res.body.data).toEqual({
      answer: "Please contact support about that.",
      source: "gemini",
    });

    const payload = sentBody(spy);
    const text = JSON.stringify(payload);
    expect(text).not.toContain("12345678901");
    expect(text).not.toContain("a@b.com");
    expect(payload.system_instruction.parts[0].text).toContain("untrusted");
    expect(payload.contents[0].parts[0].text).toContain("[number]");
  });

  it("never sends any account data to the model", async () => {
    enableGemini();
    const spy = mockGemini();
    await chat(user, "tell me something unrelated");
    const text = JSON.stringify(sentBody(spy));
    for (const secret of [
      user.email,
      user.accountNumber,
      String(await balanceOf(user)),
    ]) {
      expect(text).not.toContain(secret);
    }
  });

  it("falls back when Gemini fails or the limit is reached", async () => {
    enableGemini({ AI_USER_DAILY_LIMIT: "1" });
    mockGemini("x", 429);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const failed = await chat(user, "something unrelated one");
    expect(failed.body.data).toMatchObject({
      source: "fallback",
      reason: "unavailable",
    });
    const limited = await chat(user, "something unrelated two");
    expect(limited.body.data).toMatchObject({
      source: "fallback",
      reason: "limit_reached",
    });
  });

  it.each([
    ["an empty message", ""],
    ["whitespace only", "   "],
    ["a message over 500 characters", "x".repeat(501)],
    ["a number", 42],
    ["an object", { text: "hi" }],
  ])("rejects %s", async (_label, message) => {
    const res = await chat(user, message);
    expect([400]).toContain(res.status);
  });
});
