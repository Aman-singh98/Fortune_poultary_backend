import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
  createLedgerEntry,
  listLedgerEntries,
  deleteLedgerEntry,
  getPendingSummary,
  getTravelRate,
  updateTravelRate,
} from "../controllers/salaryLedgerController.js";

const router = Router();

router.use(protect);

// Fixed sub-paths declared before the generic collection routes so "/travel-rate"
// and "/pending-summary" never get swallowed by an eventual "/:id" route.
router.get("/travel-rate", getTravelRate);
router.put("/travel-rate", authorize("SUPER_ADMIN"), updateTravelRate);
router.get("/pending-summary", getPendingSummary);

router.get("/", listLedgerEntries);
router.post("/", createLedgerEntry);
// Only Super Admin (any site) or Admin (their own site — enforced in the
// controller) can delete a ledger entry. Store Keepers and other roles that
// can view/add entries are not allowed to remove them.
router.delete("/:id", authorize("SUPER_ADMIN", "ADMIN"), deleteLedgerEntry);

export default router;
