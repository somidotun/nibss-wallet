import request from "supertest";
import app from "../app.js";
import { api, authHeader, createVerifiedUser } from "./helpers.js";

describe("wallet endpoints", () => {
  it("requires authentication", async () => {
    const res = await request(app).get(`${api}/wallet`);
    expect(res.status).toBe(401);
  });

  it("returns a wallet with a 10-digit account number and 50000", async () => {
    const user = await createVerifiedUser();
    const res = await request(app)
      .get(`${api}/wallet`)
      .set(authHeader(user.token));
    expect(res.status).toBe(200);
    expect(res.body.data.wallet.accountNumber).toMatch(/^90\d{8}$/);
    expect(res.body.data.wallet.balance).toBe(50000);
    expect(res.body.data.wallet.status).toBe("active");
  });

  it("gives each user a different account number", async () => {
    const a = await createVerifiedUser();
    const b = await createVerifiedUser();
    expect(a.accountNumber).not.toBe(b.accountNumber);
  });

  it("looks up an account name by account number", async () => {
    const a = await createVerifiedUser();
    const b = await createVerifiedUser();
    const res = await request(app)
      .get(`${api}/wallet/lookup/${b.accountNumber}`)
      .set(authHeader(a.token));
    expect(res.status).toBe(200);
    expect(res.body.data.accountName).toBe("Test User");
    expect(res.body.data.bankName).toBe("Nibss Wallet");
  });

  it("returns 404 for an unknown account number", async () => {
    const user = await createVerifiedUser();
    const res = await request(app)
      .get(`${api}/wallet/lookup/9000000000`)
      .set(authHeader(user.token));
    expect(res.status).toBe(404);
  });
});
