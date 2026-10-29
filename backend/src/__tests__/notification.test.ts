import request from "supertest";
import app from "../app.js";
import Notification from "../models/notification.model.js";
import { reviewKyc } from "../services/kyc.service.js";
import {
  api,
  authHeader,
  createVerifiedUser,
  setPin,
  transfer,
  TestUser,
} from "./helpers.js";
import { jest } from "@jest/globals";
import Wallet from "../models/wallet.model.js";

const list = (user: TestUser, query = "") =>
  request(app).get(`${api}/notifications${query}`).set(authHeader(user.token));

describe("notification triggers", () => {
  it("sends a welcome notification after email verification", async () => {
    const user = await createVerifiedUser();
    const res = await list(user);
    expect(res.body.data.notifications[0].type).toBe("welcome");
  });

  it("notifies both sides of a transfer", async () => {
    const sender = await createVerifiedUser();
    const receiver = await createVerifiedUser();
    await setPin(sender.token);
    await transfer(sender, receiver, 5000);

    const s = await list(sender);
    const r = await list(receiver);
    expect(
      s.body.data.notifications.map((n: { type: string }) => n.type),
    ).toContain("transfer_sent");
    expect(
      r.body.data.notifications.map((n: { type: string }) => n.type),
    ).toContain("transfer_received");
  });

  it("notifies on KYC approval without leaking identity numbers", async () => {
    const user = await createVerifiedUser();
    await request(app)
      .post(`${api}/kyc/submit`)
      .set(authHeader(user.token))
      .send({ nin: "12345678901", bvn: "10987654321" });
    await reviewKyc(user.id, "approve");

    const res = await list(user);
    const types = res.body.data.notifications.map(
      (n: { type: string }) => n.type,
    );
    expect(types).toEqual(
      expect.arrayContaining(["kyc_submitted", "kyc_approved"]),
    );
    expect(JSON.stringify(res.body)).not.toContain("12345678901");
  });
});

describe("failed transfer notifications", () => {
  let sender: TestUser;
  let receiver: TestUser;

  beforeEach(async () => {
    sender = await createVerifiedUser();
    receiver = await createVerifiedUser();
    await setPin(sender.token);
  });

  afterEach(() => jest.restoreAllMocks());

  const senderTypes = async () =>
    (await list(sender)).body.data.notifications.map(
      (n: { type: string }) => n.type,
    );

  it("tells the sender when the balance is insufficient", async () => {
    await transfer(sender, receiver, 60000);

    const res = await list(sender);
    const failed = res.body.data.notifications.find(
      (n: { type: string }) => n.type === "transfer_failed",
    );
    expect(failed.message).toContain("Insufficient balance");
    expect(failed.message).toContain("No money was deducted");
    expect(await senderTypes()).not.toContain("transfer_sent");
  });

  it("tells the sender when the daily limit is exceeded", async () => {
    await Wallet.updateOne(
      { accountNumber: sender.accountNumber },
      { dailyTransferUsed: 49950 },
    );
    await transfer(sender, receiver, 100);
    const res = await list(sender);
    const failed = res.body.data.notifications.find(
      (n: { type: string }) => n.type === "transfer_failed",
    );
    expect(failed.message).toContain("Daily transfer limit");
  });

  it("raises a security alert on a wrong PIN without exposing the PIN", async () => {
    await transfer(sender, receiver, 5000, { pin: "9999" });

    const res = await list(sender);
    const alert = res.body.data.notifications.find(
      (n: { type: string }) => n.type === "security_alert",
    );
    expect(alert.title).toBe("Incorrect transaction PIN");
    expect(JSON.stringify(alert)).not.toContain("9999");
  });

  it("never notifies the receiver about a failed attempt", async () => {
    await transfer(sender, receiver, 60000);
    const res = await list(receiver);
    const types = res.body.data.notifications.map(
      (n: { type: string }) => n.type,
    );
    expect(types).toEqual(["welcome"]);
  });

  it("creates no notification for input validation errors", async () => {
    await transfer(sender, receiver, 50); // below the 100 minimum
    expect(await senderTypes()).not.toContain("transfer_failed");
  });

  it("hides internal error details behind a generic reason", async () => {
    jest.spyOn(Wallet, "findOne").mockImplementationOnce(() => {
      throw new Error("db down: secret internal detail");
    });
    const res = await transfer(sender, receiver, 5000);
    expect(res.status).toBe(500);

    const list2 = await list(sender);
    const failed = list2.body.data.notifications.find(
      (n: { type: string }) => n.type === "transfer_failed",
    );
    expect(failed.message).toContain("A system error occurred");
    expect(JSON.stringify(list2.body)).not.toContain("secret internal detail");
  });
});

