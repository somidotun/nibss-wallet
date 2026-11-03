import request from "supertest";
import app from "../app.js";
import User from "../models/user.model.js";
import {
  api,
  authHeader,
  createVerifiedUser,
  registerUser,
  setPin,
  TestUser,
} from "./helpers.js";

const status = (token: string) =>
  request(app).get(`${api}/onboarding/status`).set(authHeader(token));

const updateProfile = (token: string) =>
  request(app)
    .patch(`${api}/users/me`)
    .set(authHeader(token))
    .send({ firstName: "Ayo" });

const submitKyc = (token: string) =>
  request(app)
    .post(`${api}/kyc/submit`)
    .set(authHeader(token))
    .send({ nin: "12345678901", bvn: "10987654321" });

const storedComplete = async (user: TestUser) =>
  (await User.findById(user.id))!.onboarding.isComplete;

describe("GET /onboarding/status", () => {
  it("requires authentication", async () => {
    const res = await request(app).get(`${api}/onboarding/status`);
    expect(res.status).toBe(401);
  });

  it("shows an unverified user their first step is email", async () => {
    const { token } = await registerUser();
    const res = await status(token);
    const o = res.body.data.onboarding;
    expect(o.nextStep).toBe("email");
    expect(o.completedCount).toBe(0);
    expect(o.isComplete).toBe(false);
  });

  it("starts a verified user at 25% with profile as the next step", async () => {
    const user = await createVerifiedUser();
    const o = (await status(user.token)).body.data.onboarding;
    expect(o.completedCount).toBe(1);
    expect(o.totalSteps).toBe(4);
    expect(o.percent).toBe(25);
    expect(o.nextStep).toBe("profile");
    expect(o.isComplete).toBe(false);
  });

  it("advances through profile, pin and kyc to 100%", async () => {
    const user = await createVerifiedUser();

    await updateProfile(user.token);
    expect((await status(user.token)).body.data.onboarding.nextStep).toBe(
      "pin",
    );

    await setPin(user.token);
    expect((await status(user.token)).body.data.onboarding.nextStep).toBe(
      "kyc",
    );

    await submitKyc(user.token);
    const o = (await status(user.token)).body.data.onboarding;
    expect(o.percent).toBe(100);
    expect(o.nextStep).toBeNull();
    expect(o.isComplete).toBe(true);
  });
});

describe("stored onboarding.isComplete (regression)", () => {
  it("becomes true when KYC is the last step, in any order", async () => {
    const user = await createVerifiedUser();
    await updateProfile(user.token);
    await setPin(user.token);
    expect(await storedComplete(user)).toBe(false);
    await submitKyc(user.token);
    expect(await storedComplete(user)).toBe(true);
  });

  it("becomes true when the PIN is the last step", async () => {
    const user = await createVerifiedUser();
    await updateProfile(user.token);
    await submitKyc(user.token);
    expect(await storedComplete(user)).toBe(false);
    await setPin(user.token);
    expect(await storedComplete(user)).toBe(true);
  });
});
