import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
  createGoodsReceipt,
  verifyGoodsReceipt,
  listGoodsReceipts,
  getGoodsReceipt,
} from "../controllers/goodsReceiptController.js";

const router = Router();

router.use(protect);

router.get("/", listGoodsReceipts);
router.get("/:id", getGoodsReceipt);
router.post("/", authorize("SUPER_ADMIN", "STORE_KEEPER", "ACCOUNTS"), createGoodsReceipt);
router.patch("/:id/verify", authorize("SUPER_ADMIN", "STORE_KEEPER"), verifyGoodsReceipt);

export default router;
