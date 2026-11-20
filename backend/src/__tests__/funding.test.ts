import crypto from "crypto";
import request from "supertest";
import { jest } from "@jest/globals";
import app from "../app.js";
import Wallet from "../models/wallet.model.js";
import Deposit from "../models/deposit.model.js";
import Transaction from "../models/transaction.model.js";
import Notification from "../models/notification.model.js";
import {
  api,
  authHeader,
  balanceOf,
  createVerifiedUser,
  registerUser,
  TestUser,
} from "./helpers.js";


const mockPaystack = (verify: (reference: string) => unknown) =>
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    let data: unknown;
    if (url.includes("/transaction/initialize")) {
      const body = JSON.parse(String(init?.body));
      data = {
        authorization_url: "https://checkout.paystack.com/test",
        access_code: "test-access",
        reference: body.reference,
      };
    } else {
      data = verify(decodeURIComponent(url.split("/verify/")[1]));
    }
    return new Response(JSON.stringify({ status: true, message: "ok", data }), {
      status: 200,
    });
  });

const paid = (amountNaira: number) => (reference: string) => ({
  status: "success",
  reference,
  amount: amountNaira * 100,
  currency: "NGN",
});

const sign = (body: string) =>
  crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!)
    .update(body)
    .digest("hex");

const webhook = (
  reference: string,
  signature?: string,
  event = "charge.success",
) => {
  const body = JSON.stringify({ event, data: { reference } });
  return request(app)
    .post(`${api}/paystack/webhook`)
    .set("Content-Type", "application/json")
    .set("x-paystack-signature", signature ?? sign(body))
    .send(body);
};

const fund = (user: TestUser, amount?: unknown) =>
  request(app)
    .post(`${api}/wallet/fund`)
    .set(authHeader(user.token))
    .send(amount === undefined ? {} : { amount });

const verifyPayment = (user: TestUser, reference: string) =>
  request(app)
    .get(`${api}/paystack/verify/${reference}`)
    .set(authHeader(user.token));

afterEach(() => jest.restoreAllMocks());

let user: TestUser;
beforeEach(async () => {
  user = await createVerifiedUser();
});

describe("POST /wallet/fund", () => {
  it("requires authentication", async () => {
    const res = await request(app)
      .post(`${api}/wallet/fund`)
      .send({ amount: 5000 });
    expect(res.status).toBe(401);
  });

  it("starts a pending payment without moving any money", async () => {
    const spy = mockPaystack(paid(5000));
    const res = await fund(user, 5000);
    expect(res.status).toBe(201);
    expect(res.body.data.reference).toMatch(/^FUND-/);
    expect(res.body.data.authorizationUrl).toBe(
      "https://checkout.paystack.com/test",
    );

    const sent = JSON.parse(String(spy.mock.calls[0][1]?.body));
    expect(sent.amount).toBe(500000); // kobo
    expect(sent.email).toBe(user.email);
    expect(sent.currency).toBe("NGN");

    expect(await balanceOf(user)).toBe(50000);
    expect(
      (await Deposit.findOne({ reference: res.body.data.reference }))!.status,
    ).toBe("pending");
  });

  it.each([50, 60000, 100.5, "abc", undefined])(
    "rejects amount %s",
    async (amount) => {
      mockPaystack(paid(100));
      const res = await fund(user, amount);
      expect(res.status).toBe(400);
    },
  );

  it("refuses funding that would pass the wallet limit", async () => {
    mockPaystack(paid(30000));
    await Wallet.updateOne({ userId: user.id }, { balance: 480000 });
    const res = await fund(user, 30000);
    expect(res.status).toBe(400);
  });

  it("returns 502 and marks the payment failed when Paystack is down", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => Promise.reject(new Error("network down")));
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await fund(user, 5000);
    expect(res.status).toBe(502);
    expect((await Deposit.findOne({ userId: user.id }))!.status).toBe("failed");
  });

  it("needs a wallet and an active wallet", async () => {
    mockPaystack(paid(5000));
    const { token } = await registerUser(); // unverified: no wallet yet
    const noWallet = await request(app)
      .post(`${api}/wallet/fund`)
      .set(authHeader(token))
      .send({ amount: 5000 });
    expect(noWallet.status).toBe(404);

    await Wallet.updateOne({ userId: user.id }, { status: "frozen" });
    expect((await fund(user, 5000)).status).toBe(403);
  });
});

