import { Router } from "express";
import { protect } from "../middleware/auth.js";
import {
  markAttendance,
  markAllPresent,
  listAttendance,
  attendanceSummary,
} from "../controllers/attendanceController.js";

const router = Router();

router.use(protect);

router.post("/mark", markAttendance);
router.post("/mark-all-present", markAllPresent);
router.get("/", listAttendance);
router.get("/summary", attendanceSummary);

export default router;
