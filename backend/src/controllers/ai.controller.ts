import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync.js";
import {
  answerChat,
  getAiStatus,
  getCategorizedTransactions,
  getInsights,
} from "../services/ai/ai.service.js";

export const status = catchAsync(async (req: Request, res: Response) => {
  res
    .status(200)
    .json({ status: "success", data: await getAiStatus(req.user!.userId) });
});

export const insights = catchAsync(async (req: Request, res: Response) => {
  const days = typeof req.query.days === "string" ? Number(req.query.days) : 30;
  const narrate = req.query.narrate === "true";
  const data = await getInsights(req.user!.userId, days, narrate);
  res.status(200).json({ status: "success", data });
});

export const categorize = catchAsync(async (req: Request, res: Response) => {
  const page =
    typeof req.query.page === "string" ? Number(req.query.page) : undefined;
  const limit =
    typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
  const data = await getCategorizedTransactions(req.user!.userId, page, limit);
  res.status(200).json({ status: "success", data });
});

export const chat = catchAsync(async (req: Request, res: Response) => {
  const data = await answerChat(req.user!.userId, req.body.message);
  res.status(200).json({ status: "success", data });
});
