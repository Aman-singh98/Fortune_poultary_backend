import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  updateEmployeeStatus,
  deleteEmployee,
} from "../controllers/employeeController.js";

const router = Router();

router.use(protect);

router.get("/", listEmployees);
router.get("/:id", getEmployee);
router.post("/", createEmployee);

// Editing, activating/deactivating, and deleting an employee is restricted to Super Admin.
router.put("/:id", authorize("SUPER_ADMIN"), updateEmployee);
router.patch("/:id/status", authorize("SUPER_ADMIN"), updateEmployeeStatus);
router.delete("/:id", authorize("SUPER_ADMIN"), deleteEmployee);

export default router;
