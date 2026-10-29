import request from "supertest";
import app from "../app.js";
import { api } from "./helpers.js";

describe("app", () => {
  it("health check returns success with a timestamp", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(new Date(res.body.timestamp).toString()).not.toBe("Invalid Date");
  });

  it("returns a JSON 404 for unknown routes", async () => {
    const res = await request(app).get(`${api}/does-not-exist`);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe(`Route ${api}/does-not-exist not found`);
  });

  it("sets security headers via helmet", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("returns 400, not 500, for a malformed JSON body", async () => {
    const res = await request(app)
      .post(`${api}/auth/login`)
      .set("Content-Type", "application/json")
      .send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid JSON body");
  });
});
