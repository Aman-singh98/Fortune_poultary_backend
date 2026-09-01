import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { listUsers } from "../controllers/userController.js";

const router = Router();

router.use(protect);

// Any authenticated user can browse the directory — it's used to pick an
// approver (e.g. Gate Pass "Approved By"); no sensitive fields are exposed.
router.get("/", listUsers);

export default router;
