import { Router } from "express";
import {
  status,
  insights,
  categorize,
  chat,
} from "../controllers/ai.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { aiLimiter } from "../middlewares/rateLimit.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import {
  insightsValidator,
  categorizeValidator,
  chatValidator,
} from "../middlewares/validators/ai.validator.js";

const router = Router();

router.use(protect, aiLimiter);

router.get("/status", status);
router.get("/insights", insightsValidator, validate, insights);
router.get("/categorize", categorizeValidator, validate, categorize);
router.post("/chat", chatValidator, validate, chat);

export default router;
