import { Router } from "express";
import { verifyPayment } from "../controllers/funding.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import { referenceValidator } from "../middlewares/validators/funding.validator.js";

const router = Router();

router.get(
  "/verify/:reference",
  protect,
  referenceValidator,
  validate,
  verifyPayment,
);

export default router;
