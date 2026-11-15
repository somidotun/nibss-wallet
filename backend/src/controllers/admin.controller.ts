import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync.js";
import {
  AdminQuery,
  listUsers,
  getUserDetail,
  getUserWallet,
  setAccountFrozen,
  listTransactions,
  getStats,
  listPendingKyc,
  reviewUserKyc,
  getAuditLogs,
} from "../services/admin.service.js";

// typeof checks stop query tricks like ?status[$ne]=x
const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const num = (v: unknown) =>
  typeof v === "string" && v !== "" ? Number(v) : undefined;

const toQuery = (req: Request): AdminQuery => ({
  page: num(req.query.page),
  limit: num(req.query.limit),
  status: str(req.query.status),
  role: str(req.query.role),
  kycStatus: str(req.query.kycStatus),
  search: str(req.query.search),
  type: str(req.query.type),
  direction: str(req.query.direction),
  userId: str(req.query.userId),
  startDate: str(req.query.startDate),
  endDate: str(req.query.endDate),
  action: str(req.query.action),
});

export const users = catchAsync(async (req: Request, res: Response) => {
  res
    .status(200)
    .json({ status: "success", data: await listUsers(toQuery(req)) });
});

export const userDetail = catchAsync(async (req: Request, res: Response) => {
  res
    .status(200)
    .json({ status: "success", data: await getUserDetail(req.params.id as string) });
});

export const userWallet = catchAsync(async (req: Request, res: Response) => {
  const wallet = await getUserWallet(req.params.userId as string);
  res.status(200).json({ status: "success", data: { wallet } });
});

export const freeze = catchAsync(async (req: Request, res: Response) => {
  const user = await setAccountFrozen(
    req.user!.userId,
    req.params.id as string,
    true,
    req.body.reason,
  );
  res
    .status(200)
    .json({ status: "success", message: "Account frozen", data: { user } });
});

export const unfreeze = catchAsync(async (req: Request, res: Response) => {
  const user = await setAccountFrozen(
    req.user!.userId,
    req.params.id as string,
    false,
    req.body.reason,
  );
  res
    .status(200)
    .json({ status: "success", message: "Account unfrozen", data: { user } });
});

export const transactions = catchAsync(async (req: Request, res: Response) => {
  res
    .status(200)
    .json({ status: "success", data: await listTransactions(toQuery(req)) });
});

export const stats = catchAsync(async (_req: Request, res: Response) => {
  res
    .status(200)
    .json({ status: "success", data: { stats: await getStats() } });
});

export const pendingKyc = catchAsync(async (req: Request, res: Response) => {
  res
    .status(200)
    .json({ status: "success", data: await listPendingKyc(toQuery(req)) });
});

export const reviewKycRequest = catchAsync(
  async (req: Request, res: Response) => {
    const { decision, reason } = req.body;
    const user = await reviewUserKyc(
      req.user!.userId,
      req.params.id as string,
      decision,
      reason,
    );
    res.status(200).json({
      status: "success",
      message: decision === "approve" ? "KYC approved" : "KYC rejected",
      data: {
        kyc: {
          currentTier: user.kyc.currentTier,
          status: user.kyc.status,
          rejectionReason: user.kyc.rejectionReason,
        },
      },
    });
  },
);

export const auditLogs = catchAsync(async (req: Request, res: Response) => {
  res
    .status(200)
    .json({ status: "success", data: await getAuditLogs(toQuery(req)) });
});
