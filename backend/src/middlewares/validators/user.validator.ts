import { body } from "express-validator";

export const updateProfileValidator = [
  body("firstName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("First name cannot be empty")
    .isLength({ max: 50 })
    .withMessage("First name must not exceed 50 characters")
    .matches(/^[a-zA-Z\s-]+$/)
    .withMessage("First name can only contain letters, spaces, and hyphens"),

  body("lastName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Last name cannot be empty")
    .isLength({ max: 50 })
    .withMessage("Last name must not exceed 50 characters")
    .matches(/^[a-zA-Z\s-]+$/)
    .withMessage("Last name can only contain letters, spaces, and hyphens"),

  body("phone")
    .optional()
    .trim()
    .matches(/^(\+234|0)[789][01]\d{8}$/)
    .withMessage("Please provide a valid Nigerian phone number"),
];

export const changePasswordValidator = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),

  body("newPassword")
    .notEmpty()
    .withMessage("New password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number")
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage("Password must contain at least one special character"),
];
