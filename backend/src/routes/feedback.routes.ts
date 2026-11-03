import { Router } from "express";
import {
  submit,
  listMine,
  listAll,
  update,
  remove,
} from "../controllers/feedback.controller.js";
import { protect, restrictTo } from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import {
  createFeedbackValidator,
  updateFeedbackValidator,
  feedbackIdValidator,
} from "../middlewares/validators/feedback.validator.js";

const router = Router();

router.use(protect);

// Any logged-in user
router.post("/", createFeedbackValidator, validate, submit);
router.get("/mine", listMine); // must come before '/:id'

// Admin only
router.get("/", restrictTo("admin"), listAll);
router.patch(
  "/:id",
  restrictTo("admin"),
  updateFeedbackValidator,
  validate,
  update,
);
router.delete(
  "/:id",
  restrictTo("admin"),
  feedbackIdValidator,
  validate,
  remove,
);

export default router;
