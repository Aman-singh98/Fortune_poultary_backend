import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
  createQuotation,
  listQuotations,
  getQuotation,
  compareQuotations,
  decideQuotation,
} from "../controllers/quotationController.js";

const router = Router();

router.use(protect);

router.get("/", listQuotations);
router.get("/comparison/:rfqId", compareQuotations);
router.get("/:id", getQuotation);
router.post("/", authorize("SUPER_ADMIN", "PURCHASE_MANAGER"), createQuotation);
router.patch("/:id/decision", authorize("SUPER_ADMIN", "MANAGEMENT"), decideQuotation);

export default router;
