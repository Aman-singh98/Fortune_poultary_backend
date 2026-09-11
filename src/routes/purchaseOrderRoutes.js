import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
  createPurchaseOrder,
  listPurchaseOrders,
  getPurchaseOrder,
  closePurchaseOrder,
} from "../controllers/purchaseOrderController.js";

const router = Router();

router.use(protect);

router.get("/", listPurchaseOrders);
router.get("/:id", getPurchaseOrder);
router.post("/", authorize("SUPER_ADMIN", "ACCOUNTS"), createPurchaseOrder);
router.patch("/:id/close", authorize("SUPER_ADMIN", "ACCOUNTS"), closePurchaseOrder);

export default router;
