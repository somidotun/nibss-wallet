import { Request, Response, NextFunction } from "express";
import AppError from "../utils/AppError.js";

// MongoDB operators start with "$" and paths use ".", so neither belongs in a key
const hasUnsafeKey = (value: unknown, depth = 0): boolean => {
  if (depth > 10) return true; // absurdly deep: refuse
  if (Array.isArray(value))
    return value.some((v) => hasUnsafeKey(v, depth + 1));
  if (value && typeof value === "object") {
    return Object.entries(value).some(
      ([key, v]) =>
        key.includes("$") || key.includes(".") || hasUnsafeKey(v, depth + 1),
    );
  }
  return false;
};

export const rejectUnsafeKeys = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (hasUnsafeKey(req.body) || hasUnsafeKey(req.query)) {
    next(new AppError('Invalid request: keys cannot contain "$" or "."', 400));
    return;
  }
  next();
};
