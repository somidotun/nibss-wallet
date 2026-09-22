import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";

const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    res.status(400).json({
      status: "error",
      message: "Validation failed",
      errors: errors.array().map((error) => ({
        field: error.type === "field" ? error.path : error.type,
        message: error.msg,
      })),
    });
    return;
  }

  next();
};

export default validate;
