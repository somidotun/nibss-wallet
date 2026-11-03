import { Request, Response, NextFunction } from "express";
import {
  createFeedback,
  getMyFeedback,
  getAllFeedback,
  updateFeedback,
  deleteFeedback,
} from "../services/feedback.service.js";

const toQuery = (req: Request) => ({
  page: req.query.page ? Number(req.query.page) : undefined,
  limit: req.query.limit ? Number(req.query.limit) : undefined,
  status: req.query.status as string | undefined,
  category: req.query.category as string | undefined,
});

export const submit = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { category, message, rating } = req.body;
    const feedback = await createFeedback(req.user!.userId, {
      category,
      message,
      rating,
    });
    res.status(201).json({
      status: "success",
      message: "Thank you for your feedback",
      data: {
        feedback: {
          id: feedback._id,
          category: feedback.category,
          message: feedback.message,
          rating: feedback.rating,
          status: feedback.status,
          createdAt: feedback.createdAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const listMine = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const data = await getMyFeedback(req.user!.userId, toQuery(req));
    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};

export const listAll = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const data = await getAllFeedback(toQuery(req));
    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};

export const update = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { status, adminNote } = req.body;
    const { id } = req.params;
    const feedback = await updateFeedback(id as string, { status, adminNote });
    res.status(200).json({ status: "success", data: { feedback } });
  } catch (error) {
    next(error);
  }
};

export const remove = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    await deleteFeedback(id as string);
    res.status(200).json({ status: "success", message: "Feedback deleted" });
  } catch (error) {
    next(error);
  }
};
