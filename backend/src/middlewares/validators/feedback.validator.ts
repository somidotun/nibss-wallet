import { body, param } from "express-validator";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
} from "../../types/feedback.types.js";

export const createFeedbackValidator = [
  body("category")
    .isIn([...FEEDBACK_CATEGORIES])
    .withMessage(`Category must be one of: ${FEEDBACK_CATEGORIES.join(", ")}`),

  body("message")
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage("Message must be between 10 and 1000 characters"),

  body("rating")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be a whole number from 1 to 5"),
];

export const updateFeedbackValidator = [
  param("id").isMongoId().withMessage("Invalid feedback id"),

  body("status")
    .optional()
    .isIn([...FEEDBACK_STATUSES])
    .withMessage(`Status must be one of: ${FEEDBACK_STATUSES.join(", ")}`),

  body("adminNote")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Admin note must not exceed 500 characters"),

  body().custom((_value, { req }) => {
    if (req.body.status === undefined && req.body.adminNote === undefined) {
      throw new Error("Provide a status or an adminNote");
    }
    return true;
  }),
];

export const feedbackIdValidator = [
  param("id").isMongoId().withMessage("Invalid feedback id"),
];
