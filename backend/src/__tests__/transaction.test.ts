import request from "supertest";
import app from "../app.js";
import {
  api,
  authHeader,
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

const history = (user: TestUser, query = "") =>
  request(app).get(`${api}/transactions${query}`).set(authHeader(user.token));

describe("GET /transactions", () => {
  it("requires authentication", async () => {
    const res = await request(app).get(`${api}/transactions`);
    expect(res.status).toBe(401);
  });

  it("returns an empty history for a new user", async () => {
    const res = await history(sender);
    expect(res.status).toBe(200);
    expect(res.body.data.pagination.total).toBe(0);
  });

  it("shows one debit to the sender and one credit to the receiver", async () => {
    await transfer(sender, receiver, 5000);

    const s = await history(sender);
    expect(s.body.data.pagination.total).toBe(1);
    expect(s.body.data.transactions[0].direction).toBe("debit");
    expect(s.body.data.transactions[0].amount).toBe(5000);

    const r = await history(receiver);
    expect(r.body.data.pagination.total).toBe(1);
    expect(r.body.data.transactions[0].direction).toBe("credit");
  });

  it("filters by direction", async () => {
    await transfer(sender, receiver, 5000);
    const res = await history(sender, "?direction=credit");
    expect(res.body.data.pagination.total).toBe(0);
  });

  it("paginates", async () => {
    await transfer(sender, receiver, 100);
    await transfer(sender, receiver, 100);
    await transfer(sender, receiver, 100);

    const res = await history(sender, "?limit=2");
    expect(res.body.data.transactions).toHaveLength(2);
    expect(res.body.data.pagination.total).toBe(3);
    expect(res.body.data.pagination.totalPages).toBe(2);
    expect(res.body.data.pagination.hasNextPage).toBe(true);
  });
});

describe("GET /transactions/:id", () => {
  it("returns the transaction to its sender", async () => {
    const t = await transfer(sender, receiver, 5000);
    const id = t.body.data.transaction.id;
    const res = await request(app)
      .get(`${api}/transactions/${id}`)
      .set(authHeader(sender.token));
    expect(res.status).toBe(200);
    expect(res.body.data.transaction.amount).toBe(5000);
  });

  it("forbids a user who is not part of the transaction", async () => {
    const outsider = await createVerifiedUser();
    const t = await transfer(sender, receiver, 5000);
    const res = await request(app)
      .get(`${api}/transactions/${t.body.data.transaction.id}`)
      .set(authHeader(outsider.token));
    expect(res.status).toBe(403);
  });

  it("returns 400 for a malformed id", async () => {
    const res = await request(app)
      .get(`${api}/transactions/not-an-id`)
      .set(authHeader(sender.token));
    expect(res.status).toBe(400);
  });
});
