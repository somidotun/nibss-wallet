import request from "supertest";
import app from "../app.js";
import Transaction from "../models/transaction.model.js";
import Wallet from "../models/wallet.model.js";
import {
  api,
  authHeader,
  balanceOf,
  createVerifiedUser,
  setPin,
  transfer,
  TestUser,
} from "./helpers.js";

let sender: TestUser;
let receiver: TestUser;

beforeEach(async () => {
  sender = await createVerifiedUser();
  receiver = await createVerifiedUser();
  await setPin(sender.token);
});

describe("POST /wallet/transfer", () => {
  it("moves money atomically and records both sides", async () => {
    const res = await transfer(sender, receiver, 5000);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Transfer successful");
    expect(res.body.data.transaction.balanceBefore).toBe(50000);
    expect(res.body.data.transaction.balanceAfter).toBe(45000);
    expect(res.body.data.transaction.status).toBe("success");
    expect(res.body.data.transaction.reference).toMatch(/^TXN-/);

    expect(await balanceOf(sender)).toBe(45000);
    expect(await balanceOf(receiver)).toBe(55000);
    expect(await Transaction.countDocuments()).toBe(2); // debit + credit
  });

  it("rejects a wrong PIN and leaves balances untouched", async () => {
    const res = await transfer(sender, receiver, 5000, { pin: "9999" });
    expect(res.status).toBe(401);
    expect(await balanceOf(sender)).toBe(50000);
    expect(await balanceOf(receiver)).toBe(50000);
  });

  it("rejects a sender who has not set a PIN", async () => {
    const res = await transfer(receiver, sender, 5000);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Please set a transaction PIN first");
  });

  it("rejects insufficient balance", async () => {
    const res = await transfer(sender, receiver, 60000);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Insufficient balance");
  });

  it("rejects a transfer to yourself", async () => {
    const res = await transfer(sender, sender, 5000);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Cannot transfer to yourself");
  });

  it("rejects an unknown account number", async () => {
    const res = await transfer(sender, receiver, 5000, {
      accountNumber: "9000000000",
    });
    expect(res.status).toBe(404);
  });

  it("does not charge twice for the same idempotency key", async () => {
    const first = await transfer(sender, receiver, 5000, {
      idempotencyKey: "idem-1",
    });
    const second = await transfer(sender, receiver, 5000, {
      idempotencyKey: "idem-1",
    });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.message).toMatch(/duplicate/i);
    expect(await balanceOf(sender)).toBe(45000);
    expect(await Transaction.countDocuments()).toBe(2);
  });

  it("enforces the daily transfer limit", async () => {
    await Wallet.updateOne(
      { accountNumber: sender.accountNumber },
      { dailyTransferUsed: 49950 },
    );
    const res = await transfer(sender, receiver, 100);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Daily transfer limit");
  });

  it("blocks a frozen sender wallet", async () => {
    await Wallet.updateOne(
      { accountNumber: sender.accountNumber },
      { status: "frozen" },
    );
    const res = await transfer(sender, receiver, 5000);
    expect(res.status).toBe(403);
  });

  it.each([
    ["amount below 100", { amount: 50 }],
    ["missing idempotency key", { idempotencyKey: "" }],
    ["non-numeric account number", { accountNumber: "abc" }],
    ["3-digit PIN", { pin: "123" }],
  ])("validates input: %s", async (_label, bad) => {
    const res = await transfer(sender, receiver, 5000, bad);
    expect(res.status).toBe(400);
  });

  it("requires authentication", async () => {
    const res = await request(app).post(`${api}/wallet/transfer`).send({});
    expect(res.status).toBe(401);
  });

  it("resets the daily limit on a new day", async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await Wallet.updateOne(
      { accountNumber: sender.accountNumber },
      { dailyTransferUsed: 49950, lastTransferReset: yesterday },
    );
    const res = await transfer(sender, receiver, 5000);
    expect(res.status).toBe(200);
    const wallet = await Wallet.findOne({
      accountNumber: sender.accountNumber,
    });
    expect(wallet!.dailyTransferUsed).toBe(5000);
  });
});

describe("GET /wallet/transactions/:id/receipt", () => {
  it("lets the sender download a PDF but not the receiver", async () => {
    const t = await transfer(sender, receiver, 5000);
    const id = t.body.data.transaction.id;

    const ok = await request(app)
      .get(`${api}/wallet/transactions/${id}/receipt`)
      .set(authHeader(sender.token));
    expect(ok.status).toBe(200);
    expect(ok.headers["content-type"]).toContain("application/pdf");

    const denied = await request(app)
      .get(`${api}/wallet/transactions/${id}/receipt`)
      .set(authHeader(receiver.token));
    expect(denied.status).toBe(403);
  });
});
