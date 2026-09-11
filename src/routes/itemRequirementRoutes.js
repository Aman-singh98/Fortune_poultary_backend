import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
  createItemRequirement,
  listItemRequirements,
  getItemRequirement,
  processItemRequirement,
} from "../controllers/itemRequirementController.js";

const router = Router();

router.use(protect);

router.get("/", listItemRequirements);
router.get("/:id", getItemRequirement);
router.post("/", authorize("SUPER_ADMIN", "ADMIN"), createItemRequirement);
router.post("/:id/process", authorize("SUPER_ADMIN", "ADMIN"), processItemRequirement);

export default router;
