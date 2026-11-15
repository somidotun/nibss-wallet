import request from "supertest";
import app from "../app.js";
import User from "../models/user.model.js";
import Wallet from "../models/wallet.model.js";
import Notification from "../models/notification.model.js";
import AuditLog from "../models/auditLog.model.js";
import {
  api,
  authHeader,
  createAdmin,
  createVerifiedUser,
  setPin,
  transfer,
} from "./helpers.js";

const get = (token: string, path: string) =>
  request(app).get(`${api}${path}`).set(authHeader(token));

const patch = (
  token: string,
  path: string,
  body: Record<string, unknown> = {},
) => request(app).patch(`${api}${path}`).set(authHeader(token)).send(body);

const submitKyc = (token: string) =>
  request(app)
    .post(`${api}/kyc/submit`)
    .set(authHeader(token))
    .send({ nin: "12345678901", bvn: "10987654321" });

describe("access control", () => {
  it.each([
    "/admin/users",
    "/admin/stats",
    "/admin/transactions",
    "/admin/kyc/pending",
    "/admin/audit-logs",
  ])(
    "GET %s: 401 without a token, 403 for a user, 200 for an admin",
    async (path) => {
      const admin = await createAdmin();
      const user = await createVerifiedUser();
      expect((await request(app).get(`${api}${path}`)).status).toBe(401);
      expect((await get(user.token, path)).status).toBe(403);
      expect((await get(admin.token, path)).status).toBe(200);
    },
  );

  it("blocks a normal user from freezing and from reviewing KYC", async () => {
    const user = await createVerifiedUser();
    const other = await createVerifiedUser();
    expect(
      (
        await patch(user.token, `/admin/users/${other.id}/freeze`, {
          reason: "testing",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await patch(user.token, `/admin/kyc/${other.id}`, {
          decision: "approve",
        })
      ).status,
    ).toBe(403);
  });
});

describe("GET /admin/users", () => {
  it("lists users without any sensitive fields", async () => {
    const admin = await createAdmin();
    const user = await createVerifiedUser();
    await submitKyc(user.token);

    const res = await get(admin.token, "/admin/users");
    expect(res.status).toBe(200);
    expect(res.body.data.pagination.total).toBe(2);
    const listed = res.body.data.users[0];
    expect(listed.password).toBeUndefined();
    expect(listed.transactionPin).toBeUndefined();
    expect(listed.kyc.nin).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("12345678901");
  });

  it("searches by email and filters by status", async () => {
    const admin = await createAdmin();
    const user = await createVerifiedUser();
    await User.updateOne({ _id: user.id }, { status: "frozen" });

    const byEmail = await get(admin.token, `/admin/users?search=${user.email}`);
    expect(byEmail.body.data.users).toHaveLength(1);

    const frozen = await get(admin.token, "/admin/users?status=frozen");
    expect(frozen.body.data.pagination.total).toBe(1);
  });

  it("treats search text literally, not as a regex", async () => {
    const admin = await createAdmin();
    const res = await get(admin.token, "/admin/users?search=.*");
    expect(res.status).toBe(200);
    expect(res.body.data.users).toHaveLength(0);
  });

  it("rejects bad filters and paginates", async () => {
    const admin = await createAdmin();
    await createVerifiedUser();
    await createVerifiedUser();
    expect((await get(admin.token, "/admin/users?status=weird")).status).toBe(
      400,
    );
    expect((await get(admin.token, "/admin/users?limit=0")).status).toBe(400);

    const page = await get(admin.token, "/admin/users?limit=2");
    expect(page.body.data.users).toHaveLength(2);
    expect(page.body.data.pagination.hasNextPage).toBe(true);
  });
});

describe("GET /admin/users/:id and /admin/wallets/:userId", () => {
  it("returns the profile, wallet and masked KYC", async () => {
    const admin = await createAdmin();
    const user = await createVerifiedUser();
    await submitKyc(user.token);

    const res = await get(admin.token, `/admin/users/${user.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.kyc.nin).toBe("******8901");
    expect(res.body.data.user.kyc.bvn).toBe("******4321");
    expect(res.body.data.wallet.accountNumber).toBe(user.accountNumber);
    expect(JSON.stringify(res.body)).not.toContain("12345678901");
  });

  it("returns 404 for an unknown user and 400 for a malformed id", async () => {
    const admin = await createAdmin();
    expect(
      (await get(admin.token, "/admin/users/64b000000000000000000000")).status,
    ).toBe(404);
    expect((await get(admin.token, "/admin/users/not-an-id")).status).toBe(400);
  });

  it("returns a user's wallet", async () => {
    const admin = await createAdmin();
    const user = await createVerifiedUser();
    const res = await get(admin.token, `/admin/wallets/${user.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.wallet.balance).toBe(50000);
  });
});

describe("freeze and unfreeze", () => {
  it("freezes user and wallet, locks them out, notifies and audits", async () => {
    const admin = await createAdmin();
    const user = await createVerifiedUser();

    const res = await patch(admin.token, `/admin/users/${user.id}/freeze`, {
      reason: "Suspicious activity",
    });
    expect(res.status).toBe(200);
    expect(res.body.data.user.status).toBe("frozen");

    expect((await Wallet.findOne({ userId: user.id }))!.status).toBe("frozen");
    expect((await get(user.token, "/users/me")).status).toBe(403);

    const login = await request(app)
      .post(`${api}/auth/login`)
      .send({ email: user.email, password: user.password });
    expect(login.status).toBe(403);

    const audit = await AuditLog.findOne({ targetUserId: user.id });
    expect(audit!.action).toBe("freeze_user");
    expect(audit!.reason).toBe("Suspicious activity");
    expect(String(audit!.adminId)).toBe(admin.id);
    expect(
      await Notification.countDocuments({
        userId: user.id,
        type: "account_frozen",
      }),
    ).toBe(1);
  });

  it("requires a reason", async () => {
    const admin = await createAdmin();
    const user = await createVerifiedUser();
    expect(
      (await patch(admin.token, `/admin/users/${user.id}/freeze`, {})).status,
    ).toBe(400);
  });

  it("cannot freeze an admin, and cannot freeze twice", async () => {
    const admin = await createAdmin();
    const otherAdmin = await createAdmin();
    const user = await createVerifiedUser();

    expect(
      (
        await patch(admin.token, `/admin/users/${otherAdmin.id}/freeze`, {
          reason: "testing",
        })
      ).status,
    ).toBe(403);

    await patch(admin.token, `/admin/users/${user.id}/freeze`, {
      reason: "testing",
    });
    expect(
      (
        await patch(admin.token, `/admin/users/${user.id}/freeze`, {
          reason: "testing",
        })
      ).status,
    ).toBe(400);
  });

  it("blocks transfers to a frozen account", async () => {
    const admin = await createAdmin();
    const sender = await createVerifiedUser();
    const receiver = await createVerifiedUser();
    await setPin(sender.token);
    await patch(admin.token, `/admin/users/${receiver.id}/freeze`, {
      reason: "testing",
    });

    const res = await transfer(sender, receiver, 5000);
    expect(res.status).toBe(403);
  });

  it("unfreezes: user and wallet are active again and login works", async () => {
    const admin = await createAdmin();
    const user = await createVerifiedUser();
    await patch(admin.token, `/admin/users/${user.id}/freeze`, {
      reason: "testing",
    });

    const res = await patch(admin.token, `/admin/users/${user.id}/unfreeze`);
    expect(res.status).toBe(200);
    expect((await Wallet.findOne({ userId: user.id }))!.status).toBe("active");

    const login = await request(app)
      .post(`${api}/auth/login`)
      .send({ email: user.email, password: user.password });
    expect(login.status).toBe(200);
  });

  it("cannot unfreeze an account that is not frozen", async () => {
    const admin = await createAdmin();
    const user = await createVerifiedUser();
    expect(
      (await patch(admin.token, `/admin/users/${user.id}/unfreeze`)).status,
    ).toBe(400);
  });
});

describe("KYC review", () => {
  it("lists pending requests with masked values only", async () => {
    const admin = await createAdmin();
    const user = await createVerifiedUser();
    await submitKyc(user.token);

    const res = await get(admin.token, "/admin/kyc/pending");
    expect(res.body.data.requests).toHaveLength(1);
    expect(res.body.data.requests[0].nin).toBe("******8901");
    expect(JSON.stringify(res.body)).not.toContain("12345678901");
  });

  it("approves: tier 2, higher daily limit, notification and audit entry", async () => {
    const admin = await createAdmin();
    const user = await createVerifiedUser();
    await submitKyc(user.token);

    const res = await patch(admin.token, `/admin/kyc/${user.id}`, {
      decision: "approve",
    });
    expect(res.status).toBe(200);
    expect(res.body.data.kyc.currentTier).toBe(2);

    expect(
      (await Wallet.findOne({ userId: user.id }))!.dailyTransferLimit,
    ).toBe(200000);
    expect((await AuditLog.findOne({ targetUserId: user.id }))!.action).toBe(
      "kyc_approve",
    );
    expect(
      await Notification.countDocuments({
        userId: user.id,
        type: "kyc_approved",
      }),
    ).toBe(1);
  });

  it("rejects with a reason and keeps tier 1", async () => {
    const admin = await createAdmin();
    const user = await createVerifiedUser();
    await submitKyc(user.token);

    const res = await patch(admin.token, `/admin/kyc/${user.id}`, {
      decision: "reject",
      reason: "NIN could not be verified",
    });
    expect(res.status).toBe(200);
    expect(res.body.data.kyc.status).toBe("rejected");
    expect((await User.findById(user.id))!.kyc.currentTier).toBe(1);
    expect((await AuditLog.findOne({ targetUserId: user.id }))!.action).toBe(
      "kyc_reject",
    );
  });

  it.each([
    ["rejection without a reason", { decision: "reject" }],
    ["an invalid decision", { decision: "maybe" }],
  ])("rejects %s", async (_label, body) => {
    const admin = await createAdmin();
    const user = await createVerifiedUser();
    await submitKyc(user.token);
    expect(
      (await patch(admin.token, `/admin/kyc/${user.id}`, body)).status,
    ).toBe(400);
  });

  it("refuses when nothing is pending", async () => {
    const admin = await createAdmin();
    const user = await createVerifiedUser();
    const res = await patch(admin.token, `/admin/kyc/${user.id}`, {
      decision: "approve",
    });
    expect(res.status).toBe(400);
  });

  it("does not let an admin review their own KYC", async () => {
    const admin = await createAdmin();
    await submitKyc(admin.token);
    const res = await patch(admin.token, `/admin/kyc/${admin.id}`, {
      decision: "approve",
    });
    expect(res.status).toBe(403);
  });
});

describe("GET /admin/transactions", () => {
  it("shows each transfer once by default and both records with direction=all", async () => {
    const admin = await createAdmin();
    const sender = await createVerifiedUser();
    const receiver = await createVerifiedUser();
    await setPin(sender.token);
    await transfer(sender, receiver, 5000);

    const byDefault = await get(admin.token, "/admin/transactions");
    expect(byDefault.body.data.pagination.total).toBe(1);

    const all = await get(admin.token, "/admin/transactions?direction=all");
    expect(all.body.data.pagination.total).toBe(2);
  });

  it("filters by user and rejects bad filters", async () => {
    const admin = await createAdmin();
    const a = await createVerifiedUser();
    const b = await createVerifiedUser();
    const outsider = await createVerifiedUser();
    await setPin(a.token);
    await transfer(a, b, 5000);

    expect(
      (await get(admin.token, `/admin/transactions?userId=${b.id}`)).body.data
        .pagination.total,
    ).toBe(1);
    expect(
      (await get(admin.token, `/admin/transactions?userId=${outsider.id}`)).body
        .data.pagination.total,
    ).toBe(0);
    expect(
      (await get(admin.token, "/admin/transactions?status=weird")).status,
    ).toBe(400);
    expect(
      (await get(admin.token, "/admin/transactions?userId=nope")).status,
    ).toBe(400);
  });
});

describe("GET /admin/stats", () => {
  it("reports accurate platform numbers", async () => {
    const admin = await createAdmin();
    const sender = await createVerifiedUser();
    const receiver = await createVerifiedUser();
    await setPin(sender.token);
    await transfer(sender, receiver, 5000);
    await patch(admin.token, `/admin/users/${receiver.id}/freeze`, {
      reason: "testing",
    });

    const { stats } = (await get(admin.token, "/admin/stats")).body.data;
    expect(stats.users).toEqual({ total: 3, verified: 3, frozen: 1 });
    expect(stats.transfers.total).toBe(1);
    expect(stats.transfers.volume).toBe(5000);
    expect(stats.transfers.last24h).toBe(1);
    // Money only moves between wallets: 3 wallets x 50000
    expect(stats.wallets).toEqual({ total: 3, totalBalance: 150000 });
  });
});

describe("GET /admin/audit-logs", () => {
  it("lists actions newest first and filters by action", async () => {
    const admin = await createAdmin();
    const user = await createVerifiedUser();
    await patch(admin.token, `/admin/users/${user.id}/freeze`, {
      reason: "testing",
    });
    await patch(admin.token, `/admin/users/${user.id}/unfreeze`);

    const all = await get(admin.token, "/admin/audit-logs");
    expect(all.body.data.logs.map((l: { action: string }) => l.action)).toEqual(
      ["unfreeze_user", "freeze_user"],
    );
    expect(all.body.data.logs[0].adminId.email).toBe(admin.email);

    const only = await get(admin.token, "/admin/audit-logs?action=freeze_user");
    expect(only.body.data.pagination.total).toBe(1);
    expect(
      (await get(admin.token, "/admin/audit-logs?action=weird")).status,
    ).toBe(400);
  });
});
