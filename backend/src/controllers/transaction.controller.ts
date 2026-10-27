import { Request, Response, NextFunction } from "express";
import {
  getUserTransactions,
  getTransactionById,
} from "../services/transaction.service.js";

// ─── Get All Transactions ─────────────────────────────────────────
export const getTransactions = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { page, limit, type, status, direction, startDate, endDate } =
      req.query;

    const result = await getUserTransactions(req.user!.userId, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      type: type as string,
      status: status as string,
      direction: direction as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Get Single Transaction ───────────────────────────────────────
export const getTransaction = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const transaction = await getTransactionById(id as string, req.user!.userId);

    res.status(200).json({
      status: "success",
      data: { transaction },
    });
  } catch (error) {
    next(error);
  }
};
