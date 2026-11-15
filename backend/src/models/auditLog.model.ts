import mongoose, { Schema } from "mongoose";
import { IAuditLog, AUDIT_ACTIONS } from "../types/audit.types.js";

const AuditLogSchema = new Schema<IAuditLog>(
  {
    adminId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, enum: [...AUDIT_ACTIONS], required: true },
    targetUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, trim: true, maxlength: 200 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ targetUserId: 1, createdAt: -1 });

const AuditLog = mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
export default AuditLog;
