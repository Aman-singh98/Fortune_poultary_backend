import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import compression from "compression";
import rateLimit from "express-rate-limit";

import { notFound, errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/authRoutes.js";
import siteRoutes from "./routes/siteRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import wageMasterRoutes from "./routes/wageMasterRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import salaryRoutes from "./routes/salaryRoutes.js";
import leaveRoutes from "./routes/leaveRoutes.js";
import holidayRoutes from "./routes/holidayRoutes.js";
import itemRoutes from "./routes/itemRoutes.js";
import vendorRoutes from "./routes/vendorRoutes.js";
import itemRequirementRoutes from "./routes/itemRequirementRoutes.js";
import purchaseRequisitionRoutes from "./routes/purchaseRequisitionRoutes.js";
import rfqRoutes from "./routes/rfqRoutes.js";
import quotationRoutes from "./routes/quotationRoutes.js";
import purchaseOrderRoutes from "./routes/purchaseOrderRoutes.js";
import goodsReceiptRoutes from "./routes/goodsReceiptRoutes.js";
import billRoutes from "./routes/billRoutes.js";
import itemIssueRoutes from "./routes/itemIssueRoutes.js";
import stockRoutes from "./routes/stockRoutes.js";
import gatePassRoutes from "./routes/gatePassRoutes.js";
import salaryLedgerRoutes from "./routes/salaryLedgerRoutes.js";

const app = express();

// --- Security & core middleware ---
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
// 10mb accommodates the base64-encoded receipt/document photos attached to salary
// ledger entries (Daily Deduction / Advance / Fine / Travel) before they're
// forwarded to Cloudinary — see salaryLedgerRoutes / utils/documentStorage.js.
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// --- Rate limiting (general API limiter) ---
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", apiLimiter);

// --- Health check ---
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Fortune Poultry API is healthy",
    timestamp: new Date().toISOString(),
  });
});

// --- Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/sites", siteRoutes);
app.use("/api/users", userRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/wage-masters", wageMasterRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/salaries", salaryRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/holidays", holidayRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/item-requirements", itemRequirementRoutes);
app.use("/api/purchase-requisitions", purchaseRequisitionRoutes);
app.use("/api/rfqs", rfqRoutes);
app.use("/api/quotations", quotationRoutes);
app.use("/api/purchase-orders", purchaseOrderRoutes);
app.use("/api/goods-receipts", goodsReceiptRoutes);
app.use("/api/bills", billRoutes);
app.use("/api/item-issues", itemIssueRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/gate-passes", gatePassRoutes);
app.use("/api/salary-ledger", salaryLedgerRoutes);

// --- 404 + error handler (must be last) ---
app.use(notFound);
app.use(errorHandler);

export default app;
