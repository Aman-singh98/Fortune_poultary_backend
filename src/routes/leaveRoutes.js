import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import { createLeave, listLeaves, decideLeave } from "../controllers/leaveController.js";

const router = Router();

router.use(protect);

router.get("/", listLeaves);
router.post("/", createLeave);
router.patch("/:id/decision", authorize("SUPER_ADMIN"), decideLeave);

export default router;
