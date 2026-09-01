import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
  createVendor,
  listVendors,
  getVendor,
  updateVendor,
  toggleVendorActive,
} from "../controllers/vendorController.js";

const router = Router();

router.use(protect);

router.get("/", listVendors);
router.get("/:id", getVendor);
router.post("/", authorize("SUPER_ADMIN", "MANAGEMENT"), createVendor);
router.put("/:id", authorize("SUPER_ADMIN", "MANAGEMENT"), updateVendor);
router.patch("/:id/toggle-active", authorize("SUPER_ADMIN", "MANAGEMENT"), toggleVendorActive);

export default router;
