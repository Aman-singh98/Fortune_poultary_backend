import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import { createItemIssueSlip, listItemIssueSlips, getItemIssueSlip } from "../controllers/itemIssueController.js";

const router = Router();

router.use(protect);

router.get("/", listItemIssueSlips);
router.get("/:id", getItemIssueSlip);
router.post("/", authorize("SUPER_ADMIN", "ADMIN"), createItemIssueSlip);

export default router;
