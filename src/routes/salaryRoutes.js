import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { generateSalary, addDeduction, listSalaries } from "../controllers/salaryController.js";

const router = Router();

router.use(protect);

router.get("/", listSalaries);
router.post("/generate", generateSalary);
router.post("/:id/deduction", addDeduction);

export default router;
