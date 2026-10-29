import { Document, Types } from "mongoose";

export const NOTIFICATION_TYPES = [
  "welcome",
  "transfer_sent",
  "transfer_received",
  "transfer_failed",
  "security_alert",
  "kyc_submitted",
  "kyc_approved",
  "kyc_rejected",
  "account_frozen",
  "account_unfrozen",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface INotification extends Document {
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  readAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
