import { Router } from "express";
import {
  getTransactions,
  getTransaction,
} from "../controllers/transaction.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(protect);

router.get("/", getTransactions);
router.get("/:id", getTransaction);

export default router;
