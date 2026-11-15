import { Router } from "express";
import * as admin from "../controllers/admin.controller.js";
import { protect, restrictTo } from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import {
  listUsersValidator,
  pagingValidator,
  userIdValidator,
  walletUserIdValidator,
  freezeValidator,
  unfreezeValidator,
  transactionsValidator,
  reviewKycValidator,
  auditLogsValidator,
} from "../middlewares/validators/admin.validator.js";

const router = Router();

// Every admin route needs a valid token AND the admin role
router.use(protect, restrictTo("admin"));

router.get("/users", listUsersValidator, validate, admin.users);
router.get("/users/:id", userIdValidator, validate, admin.userDetail);
router.patch("/users/:id/freeze", freezeValidator, validate, admin.freeze);
router.patch(
  "/users/:id/unfreeze",
  unfreezeValidator,
  validate,
  admin.unfreeze,
);

router.get(
  "/wallets/:userId",
  walletUserIdValidator,
  validate,
  admin.userWallet,
);
router.get(
  "/transactions",
  transactionsValidator,
  validate,
  admin.transactions,
);
router.get("/stats", admin.stats);

router.get("/kyc/pending", pagingValidator, validate, admin.pendingKyc);
router.patch("/kyc/:id", reviewKycValidator, validate, admin.reviewKycRequest);

router.get("/audit-logs", auditLogsValidator, validate, admin.auditLogs);

export default router;
