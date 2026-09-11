import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import { listSites, getSite, createSite, updateSite } from "../controllers/siteController.js";

const router = Router();

router.use(protect);

router.get("/", listSites);
router.get("/:id", getSite);
router.post("/", authorize("SUPER_ADMIN"), createSite);
router.put("/:id", authorize("SUPER_ADMIN"), updateSite);

export default router;
