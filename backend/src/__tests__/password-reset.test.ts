import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.js";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import { hashOtp } from "../utils/otp.utils.js";
import {
  api,
  authHeader,
  createVerifiedUser,
  registerUser,
  TestUser,
} from "./helpers.js";

const forgot = (email: string) =>
  request(app).post(`${api}/auth/forgot-password`).send({ email });

const reset = (email: string, otp: string, newPassword = "BrandNew456!") =>
  request(app)
    .post(`${api}/auth/reset-password`)
    .send({ email, otp, newPassword });

const resetFields = (id: string) =>
  User.findById(id).select(
    "+passwordResetToken +passwordResetExpiry +passwordResetAttempts",
  );

// Codes are stored hashed, so tests plant a known one
const plantOtp = (
  id: string,
  otp = "123456",
  expiry = new Date(Date.now() + 10 * 60 * 1000),
) =>
  User.updateOne(
    { _id: id },
    {
      passwordResetToken: hashOtp(otp),
      passwordResetExpiry: expiry,
      passwordResetAttempts: 0,
    },
  );

let user: TestUser;
beforeEach(async () => {
  user = await createVerifiedUser();
});

describe("POST /auth/forgot-password", () => {
  it("gives the same answer for a real and an unknown email", async () => {
    const real = await forgot(user.email);
    const fake = await forgot("nobody@test.com");
    expect(real.status).toBe(200);
    expect(fake.status).toBe(200);
    expect(real.body).toEqual(fake.body);
  });

  it("stores a hashed code with an expiry, never the plain code", async () => {
    await forgot(user.email);
    const stored = await resetFields(user.id);
    expect(stored!.passwordResetToken).toMatch(/^[0-9a-f]{64}$/);
    expect(stored!.passwordResetExpiry!.getTime()).toBeGreaterThan(Date.now());
  });

  it("issues no code to an unverified account", async () => {
    const { body, id } = await registerUser();
    await forgot(body.email);
    const stored = await resetFields(id);
    expect(stored!.passwordResetToken).toBeUndefined();
  });

  it("issues no code to a frozen account", async () => {
    await User.updateOne({ _id: user.id }, { status: "frozen" });
    await forgot(user.email);
    const stored = await resetFields(user.id);
    expect(stored!.passwordResetToken).toBeUndefined();
  });

  it("ignores a second request inside the one-minute cooldown", async () => {
    await forgot(user.email);
    const first = (await resetFields(user.id))!.passwordResetToken;
    await forgot(user.email);
    const second = (await resetFields(user.id))!.passwordResetToken;
    expect(second).toBe(first);
  });

  it("rejects an invalid email", async () => {
    const res = await forgot("not-an-email");
    expect(res.status).toBe(400);
  });
});

describe("POST /auth/reset-password", () => {
  it("resets the password: new one works, old one does not", async () => {
    await plantOtp(user.id);
    const res = await reset(user.email, "123456");
    expect(res.status).toBe(200);

    const oldLogin = await request(app)
      .post(`${api}/auth/login`)
      .send({ email: user.email, password: user.password });
    const newLogin = await request(app)
      .post(`${api}/auth/login`)
      .send({ email: user.email, password: "BrandNew456!" });
    expect(oldLogin.status).toBe(401);
    expect(newLogin.status).toBe(200);
  });

  it("clears the code so it cannot be used twice", async () => {
    await plantOtp(user.id);
    await reset(user.email, "123456");
    const again = await reset(user.email, "123456", "AnotherOne789!");
    expect(again.status).toBe(400);
    expect((await resetFields(user.id))!.passwordResetToken).toBeUndefined();
  });

  it("sends a password_changed notification", async () => {
    await plantOtp(user.id);
    await reset(user.email, "123456");
    expect(
      await Notification.countDocuments({
        userId: user.id,
        type: "password_changed",
      }),
    ).toBe(1);
  });

  it("gives one generic error for wrong code, unknown email and no code", async () => {
    await plantOtp(user.id);
    const wrong = await reset(user.email, "000000");
    const unknown = await reset("nobody@test.com", "123456");
    const none = await reset((await createVerifiedUser()).email, "123456");
    for (const r of [wrong, unknown, none]) {
      expect(r.status).toBe(400);
      expect(r.body.message).toBe("Invalid or expired code");
    }
  });

  it("rejects an expired code", async () => {
    await plantOtp(user.id, "123456", new Date(Date.now() - 1000));
    const res = await reset(user.email, "123456");
    expect(res.status).toBe(400);
  });

  it("locks the code after 5 wrong attempts, even for the right code", async () => {
    await plantOtp(user.id);
    for (let i = 0; i < 5; i++) await reset(user.email, "000000");
    const res = await reset(user.email, "123456");
    expect(res.status).toBe(400);
    expect((await resetFields(user.id))!.passwordResetToken).toBeUndefined();
  });

  it("rejects reusing the current password", async () => {
    await plantOtp(user.id);
    const res = await reset(user.email, "123456", user.password);
    expect(res.status).toBe(400);
  });

  it.each([
    ["weak password", { newPassword: "weak" }],
    ["non-numeric code", { otp: "abcdef" }],
    ["short code", { otp: "123" }],
  ])("validates input: %s", async (_label, bad) => {
    const res = await request(app)
      .post(`${api}/auth/reset-password`)
      .send({
        email: user.email,
        otp: "123456",
        newPassword: "BrandNew456!",
        ...bad,
      });
    expect(res.status).toBe(400);
  });
});

describe("session invalidation after a password change", () => {
  const oldAccessToken = () =>
    jwt.sign(
      {
        userId: user.id,
        role: "user",
        iat: Math.floor(Date.now() / 1000) - 60,
      },
      process.env.JWT_ACCESS_SECRET!,
    );

  it("rejects an access token issued before a reset", async () => {
    const before = oldAccessToken();
    await plantOtp(user.id);
    await reset(user.email, "123456");

    const res = await request(app)
      .get(`${api}/users/me`)
      .set(authHeader(before));
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Password was changed. Please log in again.");
  });

  it("accepts a token from a login after the reset", async () => {
    await plantOtp(user.id);
    await reset(user.email, "123456");
    const login = await request(app)
      .post(`${api}/auth/login`)
      .send({ email: user.email, password: "BrandNew456!" });

    const res = await request(app)
      .get(`${api}/users/me`)
      .set(authHeader(login.body.data.accessToken));
    expect(res.status).toBe(200);
  });

  it("rejects a refresh token issued before a reset", async () => {
    const oldRefresh = jwt.sign(
      {
        userId: user.id,
        role: "user",
        iat: Math.floor(Date.now() / 1000) - 60,
      },
      process.env.JWT_REFRESH_SECRET!,
    );
    await plantOtp(user.id);
    await reset(user.email, "123456");

    const res = await request(app)
      .post(`${api}/auth/refresh-token`)
      .set("Cookie", `refreshToken=${oldRefresh}`);
    expect(res.status).toBe(401);
  });

  it("also signs out old sessions after a normal password change", async () => {
    const before = oldAccessToken();
    const res = await request(app)
      .patch(`${api}/users/me/change-password`)
      .set(authHeader(user.token))
      .send({ currentPassword: user.password, newPassword: "ChangedPass789!" });
    expect(res.status).toBe(200);

    const after = await request(app)
      .get(`${api}/users/me`)
      .set(authHeader(before));
    expect(after.status).toBe(401);
  });
});
