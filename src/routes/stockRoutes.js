import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { listStock, listLowStock } from "../controllers/stockController.js";

const router = Router();

router.use(protect);

// Read-only for every role — all roles can view running stock (RA v2.0 Sec. 8).
router.get("/low", listLowStock);
router.get("/", listStock);

export default router;
