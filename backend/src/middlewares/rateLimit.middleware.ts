import rateLimit from "express-rate-limit";
import { Request, Response } from "express";

// Tests skip limiting unless a test turns it on explicitly
const shouldSkip = () =>
  process.env.NODE_ENV === "test" && process.env.RATE_LIMIT_ENABLED !== "true";

interface LimiterConfig {
  windowMs: number;
  limit: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

export const createLimiter = ({
  message = "Too many requests. Please try again later.",
  ...config
}: LimiterConfig) =>
  rateLimit({
    ...config,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: shouldSkip,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({ status: "error", message });
    },
  });

const FIFTEEN_MINUTES = 15 * 60 * 1000;

export const globalLimiter = createLimiter({
  windowMs: FIFTEEN_MINUTES,
  limit: 300,
});

export const loginLimiter = createLimiter({
  windowMs: FIFTEEN_MINUTES,
  limit: 10,
  skipSuccessfulRequests: true,
  message: "Too many login attempts. Please try again in 15 minutes.",
});

export const registerLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message:
    "Too many sign-up attempts from this network. Please try again later.",
});

export const otpLimiter = createLimiter({
  windowMs: FIFTEEN_MINUTES,
  limit: 10,
  message: "Too many verification attempts. Please try again later.",
});

// Per user, not per IP: users behind one office or phone network must not share a bucket
export const transferLimiter = createLimiter({
  windowMs: 60 * 1000,
  limit: 10,
  keyGenerator: (req) => req.user?.userId ?? "anonymous",
  message: "Too many transfer attempts. Please slow down.",
});
