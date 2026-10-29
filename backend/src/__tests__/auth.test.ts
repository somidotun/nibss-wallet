import request from "supertest";
import app from "../app.js";
import User from "../models/user.model.js";
import Wallet from "../models/wallet.model.js";
import {
  api,
  authHeader,
  getOtp,
  registerUser,
  createVerifiedUser,
  balanceOf,
} from "./helpers.js";

const login = (email: string, password: string) =>
  request(app).post(`${api}/auth/login`).send({ email, password });

describe("POST /auth/register", () => {
  it("registers a user and returns an access token", async () => {
    const { res } = await registerUser();
    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.body.data.user.kyc.currentTier).toBe(1);
    expect(res.body.data.user.kyc.status).toBe("not_started");
  });

  it("does not create a wallet before email verification", async () => {
    const { id } = await registerUser();
    expect(await Wallet.findOne({ userId: id })).toBeNull();
  });

  it("rejects a duplicate email", async () => {
    const first = await registerUser();
    const { res } = await registerUser({ email: first.body.email });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("An account with this email already exists");
  });

  it("rejects a duplicate phone number", async () => {
    const first = await registerUser();
    const { res } = await registerUser({ phone: first.body.phone });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe(
      "An account with this phone number already exists",
    );
  });

  it("returns field errors for invalid input", async () => {
    const res = await request(app).post(`${api}/auth/register`).send({});
    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });
});

describe("POST /auth/verify-email", () => {
  it("verifies the email and creates a wallet with 50000", async () => {
    const user = await createVerifiedUser();
    expect(await balanceOf(user)).toBe(50000);
  });

  it("rejects a wrong OTP", async () => {
    const { id, token } = await registerUser();
    const real = await getOtp(id);
    const res = await request(app)
      .post(`${api}/auth/verify-email`)
      .set(authHeader(token))
      .send({ otp: real === "123456" ? "654321" : "123456" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid OTP");
  });

  it("rejects an expired OTP", async () => {
    const { id, token } = await registerUser();
    const otp = await getOtp(id);
    await User.updateOne(
      { _id: id },
      { emailVerificationOTPExpiry: new Date(Date.now() - 1000) },
    );
    const res = await request(app)
      .post(`${api}/auth/verify-email`)
      .set(authHeader(token))
      .send({ otp });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expired/i);
  });

  it("rejects a request with no token", async () => {
    const res = await request(app)
      .post(`${api}/auth/verify-email`)
      .send({ otp: "123456" });
    expect(res.status).toBe(401);
  });

  it("rejects verifying twice", async () => {
    const user = await createVerifiedUser();
    const res = await request(app)
      .post(`${api}/auth/verify-email`)
      .set(authHeader(user.token))
      .send({ otp: "123456" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Email already verified");
  });
});

describe("POST /auth/resend-otp", () => {
  it("issues a fresh OTP", async () => {
    const { id, token } = await registerUser();
    const res = await request(app)
      .post(`${api}/auth/resend-otp`)
      .set(authHeader(token));
    expect(res.status).toBe(200);
    expect(await getOtp(id)).toMatch(/^\d{6}$/);
  });
});

describe("POST /auth/login", () => {
  it("blocks users who have not verified their email", async () => {
    const { body } = await registerUser();
    const res = await login(body.email, body.password);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe(
      "Please verify your email address before logging in",
    );
  });

  it("logs in a verified user", async () => {
    const user = await createVerifiedUser();
    const res = await login(user.email, user.password);
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.lastLogin).toBeDefined();
    expect(res.body.data.user.password).toBeUndefined();
  });

  it("rejects a wrong password", async () => {
    const user = await createVerifiedUser();
    const res = await login(user.email, "WrongPassword1!");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid email or password");
  });

  it("rejects an unknown email", async () => {
    const res = await login("nobody@test.com", "Password123!");
    expect(res.status).toBe(401);
  });

  it("blocks a frozen account", async () => {
    const user = await createVerifiedUser();
    await User.updateOne({ _id: user.id }, { status: "frozen" });
    const res = await login(user.email, user.password);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/frozen/i);
  });
});

describe("POST /auth/logout", () => {
  it("logs out", async () => {
    const res = await request(app).post(`${api}/auth/logout`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Logged out successfully");
  });
});

describe("POST /auth/refresh-token", () => {
  it("returns 401 without a refresh cookie", async () => {
    const res = await request(app).post(`${api}/auth/refresh-token`);
    expect(res.status).toBe(401);
  });

  it("returns a new access token with a valid cookie", async () => {
    const user = await createVerifiedUser();
    const loginRes = await login(user.email, user.password);
    const res = await request(app)
      .post(`${api}/auth/refresh-token`)
      .set("Cookie", loginRes.headers["set-cookie"]);
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });
});
