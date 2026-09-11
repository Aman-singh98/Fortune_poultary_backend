import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
  listWageMasters,
  createWageMaster,
  updateWageMaster,
  deleteWageMaster,
  manualOverride,
  applyIncrement,
} from "../controllers/wageMasterController.js";

const router = Router();

router.use(protect);

router.get("/", listWageMasters);
router.post("/", authorize("SUPER_ADMIN"), createWageMaster);
router.put("/:id", authorize("SUPER_ADMIN"), updateWageMaster);
router.delete("/:id", authorize("SUPER_ADMIN"), deleteWageMaster);
router.patch("/:id/manual-override", authorize("SUPER_ADMIN"), manualOverride);
router.patch("/:id/apply-increment", authorize("SUPER_ADMIN"), applyIncrement);

export default router;
