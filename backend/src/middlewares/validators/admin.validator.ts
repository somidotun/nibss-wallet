import { body, param, query } from "express-validator";
import { AUDIT_ACTIONS } from "../../types/audit.types.js";

const paging = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page must be 1 or more"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("limit must be 1 to 50"),
];

const idParam = (name: string) =>
  param(name).isMongoId().withMessage(`Invalid ${name}`);

export const listUsersValidator = [
  ...paging,
  query("status").optional().isIn(["active", "suspended", "frozen"]),
  query("role").optional().isIn(["user", "admin"]),
  query("kycStatus")
    .optional()
    .isIn(["not_started", "pending", "verified", "rejected"]),
  query("search").optional().trim().isLength({ max: 50 }),
];

export const pagingValidator = paging;

export const userIdValidator = [idParam("id")];
export const walletUserIdValidator = [idParam("userId")];

export const freezeValidator = [
  idParam("id"),
  body("reason")
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage("A reason of 5 to 200 characters is required"),
];

export const unfreezeValidator = [
  idParam("id"),
  body("reason").optional().trim().isLength({ max: 200 }),
];

export const transactionsValidator = [
  ...paging,
  query("status").optional().isIn(["pending", "success", "failed"]),
  query("type").optional().isIn(["transfer", "reversal", "funding"]),
  query("direction").optional().isIn(["debit", "credit", "all"]),
  query("userId").optional().isMongoId().withMessage("Invalid userId"),
  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("startDate must be an ISO date"),
  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("endDate must be an ISO date"),
];

export const reviewKycValidator = [
  idParam("id"),
  body("decision")
    .isIn(["approve", "reject"])
    .withMessage("Decision must be approve or reject"),
  body("reason")
    .if(body("decision").equals("reject"))
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage("A rejection reason of 5 to 200 characters is required"),
];

export const auditLogsValidator = [
  ...paging,
  query("action")
    .optional()
    .isIn([...AUDIT_ACTIONS]),
];
