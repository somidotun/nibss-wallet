import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes.js";
import errorHandler from "./middlewares/error.middleware.js";
import AppError from "./utils/AppError.js";

const app: Application = express();

// Security middleware
app.use(helmet());

// CORS — allows frontend to communicate with this API
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true, // allows cookies to be sent
  }),
);

// Parse incoming JSON requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser middleware
app.use(cookieParser());

// HTTP request logger
app.use(morgan("dev"));

// Health check endpoint
app.get("/api/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "success",
    message: "Nibss Wallet API is running",
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ──────────────────────────────────────────────────
app.use("/api/v1/auth", authRoutes);

// 404 handler — catches all unmatched routes (must be after all routes)
app.all("/{*path}", (req: Request, res: Response, next: NextFunction) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
});

// ─── Global error handler ─────────────────────────────────────────
app.use(errorHandler);

export default app;
