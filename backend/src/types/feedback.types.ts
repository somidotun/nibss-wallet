import { Document, Types } from "mongoose";

export const FEEDBACK_CATEGORIES = [
  "bug",
  "feature_request",
  "complaint",
  "general",
] as const;
export const FEEDBACK_STATUSES = ["open", "reviewed", "resolved"] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export interface IFeedback extends Document {
  userId: Types.ObjectId;
  category: FeedbackCategory;
  message: string;
  rating?: number;
  status: FeedbackStatus;
  adminNote?: string;
  createdAt: Date;
  updatedAt: Date;
}
