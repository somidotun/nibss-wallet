import { Router } from "express";
import { submit, getStatus } from "../controllers/kyc.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { submitKycValidator } from "../middlewares/validators/kyc.validator.js";
import validate from "../middlewares/validate.middleware.js";

const router = Router();

router.use(protect);

router.post("/submit", submitKycValidator, validate, submit);
router.get("/status", getStatus);

export default router;
