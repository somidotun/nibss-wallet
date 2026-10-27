import { body } from "express-validator";

export const transferValidator = [
  body("accountNumber")
    .notEmpty()
    .withMessage("Account number is required")
    .isLength({ min: 10, max: 10 })
    .withMessage("Account number must be exactly 10 digits")
    .isNumeric()
    .withMessage("Account number must contain only numbers"),

  body("amount")
    .notEmpty()
    .withMessage("Amount is required")
    .isNumeric()
    .withMessage("Amount must be a number")
    .custom((value) => {
      if (value < 100) throw new Error("Minimum transfer amount is ₦100");
      if (value > 1000000)
        throw new Error("Maximum transfer amount is ₦1,000,000");
      return true;
    }),

  body("pin")
    .notEmpty()
    .withMessage("Transaction PIN is required")
    .isLength({ min: 4, max: 4 })
    .withMessage("PIN must be exactly 4 digits")
    .isNumeric()
    .withMessage("PIN must contain only numbers"),

  body("idempotencyKey").notEmpty().withMessage("Idempotency key is required"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Description must not exceed 100 characters"),
];
