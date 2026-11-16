import { Router } from "express";
import {
  getMyWallet,
  getBalance,
  lookupAccount,
} from "../controllers/wallet.controller.js";
import {
  transfer,
  downloadReceipt,
} from "../controllers/transfer.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { transferValidator } from "../middlewares/validators/transfer.validator.js";
import validate from "../middlewares/validate.middleware.js";
import { transferLimiter } from "../middlewares/rateLimit.middleware.js";

const router = Router();

router.use(protect);
router.post(
  "/transfer",
  transferLimiter,
  transferValidator,
  validate,
  transfer,
);
router.get("/", getMyWallet);
router.get("/balance", getBalance);
router.post("/transfer", transferValidator, validate, transfer);
router.get("/transactions/:id/receipt", downloadReceipt);
router.get("/lookup/:accountNumber", lookupAccount);

export default router;
