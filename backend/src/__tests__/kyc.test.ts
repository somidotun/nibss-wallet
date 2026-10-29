import request from "supertest";
import app from "../app.js";
import User from "../models/user.model.js";
import Wallet from "../models/wallet.model.js";
import { reviewKyc } from "../services/kyc.service.js";
import { api, authHeader, createVerifiedUser } from "./helpers.js";

const NIN = "12345678901";
const BVN = "10987654321";

const submit = (token: string, body: Record<string, string>) =>
  request(app).post(`${api}/kyc/submit`).set(authHeader(token)).send(body);

describe("KYC endpoints", () => {
  it("requires authentication", async () => {
    const res = await request(app).get(`${api}/kyc/status`);
    expect(res.status).toBe(401);
  });

  it("starts as tier 1, not_started", async () => {
    const user = await createVerifiedUser();
    const res = await request(app)
      .get(`${api}/kyc/status`)
      .set(authHeader(user.token));
    expect(res.body.data.kyc.currentTier).toBe(1);
    expect(res.body.data.kyc.status).toBe("not_started");
    expect(res.body.data.kyc.nin).toBeNull();
  });

  it("submits for review and only ever returns masked values", async () => {
    const user = await createVerifiedUser();
    const res = await submit(user.token, { nin: NIN, bvn: BVN });
    expect(res.status).toBe(200);
    expect(res.body.data.kyc.status).toBe("pending");
    expect(res.body.data.kyc.requestedTier).toBe(2);
    expect(res.body.data.kyc.currentTier).toBe(1);

    const status = await request(app)
      .get(`${api}/kyc/status`)
      .set(authHeader(user.token));
    expect(status.body.data.kyc.nin).toBe("******8901");
    expect(status.body.data.kyc.bvn).toBe("******4321");
    expect(JSON.stringify(status.body)).not.toContain(NIN);
  });

  it("stores NIN and BVN encrypted, never as plaintext", async () => {
    const user = await createVerifiedUser();
    await submit(user.token, { nin: NIN, bvn: BVN });
    const stored = await User.findById(user.id).select("+kyc.nin +kyc.bvn");
    expect(stored!.kyc.nin).not.toBe(NIN);
    expect(stored!.kyc.nin).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
    expect(stored!.kyc.bvn).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
  });

  it("rejects a second submission while one is pending", async () => {
    const user = await createVerifiedUser();
    await submit(user.token, { nin: NIN, bvn: BVN });
    const res = await submit(user.token, { nin: NIN, bvn: BVN });
    expect(res.status).toBe(400);
  });

  it.each([
    ["10-digit NIN", { nin: "1234567890", bvn: BVN }],
    ["non-numeric BVN", { nin: NIN, bvn: "abcdefghijk" }],
    ["missing fields", {}],
  ])("rejects %s", async (_label, body) => {
    const user = await createVerifiedUser();
    const res = await submit(user.token, body as Record<string, string>);
    expect(res.status).toBe(400);
  });
});

describe("reviewKyc service", () => {
  it("approval upgrades the tier and raises the daily limit", async () => {
    const user = await createVerifiedUser();
    await submit(user.token, { nin: NIN, bvn: BVN });
    await reviewKyc(user.id, "approve");

    const updated = await User.findById(user.id);
    expect(updated!.kyc.currentTier).toBe(2);
    expect(updated!.kyc.status).toBe("verified");
    const wallet = await Wallet.findOne({ userId: user.id });
    expect(wallet!.dailyTransferLimit).toBe(200000);
  });

  it("rejection keeps tier 1 and records the reason", async () => {
    const user = await createVerifiedUser();
    await submit(user.token, { nin: NIN, bvn: BVN });
    await reviewKyc(user.id, "reject", "NIN could not be verified");

    const updated = await User.findById(user.id);
    expect(updated!.kyc.currentTier).toBe(1);
    expect(updated!.kyc.status).toBe("rejected");
    expect(updated!.kyc.rejectionReason).toBe("NIN could not be verified");
  });
});
