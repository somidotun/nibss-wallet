import { describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import app from "../app.js";

const baseUrl = "/api/v1/auth";

const testUser = {
  firstName: "Somidotun",
  lastName: "Ayo-oluwole",
  email: "somidotun@test.com",
  phone: "08012345678",
  password: "Password123!",
};

// ─── Register ────────────────────────────────────────────────────
describe("POST /api/v1/auth/register", () => {
  it("should register a new user successfully", async () => {
    const res = await request(app).post(`${baseUrl}/register`).send(testUser);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("success");
    expect(res.body.data.user.email).toBe(testUser.email);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.password).toBeUndefined();
  });

  it("should fail if email already exists", async () => {
    await request(app).post(`${baseUrl}/register`).send(testUser);

    const res = await request(app).post(`${baseUrl}/register`).send(testUser);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe("An account with this email already exists");
  });

  it("should fail if phone already exists", async () => {
    await request(app).post(`${baseUrl}/register`).send(testUser);

    const res = await request(app)
      .post(`${baseUrl}/register`)
      .send({ ...testUser, email: "different@test.com" });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe(
      "An account with this phone number already exists",
    );
  });

  it("should return kyc tier 1 and not_started status", async () => {
    const res = await request(app).post(`${baseUrl}/register`).send(testUser);

    expect(res.body.data.user.kyc.currentTier).toBe(1);
    expect(res.body.data.user.kyc.status).toBe("not_started");
  });
});

// ─── Login ───────────────────────────────────────────────────────
describe("POST /api/v1/auth/login", () => {
  beforeEach(async () => {
    await request(app).post(`${baseUrl}/register`).send(testUser);
  });

  it("should login successfully with correct credentials", async () => {
    const res = await request(app).post(`${baseUrl}/login`).send({
      email: testUser.email,
      password: testUser.password,
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe(testUser.email);
  });

  it("should fail with wrong password", async () => {
    const res = await request(app).post(`${baseUrl}/login`).send({
      email: testUser.email,
      password: "WrongPassword123!",
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid email or password");
  });

  it("should fail with wrong email", async () => {
    const res = await request(app).post(`${baseUrl}/login`).send({
      email: "wrong@test.com",
      password: testUser.password,
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid email or password");
  });

  it("should update lastLogin on successful login", async () => {
    const res = await request(app).post(`${baseUrl}/login`).send({
      email: testUser.email,
      password: testUser.password,
    });

    expect(res.body.data.user.lastLogin).toBeDefined();
  });

  it("should not return password in response", async () => {
    const res = await request(app).post(`${baseUrl}/login`).send({
      email: testUser.email,
      password: testUser.password,
    });

    expect(res.body.data.user.password).toBeUndefined();
  });
});

// ─── Logout ──────────────────────────────────────────────────────
describe("POST /api/v1/auth/logout", () => {
  it("should logout successfully", async () => {
    const res = await request(app).post(`${baseUrl}/logout`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Logged out successfully");
  });
});

// ─── Refresh Token ───────────────────────────────────────────────
describe("POST /api/v1/auth/refresh-token", () => {
  it("should return 401 if no refresh token cookie", async () => {
    const res = await request(app).post(`${baseUrl}/refresh-token`);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("No refresh token provided");
  });

  it("should return new access token with valid refresh token", async () => {
    // Register first then login
    await request(app).post(`${baseUrl}/register`).send(testUser);

    const loginResponse = await request(app).post(`${baseUrl}/login`).send({
      email: testUser.email,
      password: testUser.password,
    });

    const cookie = loginResponse.headers["set-cookie"];

    const res = await request(app)
      .post(`${baseUrl}/refresh-token`)
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });
});
