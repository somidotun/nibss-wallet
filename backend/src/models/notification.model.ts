import mongoose, { Schema } from "mongoose";
import {
  INotification,
  NOTIFICATION_TYPES,
} from "../types/notification.types.js";

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: [...NOTIFICATION_TYPES],
      required: true,
    },

    title: { type: String, required: true, trim: true, maxlength: 100 },
    message: { type: String, required: true, trim: true, maxlength: 300 },
    isRead: { type: Boolean, default: false },
    readAt: Date,
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

// List newest first per user, and count unread quickly
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });

const Notification = mongoose.model<INotification>(
  "Notification",
  NotificationSchema,
);
export default Notification;
