import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync.js";
import {
  initializeFunding,
  verifyUserDeposit,
} from "../services/funding.service.js";

export const fundWallet = catchAsync(async (req: Request, res: Response) => {
  const data = await initializeFunding(req.user!.userId, req.body.amount);
  res.status(201).json({
    status: "success",
    message: "Payment started. Complete it on the Paystack page.",
    data,
  });
});

export const verifyPayment = catchAsync(async (req: Request, res: Response) => {
  const { reference } = req.params;
  const data = await verifyUserDeposit(req.user!.userId, reference as string);
  res.status(200).json({ status: "success", data });
});
