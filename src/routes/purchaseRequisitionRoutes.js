import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
  createPurchaseRequisition,
  listPurchaseRequisitions,
  getPurchaseRequisition,
  decidePurchaseRequisition,
} from "../controllers/purchaseRequisitionController.js";

const router = Router();

router.use(protect);

router.get("/", listPurchaseRequisitions);
router.get("/:id", getPurchaseRequisition);
router.post("/", authorize("SUPER_ADMIN", "ADMIN"), createPurchaseRequisition);
router.patch("/:id/decision", authorize("SUPER_ADMIN", "MANAGEMENT"), decidePurchaseRequisition);

export default router;
