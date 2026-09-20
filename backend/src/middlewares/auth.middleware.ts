import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, JwtPayload } from "../utils/jwt.utils.js";
import User from "../models/user.model.js";

// Extend Express Request to include user
declare module "express-serve-static-core" {
  interface Request {
    user?: JwtPayload & { status: string };
  }
}

// ─── Protect Route ───────────────────────────────────────────────
export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // 1. Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        status: "error",
        message: "Access denied. No token provided.",
      });
      return;
    }

    const token = authHeader.split(" ")[1];

    // 2. Verify the token
    const payload = verifyAccessToken(token);

    // 3. Check user still exists and is active
    const user = await User.findById(payload.userId);

    if (!user) {
      res.status(401).json({
        status: "error",
        message: "User no longer exists.",
      });
      return;
    }

    if (user.status !== "active") {
      res.status(403).json({
        status: "error",
        message: "Your account is not active. Contact support.",
      });
      return;
    }

    // 4. Attach user to request
    req.user = {
      userId: payload.userId,
      role: payload.role,
      status: user.status,
    };

    next();
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === "TokenExpiredError") {
        res.status(401).json({
          status: "error",
          message: "Token expired. Please refresh your session.",
        });
        return;
      }
      if (error.name === "JsonWebTokenError") {
        res.status(401).json({
          status: "error",
          message: "Invalid token.",
        });
        return;
      }
    }
    next(error);
  }
};

// ─── Restrict to Roles ───────────────────────────────────────────
export const restrictTo = (...roles: Array<"user" | "admin">) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        status: "error",
        message: "You do not have permission to perform this action.",
      });
      return;
    }
    next();
  };
};
