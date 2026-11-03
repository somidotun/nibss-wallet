import request from "supertest";
import app from "../app.js";
import User from "../models/user.model.js";
import Feedback from "../models/feedback.model.js";
import { api, authHeader, createVerifiedUser, TestUser } from "./helpers.js";

const validBody = {
  category: "bug",
  message: "The receipt download is slow on mobile.",
  rating: 4,
};

const submit = (token: string, body: Record<string, unknown> = validBody) =>
  request(app).post(`${api}/feedback`).set(authHeader(token)).send(body);

// The role is read from the database, so promoting is enough
const createAdmin = async (): Promise<TestUser> => {
  const admin = await createVerifiedUser();
  await User.updateOne({ _id: admin.id }, { role: "admin" });
  return admin;
};

describe("POST /feedback", () => {
  it("requires authentication", async () => {
    const res = await request(app).post(`${api}/feedback`).send(validBody);
    expect(res.status).toBe(401);
  });

  it("creates feedback with status open", async () => {
    const user = await createVerifiedUser();
    const res = await submit(user.token);
    expect(res.status).toBe(201);
    expect(res.body.data.feedback.status).toBe("open");
    expect(res.body.data.feedback.category).toBe("bug");
  });

  it.each([
    ["unknown category", { ...validBody, category: "praise" }],
    ["message too short", { ...validBody, message: "bad" }],
    ["rating above 5", { ...validBody, rating: 6 }],
    ["missing message", { category: "bug" }],
  ])("rejects %s", async (_label, body) => {
    const user = await createVerifiedUser();
    const res = await submit(user.token, body);
    expect(res.status).toBe(400);
  });

  it("allows feedback without a rating", async () => {
    const user = await createVerifiedUser();
    const res = await submit(user.token, {
      category: "general",
      message: "Great app overall, thank you!",
    });
    expect(res.status).toBe(201);
  });

  it("limits a user to 5 submissions per hour", async () => {
    const user = await createVerifiedUser();
    for (let i = 0; i < 5; i++) {
      await Feedback.create({
        userId: user.id,
        category: "general",
        message: `Existing feedback number ${i}`,
      });
    }
    const res = await submit(user.token);
    expect(res.status).toBe(429);
  });
});

describe("GET /feedback/mine", () => {
  it("shows only the caller's feedback and hides the admin note", async () => {
    const a = await createVerifiedUser();
    const b = await createVerifiedUser();
    await submit(a.token);
    await submit(b.token);
    await Feedback.updateMany({}, { adminNote: "internal only" });

    const res = await request(app)
      .get(`${api}/feedback/mine`)
      .set(authHeader(a.token));
    expect(res.status).toBe(200);
    expect(res.body.data.feedback).toHaveLength(1);
    expect(res.body.data.feedback[0].adminNote).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("internal only");
  });
});

describe("GET /feedback (admin)", () => {
  it("forbids a normal user", async () => {
    const user = await createVerifiedUser();
    const res = await request(app)
      .get(`${api}/feedback`)
      .set(authHeader(user.token));
    expect(res.status).toBe(403);
  });

  it("lists everyone’s feedback with the author, filterable by status", async () => {
    const admin = await createAdmin();
    const user = await createVerifiedUser();
    await submit(user.token);
    await submit(user.token, {
      category: "general",
      message: "Another piece of feedback here.",
    });
    await Feedback.updateOne({ category: "general" }, { status: "resolved" });

    const all = await request(app)
      .get(`${api}/feedback`)
      .set(authHeader(admin.token));
    expect(all.status).toBe(200);
    expect(all.body.data.pagination.total).toBe(2);
    expect(all.body.data.feedback[0].userId.email).toBe(user.email);

    const resolved = await request(app)
      .get(`${api}/feedback?status=resolved`)
      .set(authHeader(admin.token));
    expect(resolved.body.data.pagination.total).toBe(1);
  });

  it("paginates", async () => {
    const admin = await createAdmin();
    const user = await createVerifiedUser();
    for (let i = 0; i < 3; i++) {
      await Feedback.create({
        userId: user.id,
        category: "general",
        message: `Pagination feedback ${i}`,
      });
    }
    const res = await request(app)
      .get(`${api}/feedback?limit=2`)
      .set(authHeader(admin.token));
    expect(res.body.data.feedback).toHaveLength(2);
    expect(res.body.data.pagination.hasNextPage).toBe(true);
  });
});

describe("PATCH /feedback/:id (admin)", () => {
  const create = async () => {
    const user = await createVerifiedUser();
    const res = await submit(user.token);
    return res.body.data.feedback.id as string;
  };

  it("updates status and admin note", async () => {
    const admin = await createAdmin();
    const id = await create();
    const res = await request(app)
      .patch(`${api}/feedback/${id}`)
      .set(authHeader(admin.token))
      .send({ status: "resolved", adminNote: "Fixed in the next release" });
    expect(res.status).toBe(200);
    expect(res.body.data.feedback.status).toBe("resolved");
    expect(res.body.data.feedback.adminNote).toBe("Fixed in the next release");
  });

  it("forbids a normal user", async () => {
    const user = await createVerifiedUser();
    const id = await create();
    const res = await request(app)
      .patch(`${api}/feedback/${id}`)
      .set(authHeader(user.token))
      .send({ status: "resolved" });
    expect(res.status).toBe(403);
  });

  it.each([
    ["invalid status", { status: "done" }],
    ["empty body", {}],
  ])("rejects %s", async (_label, body) => {
    const admin = await createAdmin();
    const id = await create();
    const res = await request(app)
      .patch(`${api}/feedback/${id}`)
      .set(authHeader(admin.token))
      .send(body);
    expect(res.status).toBe(400);
  });

  it("returns 400 for a malformed id and 404 for an unknown one", async () => {
    const admin = await createAdmin();
    const bad = await request(app)
      .patch(`${api}/feedback/not-an-id`)
      .set(authHeader(admin.token))
      .send({ status: "resolved" });
    expect(bad.status).toBe(400);

    const missing = await request(app)
      .patch(`${api}/feedback/64b000000000000000000000`)
      .set(authHeader(admin.token))
      .send({ status: "resolved" });
    expect(missing.status).toBe(404);
  });
});

describe("DELETE /feedback/:id (admin)", () => {
  it("lets an admin delete, but not a normal user", async () => {
    const admin = await createAdmin();
    const user = await createVerifiedUser();
    const created = await submit(user.token);
    const id = created.body.data.feedback.id;

    const denied = await request(app)
      .delete(`${api}/feedback/${id}`)
      .set(authHeader(user.token));
    expect(denied.status).toBe(403);

    const ok = await request(app)
      .delete(`${api}/feedback/${id}`)
      .set(authHeader(admin.token));
    expect(ok.status).toBe(200);
    expect(await Feedback.countDocuments()).toBe(0);
  });
});

describe("role is read from the database, not the token", () => {
  it("follows a promotion and a demotion without a new login", async () => {
    const user = await createVerifiedUser();
    const list = () =>
      request(app).get(`${api}/feedback`).set(authHeader(user.token));

    expect((await list()).status).toBe(403);
    await User.updateOne({ _id: user.id }, { role: "admin" });
    expect((await list()).status).toBe(200);
    await User.updateOne({ _id: user.id }, { role: "user" });
    expect((await list()).status).toBe(403);
  });
});
