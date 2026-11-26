import { body, query } from "express-validator";

export const insightsValidator = [
  query("days")
    .optional()
    .isInt({ min: 7, max: 90 })
    .withMessage("days must be 7 to 90"),
  query("narrate")
    .optional()
    .isBoolean()
    .withMessage("narrate must be true or false"),
];

export const categorizeValidator = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page must be 1 or more"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("limit must be 1 to 50"),
];

export const chatValidator = [
  body("message")
    .isString()
    .withMessage("Message must be text")
    .bail()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage("Message must be 1 to 500 characters"),
];
