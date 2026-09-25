import { Router } from "express";
import {
  getMe,
  updateMe,
  updatePassword,
} from "../controllers/user.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import {
  updateProfileValidator,
  changePasswordValidator,
} from "../middlewares/validators/user.validator.js";
import validate from "../middlewares/validate.middleware.js";

const router = Router();

// All routes require authentication
router.use(protect);

router.get("/me", getMe);
router.patch("/me", updateProfileValidator, validate, updateMe);
router.patch(
  "/me/change-password",
  changePasswordValidator,
  validate,
  updatePassword,
);

export default router;
