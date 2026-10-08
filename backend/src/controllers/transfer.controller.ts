import { Request, Response, NextFunction } from "express";
import { transferFunds } from "../services/transfer.service.js";

export const transfer = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { accountNumber, amount, description, idempotencyKey, pin } =
      req.body;

    const result = await transferFunds({
      senderId: req.user!.userId,
      accountNumber,
      amount,
      description,
      idempotencyKey,
      pin,
    });

    if (result.isDuplicate) {
      res.status(200).json({
        status: "success",
        message: "Duplicate request — returning existing transaction",
        data: { transaction: result.transaction },
      });
      return;
    }

    res.status(200).json({
      status: "success",
      message: "Transfer successful",
      data: {
        transaction: {
          id: result.transaction!._id,
          reference: result.transaction!.reference,
          amount: result.transaction!.amount,
          currency: result.transaction!.currency,
          direction: result.transaction!.direction,
          balanceBefore: result.transaction!.balanceBefore,
          balanceAfter: result.transaction!.balanceAfter,
          description: result.transaction!.description,
          status: result.transaction!.status,
          createdAt: result.transaction!.createdAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Download Receipt ─────────────────────────────────────────────
export const downloadReceipt = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const Transaction = (await import("../models/transaction.model.js"))
      .default;
    const User = (await import("../models/user.model.js")).default;
    const { generateTransactionReceipt } =
      await import("../utils/receipt.utils.js");

    const transaction = await Transaction.findById(id);
    if (!transaction) {
      res
        .status(404)
        .json({ status: "error", message: "Transaction not found" });
      return;
    }

    // Only sender can download receipt
    if (transaction.senderId.toString() !== req.user!.userId) {
      res.status(403).json({ status: "error", message: "Access denied" });
      return;
    }

    const sender = await User.findById(transaction.senderId);
    const receiver = await User.findById(transaction.receiverId);

    const receiptBuffer = await generateTransactionReceipt(
      transaction,
      `${sender?.firstName} ${sender?.lastName}`,
      `${receiver?.firstName} ${receiver?.lastName}`,
    );

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=receipt-${transaction.reference}.pdf`,
      "Content-Length": receiptBuffer.length,
    });

    res.send(receiptBuffer);
  } catch (error) {
    next(error);
  }
};
