import { body, param } from "express-validator";

export const fundValidator = [
  body("amount")
    .isInt({ min: 100, max: 50000 })
    .withMessage("Amount must be a whole number between ₦100 and ₦50,000")
    .toInt(),
];

export const referenceValidator = [
  param("reference")
    .matches(/^FUND-[0-9A-F-]{36}$/)
    .withMessage("Invalid payment reference"),
];
