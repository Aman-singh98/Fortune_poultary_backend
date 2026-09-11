import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { generateSalary, addDeduction, addIncentive, listSalaries } from "../controllers/salaryController.js";

const router = Router();

router.use(protect);

router.get("/", listSalaries);
router.post("/generate", generateSalary);
router.post("/:id/deduction", addDeduction);
router.post("/:id/incentive", addIncentive);

export default router;
