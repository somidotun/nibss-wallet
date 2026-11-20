import crypto from "crypto";
import { Request, Response } from "express";
import { confirmDeposit } from "../services/funding.service.js";

export const hasValidSignature = (
  rawBody: Buffer,
  signature: string | undefined,
): boolean => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) return false;
  const expected = crypto
    .createHmac("sha512", secret)
    .update(rawBody)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export const paystackWebhook = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const raw: unknown = req.body;

  if (
    !Buffer.isBuffer(raw) ||
    !hasValidSignature(raw, req.header("x-paystack-signature"))
  ) {
    res.status(401).json({ status: "error", message: "Invalid signature" });
    return;
  }

  let event: { event?: string; data?: { reference?: unknown } };
  try {
    event = JSON.parse(raw.toString("utf8"));
  } catch {
    res.status(400).json({ status: "error", message: "Invalid JSON" });
    return;
  }

  // Acknowledge events we do not act on, so Paystack stops retrying them
  if (
    event.event !== "charge.success" ||
    typeof event.data?.reference !== "string"
  ) {
    res.status(200).json({ status: "success" });
    return;
  }

  try {
    await confirmDeposit(event.data.reference);
    res.status(200).json({ status: "success" });
  } catch (error) {
    console.error(
      "Paystack webhook processing failed:",
      error instanceof Error ? error.message : error,
    );
    // Non-2xx makes Paystack retry later. Settling is idempotent, so that is safe.
    res.status(500).json({ status: "error", message: "Processing failed" });
  }
};
