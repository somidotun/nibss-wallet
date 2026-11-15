import { Document, Types } from "mongoose";

export const AUDIT_ACTIONS = [
  "freeze_user",
  "unfreeze_user",
  "kyc_approve",
  "kyc_reject",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface IAuditLog extends Document {
  adminId: Types.ObjectId;
  action: AuditAction;
  targetUserId: Types.ObjectId;
  reason?: string;
  createdAt: Date;
}