describe("POST /paystack/webhook", () => {
  const startFunding = async (amount = 5000) => {
    mockPaystack(paid(amount));
    return (await fund(user, amount)).body.data.reference as string;
  };

  it("rejects a missing signature, a wrong signature and a tampered body", async () => {
    const reference = await startFunding();
    const body = JSON.stringify({
      event: "charge.success",
      data: { reference },
    });

    const missing = await request(app)
      .post(`${api}/paystack/webhook`)
      .set("Content-Type", "application/json")
      .send(body);
    const wrong = await webhook(reference, "a".repeat(128));
    const tampered = await request(app)
      .post(`${api}/paystack/webhook`)
      .set("Content-Type", "application/json")
      .set("x-paystack-signature", sign(body))
      .send(body.replace("charge.success", "charge.success "));

    for (const res of [missing, wrong, tampered]) expect(res.status).toBe(401);
    expect(await balanceOf(user)).toBe(50000);
  });

  it("rejects a non-JSON content type", async () => {
    const res = await request(app)
      .post(`${api}/paystack/webhook`)
      .set("Content-Type", "text/plain")
      .send("hello");
    expect(res.status).toBe(401);
  });

  it("credits the wallet and records history and a notification", async () => {
    const reference = await startFunding(5000);
    const res = await webhook(reference);
    expect(res.status).toBe(200);

    expect(await balanceOf(user)).toBe(55000);
    const tx = await Transaction.findOne({ reference });
    expect(tx!.type).toBe("funding");
    expect(tx!.direction).toBe("credit");
    expect(tx!.balanceBefore).toBe(50000);
    expect(tx!.balanceAfter).toBe(55000);
    expect(
      await Notification.countDocuments({
        userId: user.id,
        type: "wallet_funded",
      }),
    ).toBe(1);
  });

  it("credits only once when the same event arrives twice", async () => {
    const reference = await startFunding(5000);
    await webhook(reference);
    await webhook(reference);
    expect(await balanceOf(user)).toBe(55000);
    expect(await Transaction.countDocuments({ type: "funding" })).toBe(1);
  });

  it("credits only once when deliveries arrive at the same time", async () => {
    const reference = await startFunding(5000);
    await Promise.all(Array.from({ length: 5 }, () => webhook(reference)));
    expect(await balanceOf(user)).toBe(55000);
    expect(await Transaction.countDocuments({ type: "funding" })).toBe(1);
  });

  it("acknowledges other events and unknown references without crediting", async () => {
    const reference = await startFunding();
    expect(
      (await webhook(reference, undefined, "transfer.success")).status,
    ).toBe(200);
    expect((await webhook("FUND-UNKNOWN")).status).toBe(200);
    expect(await balanceOf(user)).toBe(50000);
  });

  it("trusts Paystack’s verify answer, not the webhook body", async () => {
    const reference = await startFunding();
    mockPaystack((ref) => ({
      status: "abandoned",
      reference: ref,
      amount: 500000,
      currency: "NGN",
    }));
    await webhook(reference);
    expect(await balanceOf(user)).toBe(50000);
  });

  it("does not credit when the paid amount differs, and marks the deposit failed", async () => {
    const reference = await startFunding(5000);
    mockPaystack(paid(100));
    await webhook(reference);
    expect(await balanceOf(user)).toBe(50000);
    expect((await Deposit.findOne({ reference }))!.status).toBe("failed");
  });

  it("returns 500 when Paystack cannot be reached, then succeeds on the retry", async () => {
    const reference = await startFunding(5000);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(() => Promise.reject(new Error("timeout")));
    expect((await webhook(reference)).status).toBe(500);
    expect(await balanceOf(user)).toBe(50000);

    mockPaystack(paid(5000));
    expect((await webhook(reference)).status).toBe(200);
    expect(await balanceOf(user)).toBe(55000);
  });
});

describe("GET /paystack/verify/:reference", () => {
  it("credits through verify when the webhook never arrived, and only once", async () => {
    mockPaystack(paid(5000));
    const reference = (await fund(user, 5000)).body.data.reference;

    const first = await verifyPayment(user, reference);
    expect(first.status).toBe(200);
    expect(first.body.data).toEqual({
      reference,
      status: "success",
      amount: 5000,
    });

    await verifyPayment(user, reference);
    await webhook(reference);
    expect(await balanceOf(user)).toBe(55000);
  });

  it("stays pending while Paystack says the payment is unfinished", async () => {
    mockPaystack((ref) => ({
      status: "abandoned",
      reference: ref,
      amount: 500000,
      currency: "NGN",
    }));
    const reference = (await fund(user, 5000)).body.data.reference;
    const res = await verifyPayment(user, reference);
    expect(res.body.data.status).toBe("pending");
    expect(await balanceOf(user)).toBe(50000);
  });

  it("does not reveal or settle someone else's payment", async () => {
    mockPaystack(paid(5000));
    const reference = (await fund(user, 5000)).body.data.reference;
    const other = await createVerifiedUser();
    expect((await verifyPayment(other, reference)).status).toBe(404);
    expect(await balanceOf(user)).toBe(50000);
  });

  it("returns 404 for an unknown reference and 400 for a malformed one", async () => {
    const unknown = `FUND-${"A".repeat(8)}-AAAA-AAAA-AAAA-${"A".repeat(12)}`;
    expect((await verifyPayment(user, unknown)).status).toBe(404);
    expect((await verifyPayment(user, "not-a-reference")).status).toBe(400);
  });

  it("shows funding in the history as a credit", async () => {
    mockPaystack(paid(5000));
    const reference = (await fund(user, 5000)).body.data.reference;
    await verifyPayment(user, reference);

    const res = await request(app)
      .get(`${api}/transactions`)
      .set(authHeader(user.token));
    const funding = res.body.data.transactions.find(
      (t: { type: string }) => t.type === "funding",
    );
    expect(funding.direction).toBe("credit");
    expect(funding.amount).toBe(5000);
  });
});
