import { Request, Response, NextFunction } from "express";
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from "../services/notification.service.js";

export const getNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { page, limit, unreadOnly } = req.query;
    const result = await getUserNotifications(req.user!.userId, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      unreadOnly: unreadOnly === "true",
    });
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
};

export const markRead = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const notification = await markNotificationRead(
      id as string,
      req.user!.userId,
    );
    res.status(200).json({ status: "success", data: { notification } });
  } catch (error) {
    next(error);
  }
};

export const markAllRead = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const updated = await markAllNotificationsRead(req.user!.userId);
    res.status(200).json({
      status: "success",
      message: "All notifications marked as read",
      data: { updated },
    });
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
    await deleteNotification(id as string, req.user!.userId);
    res.status(200).json({
      status: "success",
      message: "Notification deleted",
    });
  } catch (error) {
    next(error);
  }
};
