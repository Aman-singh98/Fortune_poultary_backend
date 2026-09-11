import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
  createGatePass,
  listGatePasses,
  getGatePass,
  recordGatePassReturn,
} from "../controllers/gatePassController.js";

const router = Router();

router.use(protect);

router.get("/", listGatePasses);
router.get("/:id", getGatePass);
router.post("/", authorize("SUPER_ADMIN", "ADMIN", "STORE_KEEPER"), createGatePass);
router.patch("/:id/return", authorize("SUPER_ADMIN", "ADMIN", "STORE_KEEPER"), recordGatePassReturn);

export default router;
