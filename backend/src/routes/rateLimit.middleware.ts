import { Request } from "express";
import { createLimiter } from "../middlewares/rateLimit.middleware.js";

export const fundLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: (req: Request) => req.user?.userId ?? "anonymous",
  message: "Too many funding attempts. Please try again later.",
});