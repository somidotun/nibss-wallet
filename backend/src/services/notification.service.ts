import { Types } from "mongoose";
import Notification from "../models/notification.model.js";
import { NotificationType } from "../types/notification.types.js";
import AppError from "../utils/AppError.js";

export interface CreateNotificationInput {
  userId: string | Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

// Never throws: a failed notification must not break the action behind it
export const createNotification = async (
  input: CreateNotificationInput,
): Promise<void> => {
  try {
    await Notification.create(input);
  } catch (error) {
    console.log(
      "Failed to create notification:",
      error instanceof Error ? error.message : error,
    );
  }
};

export interface NotificationQuery {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

export const getUserNotifications = async (
  userId: string,
  query: NotificationQuery,
) => {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(50, Math.max(1, query.limit ?? 20));

  const filter: Record<string, unknown> = { userId };
  if (query.unreadOnly) filter.isRead = false;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId, isRead: false }),
  ]);

  return {
    notifications,
    unreadCount,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPreviousPage: page > 1,
    },
  };
};

// Filtering by userId too means you can never touch someone else's notification
export const markNotificationRead = async (id: string, userId: string) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: id, userId },
    { isRead: true, readAt: new Date() },
    { returnDocument: "after" },
  );
  if (!notification) throw new AppError("Notification not found", 404);
  return notification;
};

export const markAllNotificationsRead = async (userId: string) => {
  const result = await Notification.updateMany(
    { userId, isRead: false },
    { isRead: true, readAt: new Date() },
  );
  return result.modifiedCount;
};

export const deleteNotification = async (id: string, userId: string) => {
  const notification = await Notification.findOneAndDelete({
    _id: id,
    userId,
  });
  if (!notification) throw new AppError("Notification not found", 404);
};
