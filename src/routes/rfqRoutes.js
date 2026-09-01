import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import { createRfq, listRfqs, getRfq, closeRfq } from "../controllers/rfqController.js";

const router = Router();

router.use(protect);

router.get("/", listRfqs);
router.get("/:id", getRfq);
router.post("/", authorize("SUPER_ADMIN", "PURCHASE_MANAGER"), createRfq);
router.patch("/:id/close", authorize("SUPER_ADMIN", "PURCHASE_MANAGER"), closeRfq);

export default router;
