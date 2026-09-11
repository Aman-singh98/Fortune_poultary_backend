import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import { createItem, listItems, getItem, updateItem } from "../controllers/itemController.js";

const router = Router();

router.use(protect);

router.get("/", listItems);
router.get("/:id", getItem);
router.post("/", authorize("SUPER_ADMIN", "MANAGEMENT"), createItem);
router.put("/:id", authorize("SUPER_ADMIN", "MANAGEMENT"), updateItem);

export default router;
