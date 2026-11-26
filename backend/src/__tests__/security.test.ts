import request from "supertest";
import app from "../app.js";
import { validateEnv } from "../config/env.js";
import { api } from "./helpers.js";

describe("operator guard", () => {
  it("rejects an operator object in the body", async () => {
    const res = await request(app)
      .post(`${api}/auth/login`)
      .send({ email: "a@test.com", password: { $ne: null } });
    expect(res.status).toBe(400);
  });

  it("rejects nested operator keys and dotted keys", async () => {
    const nested = await request(app)
      .post(`${api}/auth/login`)
      .send({
        email: "a@test.com",
        password: "x",
        meta: { deep: { $gt: "" } },
      });
    const dotted = await request(app)
      .post(`${api}/auth/login`)
      .send({ email: "a@test.com", "password.x": "x" });
    expect(nested.status).toBe(400);
    expect(dotted.status).toBe(400);
  });

  it("rejects operator syntax in the query string", async () => {
    const res = await request(app).get(`${api}/anything?status[$ne]=x`);
    expect(res.status).toBe(400);
  });

  it("lets normal requests through", async () => {
    const res = await request(app)
      .post(`${api}/auth/login`)
      .send({ email: "nobody@test.com", password: "Password123!" });
    expect(res.status).toBe(401);
  });
});

describe("request size", () => {
  it("returns 413 for a body over 10kb", async () => {
    const res = await request(app)
      .post(`${api}/auth/login`)
      .send({ email: "a@test.com", password: "x".repeat(20000) });
    expect(res.status).toBe(413);
    expect(res.body.message).toBe("Request body too large");
  });
});

describe("validateEnv", () => {
  const base = {
    MONGO_URI: "mongodb://localhost/test",
    JWT_ACCESS_SECRET: "a".repeat(40),
    JWT_REFRESH_SECRET: "b".repeat(40),
    ENCRYPTION_KEY: "c".repeat(40),
  } as NodeJS.ProcessEnv;

  const prod = {
    ...base,
    NODE_ENV: "production",
    RESEND_API_KEY: "re_x",
    FRONTEND_URL: "https://app.example.com",
    PAYSTACK_SECRET_KEY: "sk_test_x",
  } as NodeJS.ProcessEnv;

  it("accepts a valid development and production configuration", () => {
    expect(validateEnv(base)).toEqual([]);
    expect(validateEnv(prod)).toEqual([]);
  });

  it("reports missing required variables", () => {
    const problems = validateEnv({} as NodeJS.ProcessEnv);
    expect(problems).toEqual(
      expect.arrayContaining([
        "MONGO_URI is not set",
        "ENCRYPTION_KEY is not set",
      ]),
    );
  });

  it("requires email and frontend settings in production", () => {
    const problems = validateEnv({
      ...prod,
      RESEND_API_KEY: "",
      FRONTEND_URL: "",
    });
    expect(problems).toEqual(
      expect.arrayContaining([
        "RESEND_API_KEY is not set",
        "FRONTEND_URL is not set",
      ]),
    );
  });

  it("rejects short and placeholder secrets in production only", () => {
    const weak = { ...prod, JWT_ACCESS_SECRET: "short" } as NodeJS.ProcessEnv;
    const placeholder = {
      ...prod,
      ENCRYPTION_KEY: "nibss_wallet_encryption_key_32chars!",
    } as NodeJS.ProcessEnv;
    expect(validateEnv(weak).join()).toContain("at least 32 characters");
    expect(validateEnv(placeholder).join()).toContain("placeholder");
    expect(validateEnv({ ...base, JWT_ACCESS_SECRET: "short" })).toEqual([]);
  });

  it("requires different access and refresh secrets", () => {
    const same = { ...base, JWT_REFRESH_SECRET: base.JWT_ACCESS_SECRET };
    expect(validateEnv(same).join()).toContain("must be different");
  });

  it("refuses a live Paystack key", () => {
    const problems = validateEnv({
      ...base,
      PAYSTACK_SECRET_KEY: "sk_live_abc",
    });
    expect(problems.join()).toContain("Live Paystack keys are not allowed");
    expect(
      validateEnv({ ...base, PAYSTACK_SECRET_KEY: "sk_test_abc" }),
    ).toEqual([]);
  });

  it("checks the AI provider settings", () => {
    expect(validateEnv({ ...base, AI_PROVIDER: "gemini" }).join()).toContain(
      "GEMINI_API_KEY",
    );
    expect(validateEnv({ ...base, AI_PROVIDER: "openai" }).join()).toContain(
      "AI_PROVIDER must be",
    );
    expect(
      validateEnv({ ...base, AI_PROVIDER: "gemini", GEMINI_API_KEY: "k" }),
    ).toEqual([]);
    expect(validateEnv({ ...base, AI_PROVIDER: "none" })).toEqual([]);
  });
});
