import { Router } from "express";
import { getMyWallet, getBalance } from "../controllers/wallet.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(protect);

router.get("/", getMyWallet);
router.get("/balance", getBalance);

export default router;
