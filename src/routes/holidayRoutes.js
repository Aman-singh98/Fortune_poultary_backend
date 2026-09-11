import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import { proposeHoliday, listHolidays, decideHoliday } from "../controllers/holidayController.js";

const router = Router();

router.use(protect);

router.get("/", listHolidays);
router.post("/", proposeHoliday);
router.patch("/:id/decision", authorize("SUPER_ADMIN"), decideHoliday);

export default router;
