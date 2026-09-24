import { Request, Response, NextFunction } from "express";
import AppError from "../utils/AppError.js";

const isDevelopment = process.env.NODE_ENV === "development";

// ─── Error shape for raw MongoDB / JWT errors ─────────────────────
type RawError = Error & {
  statusCode?: number;
  status?: string;
  isOperational?: boolean;
  code?: number;
  keyValue?: Record<string, unknown>;
  errors?: Record<string, { message: string }>;
};

// ─── Handle specific MongoDB/JWT errors ──────────────────────────

const handleCastError = () => new AppError("Invalid ID format", 400);

const handleDuplicateKeyError = (err: RawError) => {
  const field = Object.keys(err.keyValue ?? {})[0];
  return new AppError(`An account with this ${field} already exists`, 409);
};

const handleValidationError = (err: RawError) => {
  const messages = Object.values(err.errors ?? {})
    .map((el) => el.message)
    .join(". ");
  return new AppError(`Validation failed: ${messages}`, 400);
};

const handleJWTError = () =>
  new AppError("Invalid token. Please login again.", 401);

const handleJWTExpiredError = () =>
  new AppError("Token expired. Please login again.", 401);

// ─── Send error in development ────────────────────────────────────
const sendErrorDev = (err: RawError, res: Response) => {
  res.status(err.statusCode ?? 500).json({
    status: err.status ?? "error",
    message: err.message || "Something went wrong",
    stack: err.stack,
    error: err,
  });
};

// ─── Send error in production ─────────────────────────────────────
const sendErrorProd = (err: AppError, res: Response) => {
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
  err: RawError,
  _req: Request,
  res: Response,
  _next: NextFunction, // required: Express identifies error handlers by 4-arg arity
): void => {
  void _next;

  if (isDevelopment) {
    sendErrorDev(err, res);
    return;
  }

  // AppErrors thrown directly by the app are already operational — skip cloning
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
