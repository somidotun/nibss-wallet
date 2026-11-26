import mongoose, { Schema } from "mongoose";

export interface IAiUsage {
  key: string;
  day: string;
  count: number;
  createdAt: Date;
}

const AiUsageSchema = new Schema<IAiUsage>({
  key: { type: String, required: true },
  day: { type: String, required: true },
  count: { type: Number, default: 0 },
  // counters clean themselves up after 3 days
  createdAt: { type: Date, default: Date.now, expires: 3 * 24 * 60 * 60 },
});

AiUsageSchema.index({ key: 1, day: 1 }, { unique: true });

const AiUsage = mongoose.model<IAiUsage>("AiUsage", AiUsageSchema);
export default AiUsage;
