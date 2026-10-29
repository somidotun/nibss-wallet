import mongoose from "mongoose";
import { jest } from "@jest/globals";
import AppError from "../utils/AppError.js";
import { generateAccountNumber } from "../utils/accountNumber.utils.js";
import { generateTransactionReceipt } from "../utils/receipt.utils.js";
import { ITransaction } from "../types/transaction.types.js";
import Wallet from "../models/wallet.model.js";

describe("AppError", () => {
  it("keeps the message and status code (regression for the empty-message bug)", () => {
    const err = new AppError("Route not found", 404);
    expect(err.message).toBe("Route not found");
    expect(err.statusCode).toBe(404);
    expect(err.isOperational).toBe(true);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it('uses status "fail" for 4xx and "error" for 5xx', () => {
    expect(new AppError("x", 400).status).toBe("fail");
    expect(new AppError("x", 500).status).toBe("error");
  });
});

describe("generateAccountNumber", () => {
  afterEach(() => jest.restoreAllMocks());

  it("returns 10 digits starting with 90", async () => {
    expect(await generateAccountNumber()).toMatch(/^90\d{8}$/);
  });

  it("skips a number that is already taken", async () => {
    await Wallet.create({
      userId: new mongoose.Types.ObjectId(),
      accountNumber: "9050000000",
    });
    jest
      .spyOn(Math, "random")
      .mockReturnValueOnce(0.5) // -> 9050000000 (taken)
      .mockReturnValueOnce(0.25); // -> 9025000000 (free)
    expect(await generateAccountNumber()).toBe("9025000000");
  });
});

describe("generateTransactionReceipt", () => {
  it("returns a valid PDF buffer", async () => {
    const tx = {
      reference: "TXN-TEST-123",
      status: "success",
      type: "transfer",
      amount: 5000,
      description: "Test transfer",
      balanceBefore: 50000,
      balanceAfter: 45000,
      createdAt: new Date(),
    } as unknown as ITransaction;

    const pdf = await generateTransactionReceipt(tx, "Ayo John", "Alice Smith");
    expect(pdf.length).toBeGreaterThan(500);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
});
