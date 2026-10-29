import jwt from "jsonwebtoken";
import {
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
} from "../utils/jwt.utils.js";

const payload = { userId: "abc123", role: "user" as const };

describe("jwt utils", () => {
  it("generates a pair that verifies with the right secret", () => {
    const { accessToken, refreshToken } = generateTokenPair(payload);
    expect(verifyAccessToken(accessToken)).toMatchObject(payload);
    expect(verifyRefreshToken(refreshToken)).toMatchObject(payload);
  });

  it("does not accept an access token as a refresh token, or the reverse", () => {
    const { accessToken, refreshToken } = generateTokenPair(payload);
    expect(() => verifyRefreshToken(accessToken)).toThrow();
    expect(() => verifyAccessToken(refreshToken)).toThrow();
  });

  it("rejects an expired token", () => {
    const expired = jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, {
      expiresIn: "-1s",
    });
    expect(() => verifyAccessToken(expired)).toThrow("jwt expired");
  });

  it("rejects a tampered token", () => {
    const { accessToken } = generateTokenPair(payload);
    expect(() => verifyAccessToken(accessToken + "x")).toThrow();
  });

  it("throws when the secret is missing", () => {
    const original = process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_ACCESS_SECRET;
    try {
      expect(() => generateTokenPair(payload)).toThrow("JWT_ACCESS_SECRET");
    } finally {
      process.env.JWT_ACCESS_SECRET = original;
    }
  });
});
