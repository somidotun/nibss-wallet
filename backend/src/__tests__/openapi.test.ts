import request from "supertest";
import SwaggerParser from "@apidevtools/swagger-parser";
import app from "../app.js";
import { openApiSpec, TAGS } from "../docs/openapi.js";
import { authHeader, createAdmin } from "./helpers.js";

const METHODS = ["get", "post", "patch", "delete"] as const;
type Method = (typeof METHODS)[number];

interface Operation {
  path: string;
  method: Method;
  base: string;
  op: {
    tags: string[];
    summary: string;
    description?: string;
    security: unknown[];
    responses: Record<string, unknown>;
  };
}

type PathItem = Partial<Record<Method, Operation["op"]>> & {
  servers?: { url: string }[];
};

const operations: Operation[] = Object.entries(
  openApiSpec.paths as Record<string, PathItem>,
).flatMap(([path, item]) =>
  METHODS.filter((m): m is Method => Boolean(item[m])).map((method) => ({
    path,
    method,
    base: item.servers?.[0]?.url ?? "/api/v1",
    op: item[method]!,
  })),
);

describe("OpenAPI document", () => {
  it("is valid OpenAPI", async () => {
    const copy = JSON.parse(JSON.stringify(openApiSpec)); // the parser edits its input
    await expect(SwaggerParser.validate(copy)).resolves.toBeDefined();
  });

  it("documents every endpoint group", () => {
    expect(operations.length).toBeGreaterThanOrEqual(45);
  });

  it("gives every operation a declared tag, a summary and a success response", () => {
    const declared = TAGS.map((t) => t.name);
    for (const { path, method, op } of operations) {
      const label = `${method.toUpperCase()} ${path}`;
      expect({ label, ok: op.tags.every((t) => declared.includes(t)) }).toEqual(
        { label, ok: true },
      );
      expect({ label, summary: Boolean(op.summary) }).toEqual({
        label,
        summary: true,
      });
      const hasSuccess = Object.keys(op.responses).some((c) =>
        c.startsWith("2"),
      );
      expect({ label, hasSuccess }).toEqual({ label, hasSuccess: true });
    }
  });

  it("declares 401 on protected operations and 403 on admin ones", () => {
    for (const { path, method, op } of operations) {
      const label = `${method.toUpperCase()} ${path}`;
      if (op.security.length > 0) {
        expect({ label, has401: "401" in op.responses }).toEqual({
          label,
          has401: true,
        });
      }
      if (op.description?.startsWith("**Admin only.**")) {
        expect({ label, has403: "403" in op.responses }).toEqual({
          label,
          has403: true,
        });
      }
    }
  });

  it("marks every /admin path as admin only", () => {
    for (const { path, method, op } of operations.filter((o) =>
      o.path.startsWith("/admin"),
    )) {
      const label = `${method.toUpperCase()} ${path}`;
      expect({
        label,
        admin: op.description?.startsWith("**Admin only.**"),
      }).toEqual({ label, admin: true });
    }
  });

  it("contains no secrets", () => {
    const text = JSON.stringify(openApiSpec);
    for (const key of [
      "JWT_ACCESS_SECRET",
      "JWT_REFRESH_SECRET",
      "ENCRYPTION_KEY",
      "PAYSTACK_SECRET_KEY",
    ]) {
      const value = process.env[key];
      if (value) expect(text).not.toContain(value);
    }
  });
});

describe("docs pages", () => {
  it("serves the Swagger UI and the JSON spec", async () => {
    const ui = await request(app).get("/api/docs/");
    expect(ui.status).toBe(200);
    expect(ui.headers["content-type"]).toContain("text/html");
    expect(ui.text).toContain("swagger-ui");

    const json = await request(app).get("/api/docs/openapi.json");
    expect(json.status).toBe(200);
    expect(json.body.info.title).toContain("API");
    expect(json.body.openapi).toBe("3.0.3");
  });

  it("does not leave the rest of the API without its security headers", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["content-security-policy"]).toBeDefined();
  });
});

describe("documented endpoints exist", () => {
  const dummy: Record<string, string> = {
    accountNumber: "9000000000",
    reference: "FUND-AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA",
  };

  it('answers every documented path and method with something other than "route not found"', async () => {
    // An admin token passes every auth check, so a missing route would reach the 404 handler
    const admin = await createAdmin();
    const missing: string[] = [];

    for (const { path, method, base } of operations) {
      const url =
        base +
        path.replace(
          /\{(\w+)\}/g,
          (_m, name: string) => dummy[name] ?? "64b000000000000000000000",
        );
      const res = await request(app)[method](url).set(authHeader(admin.token));
      if (/^Route .+ not found$/.test(String(res.body?.message ?? ""))) {
        missing.push(`${method.toUpperCase()} ${url}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
