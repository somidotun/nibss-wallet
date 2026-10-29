import request from "supertest";
import jwt from "jsonwebtoken";
import { jest } from "@jest/globals";
import { Request, Response, NextFunction } from "express";
import app from "../app.js";
import User from "../models/user.model.js";
import { restrictTo } from "../middlewares/auth.middleware.js";
import { api, authHeader, createVerifiedUser } from "./helpers.js";

const protectedRoute = (headers: Record<string, string> = {}) =>
  request(app).get(`${api}/users/me`).set(headers);

describe("protect middleware", () => {
  it("rejects a missing Authorization header", async () => {
    const res = await protectedRoute();
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Access denied. No token provided.");
  });

  it("rejects a non-Bearer scheme", async () => {
    const res = await protectedRoute({ Authorization: "Token abc" });
    expect(res.status).toBe(401);
  });

  it("rejects a garbage token", async () => {
    const res = await protectedRoute({ Authorization: "Bearer garbage" });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid token.");
  });

  it("rejects an expired token", async () => {
    const user = await createVerifiedUser();
    const expired = jwt.sign(
      { userId: user.id, role: "user" },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: "-1s" },
    );
    const res = await protectedRoute(authHeader(expired));
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/expired/i);
  });

  it("rejects a token for a user that no longer exists", async () => {
    const user = await createVerifiedUser();
    await User.deleteOne({ _id: user.id });
    const res = await protectedRoute(authHeader(user.token));
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("User no longer exists.");
  });

  it.each(["frozen", "suspended"])("blocks a %s account", async (status) => {
    const user = await createVerifiedUser();
    await User.updateOne({ _id: user.id }, { status });
    const res = await protectedRoute(authHeader(user.token));
    expect(res.status).toBe(403);
  });
});

describe("restrictTo middleware", () => {
  const run = (role: "user" | "admin" | undefined) => {
    const req = { user: role ? { role } : undefined } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;
    restrictTo("admin")(req, res, next);
    return { res, next };
  };

  it("blocks a regular user", () => {
    const { res, next } = run("user");
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("blocks a request with no user", () => {
    const { res, next } = run(undefined);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("lets an admin through", () => {
    const { next } = run("admin");
    expect(next).toHaveBeenCalled();
  });
});
