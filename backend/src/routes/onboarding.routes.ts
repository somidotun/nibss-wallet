import { Router } from "express";
import { getStatus } from "../controllers/onboarding.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(protect);
router.get("/status", getStatus);

export default router;
