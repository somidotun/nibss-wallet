import Feedback from "../models/feedback.model.js";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
  FeedbackCategory,
  FeedbackStatus,
} from "../types/feedback.types.js";
import AppError from "../utils/AppError.js";

const MAX_PER_HOUR = 5;

const pageOptions = (page?: number, limit?: number) => {
  const p = Number.isFinite(page) ? Math.max(1, Math.floor(page!)) : 1;
  const l = Number.isFinite(limit)
    ? Math.min(50, Math.max(1, Math.floor(limit!)))
    : 20;
  return { page: p, limit: l, skip: (p - 1) * l };
};

const paginationMeta = (total: number, page: number, limit: number) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
  hasNextPage: page < Math.ceil(total / limit),
  hasPreviousPage: page > 1,
});

export interface CreateFeedbackInput {
  category: FeedbackCategory;
  message: string;
  rating?: number;
}

export const createFeedback = async (
  userId: string,
  input: CreateFeedbackInput,
) => {
  // Cheap spam guard until global rate limiting is added
  const recent = await Feedback.countDocuments({
    userId,
    createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
  });
  if (recent >= MAX_PER_HOUR) {
    throw new AppError(
      "Too many feedback submissions. Please try again later.",
      429,
    );
  }
  return Feedback.create({ userId, ...input });
};

export interface FeedbackQuery {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
}

// Users never see the admin's internal note
export const getMyFeedback = async (userId: string, query: FeedbackQuery) => {
  const { page, limit, skip } = pageOptions(query.page, query.limit);
  const [feedback, total] = await Promise.all([
    Feedback.find({ userId })
      .select("-adminNote")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Feedback.countDocuments({ userId }),
  ]);
  return { feedback, pagination: paginationMeta(total, page, limit) };
};

export const getAllFeedback = async (query: FeedbackQuery) => {
  const { page, limit, skip } = pageOptions(query.page, query.limit);

  const filter: Record<string, unknown> = {};
  if ((FEEDBACK_STATUSES as readonly string[]).includes(query.status ?? "")) {
    filter.status = query.status;
  }
  if (
    (FEEDBACK_CATEGORIES as readonly string[]).includes(query.category ?? "")
  ) {
    filter.category = query.category;
  }

  const [feedback, total] = await Promise.all([
    Feedback.find(filter)
      .populate("userId", "firstName lastName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Feedback.countDocuments(filter),
  ]);
  return { feedback, pagination: paginationMeta(total, page, limit) };
};

export interface UpdateFeedbackInput {
  status?: FeedbackStatus;
  adminNote?: string;
}

export const updateFeedback = async (
  id: string,
  input: UpdateFeedbackInput,
) => {
  const update: UpdateFeedbackInput = {};
  if (input.status !== undefined) update.status = input.status;
  if (input.adminNote !== undefined) update.adminNote = input.adminNote;

  const feedback = await Feedback.findByIdAndUpdate(id, update, {
    returnDocument: "after",
    runValidators: true,
  });
  if (!feedback) throw new AppError("Feedback not found", 404);
  return feedback;
};

export const deleteFeedback = async (id: string) => {
  const feedback = await Feedback.findByIdAndDelete(id);
  if (!feedback) throw new AppError("Feedback not found", 404);
};
