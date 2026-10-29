import { encrypt, decrypt, maskValue } from "../utils/encryption.utils.js";

describe("encryption utils", () => {
  it("round-trips a value", () => {
    expect(decrypt(encrypt("12345678901"))).toBe("12345678901");
  });

  it("never stores plaintext and uses the iv:tag:data format", () => {
    const out = encrypt("12345678901");
    expect(out).not.toContain("12345678901");
    expect(out).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
  });

  it("produces different ciphertext each time (random IV)", () => {
    expect(encrypt("12345678901")).not.toBe(encrypt("12345678901"));
  });

  it("detects tampering (GCM auth tag)", () => {
    const [iv, tag, data] = encrypt("12345678901").split(":");
    const flipped = (data[0] === "a" ? "b" : "a") + data.slice(1);
    expect(() => decrypt(`${iv}:${tag}:${flipped}`)).toThrow();
  });

  it("rejects malformed input", () => {
    expect(() => decrypt("not-valid")).toThrow("Invalid encrypted data format");
  });

  it("cannot decrypt with a different key", () => {
    const original = process.env.ENCRYPTION_KEY;
    const encrypted = encrypt("12345678901");
    process.env.ENCRYPTION_KEY = "a-completely-different-key-value";
    try {
      expect(() => decrypt(encrypted)).toThrow();
    } finally {
      process.env.ENCRYPTION_KEY = original;
    }
  });

  it("throws when ENCRYPTION_KEY is missing", () => {
    const original = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    try {
      expect(() => encrypt("x")).toThrow("ENCRYPTION_KEY");
    } finally {
      process.env.ENCRYPTION_KEY = original;
    }
  });

  it("masks all but the last 4 digits", () => {
    expect(maskValue("12345678901")).toBe("******8901");
  });
});
