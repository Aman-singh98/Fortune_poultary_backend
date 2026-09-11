import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import { createBill, listBills, getBill, matchBill } from "../controllers/billController.js";

const router = Router();

router.use(protect);

router.get("/", listBills);
router.get("/:id", getBill);
router.post("/", authorize("SUPER_ADMIN", "ACCOUNTS"), createBill);
router.patch("/:id/match", authorize("SUPER_ADMIN", "ACCOUNTS"), matchBill);

export default router;