describe("GET /notifications", () => {
  it("requires authentication", async () => {
    const res = await request(app).get(`${api}/notifications`);
    expect(res.status).toBe(401);
  });

  it("never shows another user's notifications", async () => {
    const a = await createVerifiedUser();
    const b = await createVerifiedUser();
    await setPin(a.token);
    await transfer(a, b, 5000);

    const res = await list(a);
    const received = res.body.data.notifications.filter(
      (n: { type: string }) => n.type === "transfer_received",
    );
    expect(received).toHaveLength(0);
  });

  it("reports the unread count and filters unread only", async () => {
    const user = await createVerifiedUser();
    const before = await list(user);
    expect(before.body.data.unreadCount).toBe(1);

    await request(app)
      .patch(`${api}/notifications/read-all`)
      .set(authHeader(user.token));

    const unread = await list(user, "?unreadOnly=true");
    expect(unread.body.data.notifications).toHaveLength(0);
    expect(unread.body.data.unreadCount).toBe(0);
  });

  it("paginates", async () => {
    const user = await createVerifiedUser();
    for (let i = 0; i < 3; i++) {
      await Notification.create({
        userId: user.id,
        type: "welcome",
        title: `t${i}`,
        message: "m",
      });
    }
    const res = await list(user, "?limit=2");
    expect(res.body.data.notifications).toHaveLength(2);
    expect(res.body.data.pagination.total).toBe(4); // 3 + the welcome
    expect(res.body.data.pagination.hasNextPage).toBe(true);
  });
});

describe("PATCH /notifications/:id/read", () => {
  it("marks one notification read", async () => {
    const user = await createVerifiedUser();
    const id = (await list(user)).body.data.notifications[0]._id;

    const res = await request(app)
      .patch(`${api}/notifications/${id}/read`)
      .set(authHeader(user.token));
    expect(res.status).toBe(200);
    expect(res.body.data.notification.isRead).toBe(true);
    expect(res.body.data.notification.readAt).toBeDefined();
  });

  it("returns 404 for someone else's notification", async () => {
    const a = await createVerifiedUser();
    const b = await createVerifiedUser();
    const id = (await list(a)).body.data.notifications[0]._id;

    const res = await request(app)
      .patch(`${api}/notifications/${id}/read`)
      .set(authHeader(b.token));
    expect(res.status).toBe(404);
  });

  it("returns 400 for a malformed id", async () => {
    const user = await createVerifiedUser();
    const res = await request(app)
      .patch(`${api}/notifications/not-an-id/read`)
      .set(authHeader(user.token));
    expect(res.status).toBe(400);
  });
});

describe("DELETE /notifications/:id", () => {
  it("deletes your own notification", async () => {
    const user = await createVerifiedUser();
    const id = (await list(user)).body.data.notifications[0]._id;

    const res = await request(app)
      .delete(`${api}/notifications/${id}`)
      .set(authHeader(user.token));
    expect(res.status).toBe(200);
    expect((await list(user)).body.data.pagination.total).toBe(0);
  });

  it("cannot delete someone else's notification", async () => {
    const a = await createVerifiedUser();
    const b = await createVerifiedUser();
    const id = (await list(a)).body.data.notifications[0]._id;

    const res = await request(app)
      .delete(`${api}/notifications/${id}`)
      .set(authHeader(b.token));
    expect(res.status).toBe(404);
    expect((await list(a)).body.data.pagination.total).toBe(1);
  });
});
