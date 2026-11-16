import request from "supertest";
import app from "../app.js";
import { api } from "./helpers.js";

beforeAll(() => {
  process.env.RATE_LIMIT_ENABLED = "true";
});
afterAll(() => {
  delete process.env.RATE_LIMIT_ENABLED;
});

describe("register limiter", () => {
  it("allows 10 attempts per hour per IP, then returns 429", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await request(app).post(`${api}/auth/register`).send({});
      expect(res.status).toBe(400);
    }
    const blocked = await request(app).post(`${api}/auth/register`).send({});
    expect(blocked.status).toBe(429);
    expect(blocked.body.status).toBe("error");
  });
});

describe("otp limiter", () => {
  it("is shared across forgot-password and reset-password", async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post(`${api}/auth/forgot-password`)
        .send({ email: "a@test.com" });
    }
    for (let i = 0; i < 5; i++) {
      await request(app).post(`${api}/auth/reset-password`).send({});
    }
    const blocked = await request(app)
      .post(`${api}/auth/forgot-password`)
      .send({ email: "a@test.com" });
    expect(blocked.status).toBe(429);
  });
});
