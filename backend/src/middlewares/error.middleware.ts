import { Request, Response, NextFunction } from "express";
import AppError from "../utils/AppError.js";

const isDevelopment = process.env.NODE_ENV === "development";

// ─── Handle specific MongoDB/JWT errors ──────────────────────────

const handleCastError = () => new AppError("Invalid ID format", 400);

const handleDuplicateKeyError = (err: {
  keyValue: Record<string, unknown>;
}) => {
  const field = Object.keys(err.keyValue)[0];
  return new AppError(`An account with this ${field} already exists`, 409);
};

const handleValidationError = (err: {
  errors: Record<string, { message: string }>;
}) => {
  const messages = Object.values(err.errors)
    .map((el) => el.message)
    .join(". ");
  return new AppError(`Validation failed: ${messages}`, 400);
};

const handleJWTError = () =>
  new AppError("Invalid token. Please login again.", 401);

const handleJWTExpiredError = () =>
  new AppError("Token expired. Please login again.", 401);

// ─── Send error in development ────────────────────────────────────
const sendErrorDev = (err: any, res: Response) => {
  res.status(err.statusCode || 500).json({
    status: err.status || "error",
    message: err.message || "Something went wrong",
    stack: err.stack,
    error: err,
  });
};

// ─── Send error in production ─────────────────────────────────────
const sendErrorProd = (err: any, res: Response) => {
  if (err.isOperational) {
    // Trusted, known error — safe to send to client
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // Unknown error — don't leak internals
    console.error("UNEXPECTED ERROR:", err);
    res.status(500).json({
      status: "error",
      message: "Something went wrong. Please try again later.",
    });
  }
};

// ─── Global Error Handler ─────────────────────────────────────────
const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (isDevelopment) {
    sendErrorDev(err, res);
    return;
  }

  // AppErrors thrown directly by the app are already operational — skip cloning
  // (cloning via Object.assign loses `message` since it's non-enumerable on Error)
  if (err instanceof AppError) {
    sendErrorProd(err, res);
    return;
  }

  // Normalise known MongoDB / JWT errors into operational AppErrors
  let error: AppError;

  if (err.name === "CastError") error = handleCastError();
  else if (err.code === 11000) error = handleDuplicateKeyError(err);
  else if (err.name === "ValidationError") error = handleValidationError(err);
  else if (err.name === "JsonWebTokenError") error = handleJWTError();
  else if (err.name === "TokenExpiredError") error = handleJWTExpiredError();
  else error = new AppError(err.message || "Something went wrong", 500);

  sendErrorProd(error, res);
};

export default errorHandler;
