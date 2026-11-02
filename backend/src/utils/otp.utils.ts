import crypto from "crypto";

const generateSecureOtp = (): string =>
  crypto.randomInt(100000, 1000000).toString();

const hashOtp = (otp: string): string =>
  crypto.createHash("sha256").update(otp).digest("hex");

const safeEqual = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

export { generateSecureOtp, hashOtp, safeEqual };
