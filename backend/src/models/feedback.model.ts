import mongoose, { Schema } from "mongoose";
import {
  IFeedback,
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
} from "../types/feedback.types.js";

const FeedbackSchema = new Schema<IFeedback>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    category: {
      type: String,
      enum: [...FEEDBACK_CATEGORIES],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 1000,
    },
    rating: { type: Number, min: 1, max: 5 },
    status: {
      type: String,
      enum: [...FEEDBACK_STATUSES],
      default: "open",
    },
    adminNote: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

FeedbackSchema.index({ userId: 1, createdAt: -1 });
FeedbackSchema.index({ status: 1, createdAt: -1 });

const Feedback = mongoose.model<IFeedback>("Feedback", FeedbackSchema);
export default Feedback;
