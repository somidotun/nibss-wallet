import express, { RequestHandler } from "express";
import request from "supertest";
import app from "../app.js";
import { createLimiter } from "../middlewares/rateLimit.middleware.js";
import { api, createVerifiedUser, setPin, transfer } from "./helpers.js";

beforeAll(() => {
  process.env.RATE_LIMIT_ENABLED = "true";
});
afterAll(() => {
  delete process.env.RATE_LIMIT_ENABLED;
});

const buildApp = (limiter: RequestHandler) => {
  const a = express();
  a.get("/ping", limiter, (_req, res) => {
    res.status(200).json({ ok: true });
  });
  a.get("/fail", limiter, (_req, res) => {
    res.status(401).json({});
  });
  return a;
};

describe("createLimiter", () => {
  it("returns a JSON 429 with Retry-After once the limit is passed", async () => {
    const a = buildApp(
      createLimiter({ windowMs: 60000, limit: 2, message: "Slow down" }),
    );
    expect((await request(a).get("/ping")).status).toBe(200);
    expect((await request(a).get("/ping")).status).toBe(200);
    const blocked = await request(a).get("/ping");
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ status: "error", message: "Slow down" });
    expect(blocked.headers["retry-after"]).toBeDefined();
  });

  it("with skipSuccessfulRequests, only failures count", async () => {
    const a = buildApp(
      createLimiter({
        windowMs: 60000,
        limit: 2,
        skipSuccessfulRequests: true,
      }),
    );
    for (let i = 0; i < 5; i++) {
      expect((await request(a).get("/ping")).status).toBe(200);
    }
    expect((await request(a).get("/fail")).status).toBe(401);
    expect((await request(a).get("/fail")).status).toBe(401);
    expect((await request(a).get("/fail")).status).toBe(429);
  });

  it("is skipped in the test environment unless enabled", async () => {
    process.env.RATE_LIMIT_ENABLED = "false";
    const a = buildApp(createLimiter({ windowMs: 60000, limit: 1 }));
    for (let i = 0; i < 3; i++) {
      expect((await request(a).get("/ping")).status).toBe(200);
    }
    process.env.RATE_LIMIT_ENABLED = "true";
  });
});

describe("login limiter", () => {
  it("does not count successful logins", async () => {
    const user = await createVerifiedUser();
    for (let i = 0; i < 12; i++) {
      const res = await request(app)
        .post(`${api}/auth/login`)
        .send({ email: user.email, password: user.password });
      expect(res.status).toBe(200);
    }
  });

  it("blocks the 11th failed attempt, even with the right password", async () => {
    const user = await createVerifiedUser();
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post(`${api}/auth/login`)
        .send({ email: user.email, password: "WrongPass1!" });
      expect(res.status).toBe(401);
    }
    const blocked = await request(app)
      .post(`${api}/auth/login`)
      .send({ email: user.email, password: user.password });
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toContain("login attempts");
  });
});

describe("transfer limiter", () => {
  it("limits each user to 10 attempts a minute, independently", async () => {
    const a = await createVerifiedUser();
    const b = await createVerifiedUser();
    await setPin(a.token);
    await setPin(b.token);

    // Below the 100 minimum, so cheap to send but still counted
    for (let i = 0; i < 10; i++) {
      expect((await transfer(a, b, 50)).status).toBe(400);
    }
    expect((await transfer(a, b, 50)).status).toBe(429);
    expect((await transfer(b, a, 50)).status).toBe(400); // b has its own bucket
  });
});
