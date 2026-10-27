import { body } from "express-validator";

export const submitKycValidator = [
  body("nin")
    .trim()
    .notEmpty()
    .withMessage("NIN is required")
    .matches(/^\d{11}$/)
    .withMessage("NIN must be exactly 11 digits"),

  body("bvn")
    .trim()
    .notEmpty()
    .withMessage("BVN is required")
    .matches(/^\d{11}$/)
    .withMessage("BVN must be exactly 11 digits"),
];
