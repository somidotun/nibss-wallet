import { Router } from "express";
import { param } from "express-validator";
import {
  getNotifications,
  markRead,
  markAllRead,
  remove,
} from "../controllers/notification.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";

const router = Router();

router.use(protect);

const idValidator = [
  param("id").isMongoId().withMessage("Invalid notification id"),
];

router.get("/", getNotifications);
router.patch("/read-all", markAllRead);
router.patch("/:id/read", idValidator, validate, markRead);
router.delete("/:id", idValidator, validate, remove);

export default router;
