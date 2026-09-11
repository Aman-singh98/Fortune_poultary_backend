// One-time (safe to re-run) seed script.
//
// Creates:
//  - 7 real business sites, 4 named Super Admins, the named Admin (Sumit),
//    7 per-site Admin logins, and the 11 client-approved/demo Holidays
//    (this is real/client data — see comments below).
//  - 11 demo records each for Wage Master, Employee, Attendance, Salary,
//    and Leave — deliberately varied so every enum/status/field variant in
//    each model is exercised at least once. These are clearly-marked sample
//    records for development/demo/testing, not client-confirmed data.
//  - Plus a small "today" batch (added 2026-08-27) of Attendance and Leave
//    records dated for the current day, so the dashboards have something
//    fresh to show without waiting on real daily marking.
//
// Usage:  npm run seed   (from /backend, after configuring .env)

import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import { generateSequentialId } from "./utils/generateId.js";
import Site from "./models/Site.js";
import User from "./models/User.js";
import Holiday from "./models/Holiday.js";
import WageMaster from "./models/WageMaster.js";
import Employee from "./models/Employee.js";
import Attendance from "./models/Attendance.js";
import Salary from "./models/Salary.js";
import Leave from "./models/Leave.js";
import Item from "./models/Item.js";
import Vendor from "./models/Vendor.js";
import Stock from "./models/Stock.js";
import ItemRequirement from "./models/ItemRequirement.js";
import PurchaseRequisition from "./models/PurchaseRequisition.js";
import Rfq from "./models/Rfq.js";
import Quotation from "./models/Quotation.js";
import PurchaseOrder from "./models/PurchaseOrder.js";
import GoodsReceipt from "./models/GoodsReceipt.js";
import Bill from "./models/Bill.js";
import ItemIssueSlip from "./models/ItemIssueSlip.js";
import GatePass from "./models/GatePass.js";
import { calculateLandedCost, flagLowestRate } from "./services/landedCostService.js";

const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || "Fortune@123";

// ---------------------------------------------------------------------------
// 1. SITES — client-confirmed list of 7 sites (Aug 2026 update — replaces the
//    earlier generic Site A/B/C/D placeholders).
// ---------------------------------------------------------------------------
const SITES = [
  { name: "Fortune Poultry Feeds", code: "FPF" },
  { name: "Fortune Layer Farm", code: "FLF" },
  { name: "Hisar Hatchery Nalwa", code: "HHN" },
  { name: "Hisar Hatchery Kanwari", code: "HHK" },
  { name: "Hisar Integration", code: "HIN" },
  { name: "Depal Broiler Farm", code: "DBF" },
  { name: "Pinjokhara Layer Growing", code: "PLG" },
];

// ---------------------------------------------------------------------------
// 2. USERS — named client accounts.
// ---------------------------------------------------------------------------
const SUPER_ADMINS = [
  { name: "Dipender Sir", email: "dipender@fortunepoultry.com" },
  { name: "Parminder Sir", email: "parminder@fortunepoultry.com" },
  { name: "Satish Sir", email: "satish@fortunepoultry.com" },
  { name: "Nisha Chhabra", email: "nisha@fortunepoultry.com" },
];

// ---------------------------------------------------------------------------
// 3. HOLIDAYS — 11 total. The 9 approved dates are the client-signed FY
//    2026-2027 list for Fortune Poultry Feeds (Janmashtami corrected from the
//    crossed-out 25th August to 4th September per the signed sheet). The
//    remaining 2 are demo records showing a Pending and a Rejected holiday,
//    so every status the Holidays screen can show is represented.
// ---------------------------------------------------------------------------
const HOLIDAYS = [
  { name: "Independence Day", date: "2026-08-15", status: "APPROVED", siteCodes: ["FPF"] },
  { name: "Janmashtami", date: "2026-09-04", status: "APPROVED", siteCodes: ["FPF"] },
  { name: "Raksha Bandhan", date: "2026-08-28", status: "APPROVED", siteCodes: ["FPF"] },
  { name: "Dusshera", date: "2026-10-20", status: "APPROVED", siteCodes: ["FPF"] },
  { name: "Deepawali", date: "2026-11-08", status: "APPROVED", siteCodes: ["FPF"] },
  { name: "Makar Sakranti", date: "2027-01-14", status: "APPROVED", siteCodes: ["FPF"] },
  { name: "Republic Day", date: "2027-01-26", status: "APPROVED", siteCodes: ["FPF"] },
  { name: "Mahashivratri", date: "2027-03-06", status: "APPROVED", siteCodes: ["FPF"] },
  { name: "Holi", date: "2027-03-22", status: "APPROVED", siteCodes: ["FPF"] },
  // Demo — still awaiting a Super Admin decision:
  {
    name: "Christmas",
    date: "2026-12-25",
    status: "PENDING",
    siteCodes: [],
    proposedByEmail: "sumit@fortunepoultry.com",
  },
  // Demo — proposed, then declined:
  {
    name: "Guru Nanak Jayanti",
    date: "2026-11-24",
    status: "REJECTED",
    siteCodes: [],
    proposedByEmail: "admin.flf@fortunepoultry.com",
    decidedByEmail: "nisha@fortunepoultry.com",
  },
];

// ---------------------------------------------------------------------------
// 4. WAGE MASTERS — 11 demo records covering every `appliesTo` category
//    (Permanent, Construction Labour, Painter, Maintenance, Electrician),
//    a site-specific rate, an egg/bird commission rate, a manual-override
//    rate history entry, an inactive/deprecated record, and a zero-overtime
//    record.
// ---------------------------------------------------------------------------
const WAGE_MASTERS = [
  { key: "WM_PERM_A", name: "Wages A - Permanent Staff", appliesTo: "PERMANENT", dayRate: 600, overtimeRatePerHour: 50, yearlyIncrementPercent: 5 },
  { key: "WM_CONST_A", name: "Wages B - Construction Labour", appliesTo: "CONSTRUCTION_LABOUR", dayRate: 450, overtimeRatePerHour: 40, yearlyIncrementPercent: 4 },
  { key: "WM_PAINT_A", name: "Wages C - Painter", appliesTo: "PAINTER", dayRate: 500, overtimeRatePerHour: 45, yearlyIncrementPercent: 4 },
  { key: "WM_MAINT_A", name: "Wages D - Maintenance", appliesTo: "MAINTENANCE", dayRate: 480, overtimeRatePerHour: 42, yearlyIncrementPercent: 4 },
  { key: "WM_ELEC_A", name: "Wages E - Electrician", appliesTo: "ELECTRICIAN", dayRate: 550, overtimeRatePerHour: 50, yearlyIncrementPercent: 5 },
  // Site-specific variants (site is set instead of applying across all sites):
  { key: "WM_PERM_FPF", name: "Wages A2 - Permanent (Fortune Poultry Feeds)", appliesTo: "PERMANENT", dayRate: 650, overtimeRatePerHour: 55, yearlyIncrementPercent: 6, siteCode: "FPF" },
  { key: "WM_CONST_FLF", name: "Wages B2 - Construction Labour (Fortune Layer Farm)", appliesTo: "CONSTRUCTION_LABOUR", dayRate: 430, overtimeRatePerHour: 38, yearlyIncrementPercent: 3, siteCode: "FLF" },
  // Egg/Bird sales commission variant:
  { key: "WM_EGGBIRD", name: "Wages F - Egg & Bird Incentive (Layer Farm)", appliesTo: "PERMANENT", dayRate: 600, overtimeRatePerHour: 50, yearlyIncrementPercent: 5, eggCommissionRate: 2, birdCommissionRate: 15, siteCode: "FLF" },
  // Rate-history / manual-override variant:
  {
    key: "WM_HISTORY", name: "Wages G - Construction Labour (rate revised)", appliesTo: "CONSTRUCTION_LABOUR", dayRate: 470, overtimeRatePerHour: 40, yearlyIncrementPercent: 4,
    rateHistory: [{ oldRate: 450, newRate: 470, reason: "Cost-of-living adjustment approved by Super Admin", changedByEmail: "dipender@fortunepoultry.com" }],
  },
  // Inactive/deprecated variant:
  { key: "WM_INACTIVE", name: "Wages H - Painter (deprecated)", appliesTo: "PAINTER", dayRate: 480, overtimeRatePerHour: 40, yearlyIncrementPercent: 0, isActive: false },
  // Zero-overtime variant:
  { key: "WM_NO_OT", name: "Wages I - Maintenance (no overtime)", appliesTo: "MAINTENANCE", dayRate: 500, overtimeRatePerHour: 0, yearlyIncrementPercent: 3 },
];

// ---------------------------------------------------------------------------
// 5. EMPLOYEES — 11 demo records spanning all 7 sites, both employee types,
//    every Wages sub-category, an inactive Permanent employee, an inactive
//    Wages employee, one with a photo, and one with its own rate-history
//    entry. A Wage Master is now mandatory on every employee (enforced at
//    creation time so salary can always be calculated), so every record
//    below is seeded with one.
// ---------------------------------------------------------------------------
const EMPLOYEES = [
  { key: "EMP1", labourId: "LB1001", name: "Rajesh Kumar", phone: "9812300001", siteCode: "FPF", employeeType: "PERMANENT", wageMasterKey: "WM_PERM_A", photoUrl: "https://i.pravatar.cc/150?img=12", designation: "Farm Manager", basicSalary: 25000, allSites: true, remarks: "Oversees operations across all sites" },
  { key: "EMP2", labourId: "LB1002", name: "Sunita Devi", phone: "9812300002", siteCode: "FPF", employeeType: "PERMANENT", wageMasterKey: "WM_PERM_FPF", isActive: false },
  { key: "EMP3", labourId: "LB1003", name: "Mahender Singh", phone: "9812300003", siteCode: "FLF", employeeType: "WAGES", wagesSubCategory: "CONSTRUCTION_LABOUR", wageMasterKey: "WM_CONST_A" },
  { key: "EMP4", labourId: "LB1004", name: "Vikram Chauhan", phone: "9812300004", siteCode: "FLF", employeeType: "WAGES", wagesSubCategory: "CONSTRUCTION_LABOUR", wageMasterKey: "WM_CONST_FLF" },
  { key: "EMP5", labourId: "LB1005", name: "Ramesh Lal", phone: "9812300005", siteCode: "HHN", employeeType: "WAGES", wagesSubCategory: "PAINTER", wageMasterKey: "WM_PAINT_A" },
  { key: "EMP6", labourId: "LB1006", name: "Suresh Yadav", phone: "9812300006", siteCode: "HHK", employeeType: "WAGES", wagesSubCategory: "MAINTENANCE", wageMasterKey: "WM_MAINT_A" },
  { key: "EMP7", labourId: "LB1007", name: "Anil Kumar", phone: "9812300007", siteCode: "HIN", employeeType: "WAGES", wagesSubCategory: "ELECTRICIAN", wageMasterKey: "WM_ELEC_A" },
  { key: "EMP8", labourId: "LB1008", name: "Deepak Malik", phone: "9812300008", siteCode: "DBF", employeeType: "WAGES", wagesSubCategory: "ELECTRICIAN", wageMasterKey: "WM_ELEC_A", isActive: false },
  { key: "EMP9", labourId: "LB1009", name: "Pooja Rani", phone: "9812300009", siteCode: "FLF", employeeType: "PERMANENT", wageMasterKey: "WM_EGGBIRD" },
  {
    key: "EMP10", labourId: "LB1010", name: "Naresh Kaushik", phone: "9812300010", siteCode: "PLG", employeeType: "WAGES", wagesSubCategory: "CONSTRUCTION_LABOUR", wageMasterKey: "WM_HISTORY",
    rateHistory: [{ oldRate: 450, newRate: 470, reason: "Manual override - performance-based increase", changedByEmail: "parminder@fortunepoultry.com" }],
  },
  { key: "EMP11", labourId: "LB1011", name: "Sandeep Sharma", phone: "9812300011", siteCode: "FPF", employeeType: "WAGES", wagesSubCategory: "PAINTER", wageMasterKey: "WM_PAINT_A" },
];

// ---------------------------------------------------------------------------
// 6. ATTENDANCE — 11 demo records, one for every status the app supports
//    (Present, Absent, Half-day, Overtime, Present x2, Present/Half, Leave,
//    Sunday, Holiday), plus an egg/bird sales entry and a remarks entry.
//
//    Plus a "today" batch (2026-08-27) added after the fact, covering the
//    9 active employees so the live dashboard has today's marking for
//    every site rather than only the historical demo dates above.
// ---------------------------------------------------------------------------
const ATTENDANCE = [
  { employeeKey: "EMP1", date: "2026-08-24", status: "PRESENT", markedByEmail: "sumit@fortunepoultry.com" },
  { employeeKey: "EMP1", date: "2026-08-15", status: "HOLIDAY", markedByEmail: "sumit@fortunepoultry.com" },
  { employeeKey: "EMP3", date: "2026-08-24", status: "ABSENT", markedByEmail: "admin.flf@fortunepoultry.com" },
  { employeeKey: "EMP3", date: "2026-08-23", status: "SUNDAY", markedByEmail: "admin.flf@fortunepoultry.com" },
  { employeeKey: "EMP4", date: "2026-08-24", status: "HALF_DAY", markedByEmail: "admin.flf@fortunepoultry.com" },
  { employeeKey: "EMP5", date: "2026-08-24", status: "PRESENT_X2", markedByEmail: "admin.hhn@fortunepoultry.com" },
  { employeeKey: "EMP6", date: "2026-08-24", status: "PRESENT_HALF", markedByEmail: "admin.hhk@fortunepoultry.com" },
  { employeeKey: "EMP7", date: "2026-08-24", status: "OVERTIME", overtimeHours: 3, markedByEmail: "admin.hin@fortunepoultry.com" },
  { employeeKey: "EMP9", date: "2026-08-24", status: "PRESENT", eggsSold: 120, birdsSold: 15, markedByEmail: "admin.flf@fortunepoultry.com" },
  { employeeKey: "EMP10", date: "2026-08-24", status: "LEAVE", markedByEmail: "admin.plg@fortunepoultry.com" },
  { employeeKey: "EMP11", date: "2026-08-24", status: "PRESENT", remarks: "Reported 30 minutes late due to transport delay", markedByEmail: "sumit@fortunepoultry.com" },

  // --- Today (2026-08-27) ---
  { employeeKey: "EMP1", date: "2026-08-27", status: "PRESENT", markedByEmail: "sumit@fortunepoultry.com" },
  { employeeKey: "EMP3", date: "2026-08-27", status: "PRESENT", markedByEmail: "admin.flf@fortunepoultry.com" },
  { employeeKey: "EMP4", date: "2026-08-27", status: "PRESENT", markedByEmail: "admin.flf@fortunepoultry.com" },
  { employeeKey: "EMP5", date: "2026-08-27", status: "ABSENT", markedByEmail: "admin.hhn@fortunepoultry.com" },
  { employeeKey: "EMP6", date: "2026-08-27", status: "HALF_DAY", markedByEmail: "admin.hhk@fortunepoultry.com" },
  { employeeKey: "EMP7", date: "2026-08-27", status: "OVERTIME", overtimeHours: 2, markedByEmail: "admin.hin@fortunepoultry.com" },
  { employeeKey: "EMP9", date: "2026-08-27", status: "PRESENT", eggsSold: 100, birdsSold: 10, markedByEmail: "admin.flf@fortunepoultry.com" },
  { employeeKey: "EMP10", date: "2026-08-27", status: "PRESENT", markedByEmail: "admin.plg@fortunepoultry.com" },
  { employeeKey: "EMP11", date: "2026-08-27", status: "LEAVE", markedByEmail: "sumit@fortunepoultry.com" },
];

// ---------------------------------------------------------------------------
// 7. SALARY — 11 demo records covering a clean no-deduction case, each
//    deduction type (Advance / Fine-fixed / Fine-percentage / Expense),
//    multiple deductions on one salary, sales commission earnings, a
//    holiday-days case, a leave-days case, an incentive/bonus case, an
//    expense-reimbursement case, a combined incentive+deduction case, and
//    the same employee across two different pay cycles (month-to-month
//    history).
// ---------------------------------------------------------------------------
const SALARIES = [
  {
    employeeKey: "EMP1", month: 8, year: 2026,
    earnings: { baseWage: 15600, overtimePay: 0, salesCommission: 0 }, grossEarning: 15600, netSalary: 15600,
    attendanceSummary: { presentDays: 26, absentDays: 0, overtimeHours: 0 },
    deductions: [],
  },
  {
    employeeKey: "EMP3", month: 8, year: 2026,
    earnings: { baseWage: 11700, overtimePay: 0, salesCommission: 0 }, grossEarning: 11700, netSalary: 9700,
    attendanceSummary: { presentDays: 24, absentDays: 2, overtimeHours: 0 },
    deductions: [{ type: "ADVANCE", amount: 2000, isPercentage: false, remark: "Advance for medical emergency" }],
  },
  {
    employeeKey: "EMP4", month: 8, year: 2026,
    earnings: { baseWage: 11180, overtimePay: 0, salesCommission: 0 }, grossEarning: 11180, netSalary: 10680,
    attendanceSummary: { presentDays: 25, halfDays: 1, overtimeHours: 0 },
    deductions: [{ type: "FINE", amount: 500, isPercentage: false, remark: "Damaged company tool" }],
  },
  {
    employeeKey: "EMP5", month: 8, year: 2026,
    earnings: { baseWage: 13000, overtimePay: 0, salesCommission: 0 }, grossEarning: 13000, netSalary: 12350,
    attendanceSummary: { presentDays: 26, overtimeHours: 0 },
    deductions: [{ type: "FINE", amount: 5, isPercentage: true, remark: "Late arrival penalty - 5% of gross" }],
  },
  {
    employeeKey: "EMP6", month: 8, year: 2026,
    earnings: { baseWage: 12480, overtimePay: 0, salesCommission: 0 }, grossEarning: 12480, netSalary: 11980,
    attendanceSummary: { presentDays: 26, overtimeHours: 0 },
    deductions: [{ type: "EXPENSE", amount: 500, isPercentage: false, remark: "Travel reimbursement adjustment" }],
  },
  {
    employeeKey: "EMP7", month: 8, year: 2026,
    earnings: { baseWage: 14300, overtimePay: 750, salesCommission: 0 }, grossEarning: 15050, netSalary: 13850,
    attendanceSummary: { presentDays: 26, overtimeHours: 15 },
    incentives: [{ type: "EXPENSE", amount: 300, remark: "Reimbursement for fuel used on farm errand" }],
    deductions: [
      { type: "ADVANCE", amount: 1000, isPercentage: false, remark: "Advance towards festival expenses" },
      { type: "FINE", amount: 500, isPercentage: false, remark: "Missed safety briefing" },
    ],
  },
  {
    employeeKey: "EMP9", month: 8, year: 2026,
    earnings: { baseWage: 15600, overtimePay: 0, salesCommission: 465 }, grossEarning: 16065, netSalary: 17065,
    attendanceSummary: { presentDays: 26, overtimeHours: 0 },
    incentives: [{ type: "INCENTIVE", amount: 1000, remark: "Top performer bonus - August sales" }],
    deductions: [],
  },
  {
    employeeKey: "EMP1", month: 9, year: 2026,
    earnings: { baseWage: 16200, overtimePay: 0, salesCommission: 0 }, grossEarning: 16200, netSalary: 16200,
    attendanceSummary: { presentDays: 26, holidayDays: 1, overtimeHours: 0 },
    deductions: [],
  },
  {
    employeeKey: "EMP10", month: 8, year: 2026,
    earnings: { baseWage: 10340, overtimePay: 0, salesCommission: 0 }, grossEarning: 10340, netSalary: 10340,
    attendanceSummary: { presentDays: 22, leaveDays: 2, overtimeHours: 0 },
    deductions: [],
  },
  {
    employeeKey: "EMP11", month: 8, year: 2026,
    earnings: { baseWage: 13000, overtimePay: 0, salesCommission: 0 }, grossEarning: 13000, netSalary: 12700,
    attendanceSummary: { presentDays: 26, overtimeHours: 0 },
    deductions: [{ type: "EXPENSE", amount: 300, isPercentage: false, remark: "Uniform replacement cost" }],
  },
  {
    employeeKey: "EMP3", month: 7, year: 2026,
    earnings: { baseWage: 12150, overtimePay: 0, salesCommission: 0 }, grossEarning: 12150, netSalary: 11542.5,
    attendanceSummary: { presentDays: 27, overtimeHours: 0 },
    deductions: [{ type: "FINE", amount: 5, isPercentage: true, remark: "Late arrival penalty - 5% of gross" }],
  },
];

// ---------------------------------------------------------------------------
// 8. LEAVE — 11 demo records covering Pending, Approved, and Rejected,
//    single-day and multi-day ranges, an empty decision remark, a request
//    that spans an already-approved holiday, and the same employee across
//    two different months.
//
//    Plus 2 "today" records (added 2026-08-27): one approved same-day leave
//    that matches today's Attendance "LEAVE" entry, and one pending
//    near-term request, so the Leave screen has fresh activity too.
// ---------------------------------------------------------------------------
const LEAVES = [
  { employeeKey: "EMP3", month: 8, year: 2026, fromDate: "2026-08-10", toDate: "2026-08-10", reason: "Family function", status: "PENDING", requestedByEmail: "admin.flf@fortunepoultry.com" },
  { employeeKey: "EMP4", month: 8, year: 2026, fromDate: "2026-08-05", toDate: "2026-08-07", reason: "Attending sister's wedding", status: "APPROVED", requestedByEmail: "admin.flf@fortunepoultry.com", decidedByEmail: "dipender@fortunepoultry.com", decisionRemark: "Approved - family function" },
  { employeeKey: "EMP5", month: 8, year: 2026, fromDate: "2026-08-12", toDate: "2026-08-12", reason: "Personal work", status: "REJECTED", requestedByEmail: "admin.hhn@fortunepoultry.com", decidedByEmail: "nisha@fortunepoultry.com", decisionRemark: "Insufficient staffing that week" },
  { employeeKey: "EMP6", month: 8, year: 2026, fromDate: "2026-08-18", toDate: "2026-08-19", reason: "Personal work", status: "PENDING", requestedByEmail: "admin.hhk@fortunepoultry.com" },
  { employeeKey: "EMP7", month: 8, year: 2026, fromDate: "2026-08-20", toDate: "2026-08-22", reason: "Family emergency", status: "APPROVED", requestedByEmail: "admin.hin@fortunepoultry.com", decidedByEmail: "satish@fortunepoultry.com", decisionRemark: "Approved" },
  { employeeKey: "EMP9", month: 8, year: 2026, fromDate: "2026-08-14", toDate: "2026-08-14", reason: "Not feeling well", status: "REJECTED", requestedByEmail: "admin.flf@fortunepoultry.com", decidedByEmail: "satish@fortunepoultry.com", decisionRemark: "" },
  { employeeKey: "EMP10", month: 8, year: 2026, fromDate: "2026-08-24", toDate: "2026-08-25", reason: "Attending a relative's function", status: "APPROVED", requestedByEmail: "admin.plg@fortunepoultry.com", decidedByEmail: "parminder@fortunepoultry.com", decisionRemark: "Approved, matches attendance record for 24 Aug" },
  { employeeKey: "EMP1", month: 9, year: 2026, fromDate: "2026-09-02", toDate: "2026-09-02", reason: "Doctor's appointment", status: "PENDING", requestedByEmail: "sumit@fortunepoultry.com" },
  { employeeKey: "EMP11", month: 8, year: 2026, fromDate: "2026-08-28", toDate: "2026-08-28", reason: "Family event (Raksha Bandhan)", status: "APPROVED", requestedByEmail: "sumit@fortunepoultry.com", decidedByEmail: "dipender@fortunepoultry.com", decisionRemark: "Approved - overlaps an already-approved holiday" },
  { employeeKey: "EMP3", month: 9, year: 2026, fromDate: "2026-09-10", toDate: "2026-09-12", reason: "Attending a relative's wedding out of town", status: "PENDING", requestedByEmail: "admin.flf@fortunepoultry.com" },
  { employeeKey: "EMP4", month: 8, year: 2026, fromDate: "2026-08-01", toDate: "2026-08-05", reason: "Travelling to native village for a family land dispute that needed my presence in person", status: "APPROVED", requestedByEmail: "admin.flf@fortunepoultry.com", decidedByEmail: "nisha@fortunepoultry.com", decisionRemark: "Approved after discussion with site admin" },

  // --- Today (2026-08-27) ---
  { employeeKey: "EMP11", month: 8, year: 2026, fromDate: "2026-08-27", toDate: "2026-08-27", reason: "Family matter", status: "APPROVED", requestedByEmail: "sumit@fortunepoultry.com", decidedByEmail: "dipender@fortunepoultry.com", decisionRemark: "Approved - matches today's attendance marking" },
  { employeeKey: "EMP6", month: 8, year: 2026, fromDate: "2026-08-29", toDate: "2026-08-30", reason: "Travelling to hometown", status: "PENDING", requestedByEmail: "admin.hhk@fortunepoultry.com" },
];

// ---------------------------------------------------------------------------
// 9. VENDORS — 3 demo vendor records for the Stock, Purchase & Inventory
//    module (dev/demo data, not client-confirmed — see Dev Task List Sec. 2.5).
// ---------------------------------------------------------------------------
const VENDORS = [
  {
    key: "VEN_GODREJ",
    name: "Godrej Agrovet Ltd.",
    contactPerson: "Rakesh Mehta",
    mobile: "9911100001",
    email: "sales@godrejagrovet.example.com",
    address: "Industrial Area, Hisar, Haryana",
    gstNumber: "06AAACG1234F1Z5",
    pan: "AAACG1234F",
    paymentTerms: "Net 30",
    creditDays: 30,
    category: "Feed & Nutrition",
  },
  {
    key: "VEN_VENKYS",
    name: "Venky's (India) Ltd.",
    contactPerson: "Suman Joshi",
    mobile: "9911100002",
    email: "procurement@venkys.example.com",
    address: "GT Road, Rohtak, Haryana",
    gstNumber: "06AABCV5678K1Z2",
    pan: "AABCV5678K",
    paymentTerms: "Net 15",
    creditDays: 15,
    category: "Medicine & Vaccines",
  },
  {
    key: "VEN_HISAR_PKG",
    name: "Hisar Packaging Solutions",
    contactPerson: "Deepak Bansal",
    mobile: "9911100003",
    email: "info@hisarpackaging.example.com",
    address: "Sector 14, Hisar, Haryana",
    gstNumber: "06AAGFH4321L1Z8",
    pan: "AAGFH4321L",
    paymentTerms: "Net 45",
    creditDays: 45,
    category: "Packaging",
    // Deliberately inactive — exercises the isActive toggle in the demo data.
    isActive: false,
  },
];

// ---------------------------------------------------------------------------
// 10. ITEMS — 6 demo item-master records, spanning feed, medicine, and
//     packaging categories, with a preferred vendor set and reorder levels
//     so the low-stock dashboard indicator has something to show (RA v1.0
//     OP-6). Dev/demo data, not client-confirmed.
// ---------------------------------------------------------------------------
const ITEMS = [
  { key: "ITM_FEED_BROILER", name: "Broiler Feed - Starter", category: "Feed", subCategory: "Broiler", unit: "Bag", minStockLevel: 50, reorderLevel: 100, maxStockLevel: 500, standardRate: 1450, gstPercent: 5, hsnCode: "2309", vendorKey: "VEN_GODREJ" },
  { key: "ITM_FEED_LAYER", name: "Layer Feed - Grower", category: "Feed", subCategory: "Layer", unit: "Bag", minStockLevel: 40, reorderLevel: 80, maxStockLevel: 400, standardRate: 1380, gstPercent: 5, hsnCode: "2309", vendorKey: "VEN_GODREJ" },
  { key: "ITM_VACCINE_ND", name: "Newcastle Disease Vaccine", category: "Medicine", subCategory: "Vaccine", unit: "Vial", minStockLevel: 20, reorderLevel: 50, maxStockLevel: 300, standardRate: 220, gstPercent: 12, hsnCode: "3002", vendorKey: "VEN_VENKYS" },
  { key: "ITM_ANTIBIOTIC", name: "Broad-Spectrum Antibiotic Powder", category: "Medicine", subCategory: "Antibiotic", unit: "Kg", minStockLevel: 10, reorderLevel: 25, maxStockLevel: 150, standardRate: 850, gstPercent: 12, hsnCode: "3004", vendorKey: "VEN_VENKYS" },
  { key: "ITM_EGG_TRAY", name: "Egg Tray - 30 Cell", category: "Packaging", subCategory: "Trays", unit: "Nos.", minStockLevel: 500, reorderLevel: 1000, maxStockLevel: 10000, standardRate: 6, gstPercent: 18, hsnCode: "4823", vendorKey: "VEN_HISAR_PKG" },
  // Deliberately below its own reorder level — exercises the low-stock dashboard widget once Stock is seeded.
  { key: "ITM_DISINFECTANT", name: "Poultry Shed Disinfectant", category: "Chemical", subCategory: "Sanitation", unit: "Ltr.", minStockLevel: 15, reorderLevel: 30, maxStockLevel: 200, standardRate: 310, gstPercent: 18, hsnCode: "3808", vendorKey: null },
];

// ---------------------------------------------------------------------------
// 11. PURCHASE-FLOW DEMO DATA — one or two records per new entity, walking
//     the full chain end-to-end (Dev Task List Sec. 2.5): an Item
//     Requirement already fulfilled from stock, a shortfall Requisition
//     that went through RFQ -> 3 competing Quotations -> Management
//     selection -> Purchase Order -> Goods Receipt (with a short receipt,
//     to exercise the mismatch path) -> Bill + 3-way match, plus an Item
//     Issue Slip and two Gate Passes (one open, one returned). Dev/demo
//     data, not client-confirmed — see Dev Task List Sec. 2.5.
// ---------------------------------------------------------------------------
async function seedPurchaseFlowDemoData({ sites, users, items, vendors }) {
  const fpf = sites["FPF"];
  const admin = users["admin.fpf@fortunepoultry.com"];
  const management = users["management@fortunepoultry.com"];
  const purchaseManager = users["purchase.manager@fortunepoultry.com"];
  const accounts = users["accounts@fortunepoultry.com"];
  const storeKeeper = users["storekeeper.fpf@fortunepoultry.com"];

  const broilerFeed = items["ITM_FEED_BROILER"];
  const vaccine = items["ITM_VACCINE_ND"];
  const disinfectant = items["ITM_DISINFECTANT"];

  // --- Stock — running balances (post-demo-history final state) ---
  console.log("\nStock (opening balances for the purchase-flow demo):");
  const stockDefs = [
    { item: broilerFeed, quantity: 150 }, // net of the Item Issue Slip below
    { item: disinfectant, quantity: 10 }, // deliberately below its reorderLevel (30) — feeds the low-stock widget
    { item: vaccine, quantity: 78 }, // net of the short Goods Receipt below
  ];
  for (const s of stockDefs) {
    const existing = await Stock.findOne({ item: s.item._id, site: fpf._id });
    if (existing) {
      console.log(`  - stock for ${s.item.name} already exists, skipping.`);
      continue;
    }
    await Stock.create({ item: s.item._id, site: fpf._id, quantity: s.quantity });
    console.log(`  - ${s.item.name}: ${s.quantity} ${s.item.unit}`);
  }

  // --- Item Requirement 1 — already fully issued from stock (Path A) ---
  console.log("\nItem Requirements:");
  let req1 = await ItemRequirement.findOne({ department: "Farm Operations", item: broilerFeed._id, site: fpf._id });
  if (!req1) {
    req1 = await ItemRequirement.create({
      department: "Farm Operations",
      item: broilerFeed._id,
      quantity: 150,
      site: fpf._id,
      requestedBy: admin._id,
      status: "FULFILLED",
      quantityIssued: 150,
    });
    console.log(`  - created requirement: 150 x ${broilerFeed.name} (Farm Operations) [FULFILLED]`);
  } else {
    console.log("  - Farm Operations requirement already exists, skipping.");
  }

  // --- Item Requirement 2 — not in stock, shortfall routed to Purchasing (Path B) ---
  let req2 = await ItemRequirement.findOne({ department: "Veterinary", item: vaccine._id, site: fpf._id });
  if (!req2) {
    req2 = await ItemRequirement.create({
      department: "Veterinary",
      item: vaccine._id,
      quantity: 80,
      site: fpf._id,
      requestedBy: admin._id,
      status: "PENDING",
      quantityIssued: 0,
    });
    console.log(`  - created requirement: 80 x ${vaccine.name} (Veterinary) [PENDING, no stock]`);
  } else {
    console.log("  - Veterinary requirement already exists, skipping.");
  }

  // --- Item Issue Slip — closes out Requirement 1 ---
  console.log("\nItem Issue Slip:");
  let issueSlip = await ItemIssueSlip.findOne({ requirementRef: req1._id });
  if (!issueSlip) {
    const issueSlipNumber = await generateSequentialId(ItemIssueSlip, "issueSlipNumber", "ISS", 1000);
    issueSlip = await ItemIssueSlip.create({
      issueSlipNumber,
      requirementRef: req1._id,
      item: broilerFeed._id,
      quantity: 150,
      site: fpf._id,
      issuedBy: admin._id,
      issuedTo: "Farm Operations",
    });
    console.log(`  - created issue slip ${issueSlip.issueSlipNumber} — 150 x ${broilerFeed.name}`);
  } else {
    console.log(`  - issue slip already exists (${issueSlip.issueSlipNumber}), skipping.`);
  }

  // --- Purchase Requisition 1 — shortfall from Requirement 2, Management-approved ---
  console.log("\nPurchase Requisitions:");
  let pr1 = await PurchaseRequisition.findOne({ requirement: req2._id });
  if (!pr1) {
    const prNumber = await generateSequentialId(PurchaseRequisition, "prNumber", "PR", 1000);
    pr1 = await PurchaseRequisition.create({
      prNumber,
      requirement: req2._id,
      department: "Veterinary",
      requestedBy: admin._id,
      site: fpf._id,
      item: vaccine._id,
      quantity: 80,
      requiredDate: new Date("2026-09-10"),
      purpose: "Shortfall against Item Requirement — Newcastle Disease vaccination schedule",
      priority: "HIGH",
      status: "APPROVED",
      decidedBy: management._id,
      decidedAt: new Date("2026-08-29"),
      decisionRemark: "Approved — urgent, vaccination schedule cannot slip.",
    });
    console.log(`  - created ${pr1.prNumber} — 80 x ${vaccine.name} [APPROVED]`);
  } else {
    console.log(`  - requisition for Requirement 2 already exists (${pr1.prNumber}), skipping.`);
  }

  // --- Purchase Requisition 2 — standalone, still awaiting Management's decision ---
  const eggTray = items["ITM_EGG_TRAY"];
  let pr2 = await PurchaseRequisition.findOne({ department: "Packaging", item: eggTray._id, requirement: null });
  if (!pr2) {
    const prNumber = await generateSequentialId(PurchaseRequisition, "prNumber", "PR", 1000);
    pr2 = await PurchaseRequisition.create({
      prNumber,
      requirement: null,
      department: "Packaging",
      requestedBy: admin._id,
      site: fpf._id,
      item: eggTray._id,
      quantity: 5000,
      requiredDate: new Date("2026-09-15"),
      purpose: "Restock ahead of festive-season egg demand",
      priority: "MEDIUM",
      status: "PENDING",
    });
    console.log(`  - created ${pr2.prNumber} — 5000 x ${eggTray.name} [PENDING, standalone]`);
  } else {
    console.log(`  - standalone Packaging requisition already exists (${pr2.prNumber}), skipping.`);
  }

  // --- RFQ — against the approved requisition (PR1) ---
  console.log("\nRFQ:");
  let rfq = await Rfq.findOne({ prRef: pr1._id });
  if (!rfq) {
    const rfqNumber = await generateSequentialId(Rfq, "rfqNumber", "RFQ", 1000);
    rfq = await Rfq.create({
      rfqNumber,
      prRef: pr1._id,
      vendor: vendors["VEN_VENKYS"]._id,
      items: [{ item: vaccine._id, quantity: 80 }],
      expectedDeliveryDate: new Date("2026-09-08"),
      quotationDueDate: new Date("2026-09-05"),
      termsAndConditions: "Cold-chain transport required; delivery to FPF main store.",
      status: "CLOSED",
      createdBy: purchaseManager._id,
    });
    console.log(`  - created ${rfq.rfqNumber} against ${pr1.prNumber}`);
  } else {
    console.log(`  - RFQ for ${pr1.prNumber} already exists (${rfq.rfqNumber}), skipping.`);
  }

  // --- Quotations — 3 competing vendors against the RFQ (minimum required to select) ---
  console.log("\nQuotations (3, satisfying the minimum-3-before-selection rule):");
  const quotationDefs = [
    { vendorKey: "VEN_VENKYS", rate: 210, gst: 2016, freight: 500, otherCharges: 200, discount: 100, paymentTerms: "Net 15", deliveryTime: "3 days" },
    { vendorKey: "VEN_GODREJ", rate: 225, gst: 2160, freight: 300, otherCharges: 150, discount: 50, paymentTerms: "Net 30", deliveryTime: "5 days" },
    { vendorKey: "VEN_HISAR_PKG", rate: 235, gst: 2256, freight: 400, otherCharges: 100, discount: 0, paymentTerms: "Net 45", deliveryTime: "4 days" },
  ];
  const quotations = [];
  for (const q of quotationDefs) {
    const vendorDoc = vendors[q.vendorKey];
    let quotation = await Quotation.findOne({ rfqRef: rfq._id, vendor: vendorDoc._id, item: vaccine._id });
    if (!quotation) {
      const finalLandedCost = calculateLandedCost({ rate: q.rate, quantity: 80, gst: q.gst, freight: q.freight, otherCharges: q.otherCharges, discount: q.discount });
      quotation = await Quotation.create({
        rfqRef: rfq._id,
        vendor: vendorDoc._id,
        item: vaccine._id,
        quantity: 80,
        rate: q.rate,
        gst: q.gst,
        freight: q.freight,
        otherCharges: q.otherCharges,
        discount: q.discount,
        finalLandedCost,
        paymentTerms: q.paymentTerms,
        deliveryTime: q.deliveryTime,
        qualitySpecification: "IS-standard cold-chain vaccine",
        createdBy: purchaseManager._id,
      });
      console.log(`  - ${vendorDoc.name}: landed cost ₹${finalLandedCost}`);
    } else {
      console.log(`  - quotation from ${vendorDoc.name} already exists, skipping.`);
    }
    quotations.push(quotation);
  }
  // Recompute the lowest-rate flag across all three, then have Management select the winner.
  flagLowestRate(quotations);
  await Promise.all(quotations.map((q) => q.save()));
  const winningQuotation = quotations.reduce((min, q) => (q.finalLandedCost < min.finalLandedCost ? q : min), quotations[0]);
  if (!winningQuotation.selected) {
    await Quotation.updateMany({ rfqRef: rfq._id, item: vaccine._id }, { $set: { selected: false } });
    winningQuotation.selected = true;
    winningQuotation.reasonForSelection = "Lowest landed cost among 3 quotations and fastest delivery time.";
    await winningQuotation.save();
    console.log(`  - Management selected ${winningQuotation.vendor} as the winning vendor.`);
  }

  // --- Purchase Order — built from the selected quotation ---
  console.log("\nPurchase Order:");
  let po = await PurchaseOrder.findOne({ quotationRef: winningQuotation._id });
  if (!po) {
    const totalAmount = calculateLandedCost({
      rate: winningQuotation.rate,
      quantity: winningQuotation.quantity,
      gst: winningQuotation.gst,
      freight: winningQuotation.freight,
      otherCharges: winningQuotation.otherCharges,
      discount: winningQuotation.discount,
    });
    const poNumber = await generateSequentialId(PurchaseOrder, "poNumber", "PO", 1000);
    po = await PurchaseOrder.create({
      poNumber,
      vendor: winningQuotation.vendor,
      prRef: pr1._id,
      quotationRef: winningQuotation._id,
      item: vaccine._id,
      quantity: winningQuotation.quantity,
      rate: winningQuotation.rate,
      discount: winningQuotation.discount,
      gst: winningQuotation.gst,
      hsnCode: vaccine.hsnCode,
      freight: winningQuotation.freight,
      otherCharges: winningQuotation.otherCharges,
      totalAmount,
      deliveryLocation: "Fortune Poultry Feeds — Main Store",
      deliveryDate: new Date("2026-09-08"),
      paymentTerms: winningQuotation.paymentTerms,
      specialInstructions: "Cold-chain required for vaccine transport.",
      status: "OPEN",
      createdBy: accounts._id,
    });
    console.log(`  - created ${po.poNumber} — 80 x ${vaccine.name}, total ₹${totalAmount}`);
  } else {
    console.log(`  - purchase order already exists (${po.poNumber}), skipping.`);
  }

  // --- Goods Receipt — a short receipt (78 accepted, 2 rejected of 80 ordered) ---
  console.log("\nGoods Receipt:");
  let grn = await GoodsReceipt.findOne({ poRef: po._id });
  if (!grn) {
    const grnNumber = await generateSequentialId(GoodsReceipt, "grnNumber", "GRN", 1000);
    grn = await GoodsReceipt.create({
      grnNumber,
      poRef: po._id,
      vendor: po.vendor,
      site: fpf._id,
      vehicleNumber: "HR37AB1234",
      invoiceNumber: "VNK/2026/4521",
      item: vaccine._id,
      orderedQuantity: po.quantity,
      receivedQuantity: 80,
      acceptedQuantity: 78,
      rejectedQuantity: 2,
      shortExcessQuantity: 0,
      batchLotNumber: "ND-VAC-0826",
      qualityStatus: "PASSED",
      storeLocation: "Cold Storage — Rack 3",
      verifiedBy: storeKeeper._id,
    });
    console.log(`  - created ${grn.grnNumber} — 78 accepted / 2 rejected of 80 ordered`);
  } else {
    console.log(`  - goods receipt already exists (${grn.grnNumber}), skipping.`);
  }

  // --- Bill — 3-way matched against the PO and the (short) GRN, demonstrating a MISMATCH ---
  console.log("\nBill:");
  let bill = await Bill.findOne({ poRef: po._id });
  if (!bill) {
    bill = await Bill.create({
      poRef: po._id,
      grnRef: grn._id,
      vendor: po.vendor,
      billNumber: "VNK-INV-88213",
      invoiceDate: new Date("2026-09-09"),
      irn: "",
      amount: po.totalAmount,
      matchStatus: "MISMATCH",
      matchNotes: `GRN accepted quantity (${grn.acceptedQuantity}) does not match PO quantity (${po.quantity}).`,
      recordedBy: accounts._id,
    });
    console.log(`  - created bill ${bill.billNumber} [MISMATCH — short receipt]`);
  } else {
    console.log("  - bill for this PO already exists, skipping.");
  }

  // --- Gate Passes — one still out, one returned ---
  console.log("\nGate Passes:");
  let gp1 = await GatePass.findOne({ materialName: "Feed Auger Motor", site: fpf._id });
  if (!gp1) {
    const gp1Number = await generateSequentialId(GatePass, "gatePassNumber", "GP", 1000);
    gp1 = await GatePass.create({
      gatePassNumber: gp1Number,
      dateTime: new Date("2026-08-30T10:00:00"),
      department: "Maintenance",
      partyOrVendorName: "Sharma Electricals (repair)",
      materialName: "Feed Auger Motor",
      quantity: 1,
      unit: "Nos.",
      purpose: "Sent for repair — burnt winding",
      returnExpectedDate: new Date("2026-09-05"),
      conditionAtDispatch: "Not working — burnt winding",
      site: fpf._id,
      sentBy: storeKeeper._id,
      approvedBy: admin._id,
      securityVerification: true,
      securityVerifiedBy: storeKeeper._id,
      securityVerifiedAt: new Date("2026-08-30T10:05:00"),
      materialReturned: false,
    });
    console.log(`  - created ${gp1.gatePassNumber} — Feed Auger Motor [still out]`);
  } else {
    console.log("  - Feed Auger Motor gate pass already exists, skipping.");
  }

  let gp2 = await GatePass.findOne({ materialName: "Weighing Scale - Platform", site: fpf._id });
  if (!gp2) {
    const gp2Number = await generateSequentialId(GatePass, "gatePassNumber", "GP", 1000);
    gp2 = await GatePass.create({
      gatePassNumber: gp2Number,
      dateTime: new Date("2026-08-20T09:00:00"),
      department: "Store",
      partyOrVendorName: "Precision Weights & Calibration Co.",
      materialName: "Weighing Scale - Platform",
      quantity: 1,
      unit: "Nos.",
      purpose: "Sent for calibration",
      returnExpectedDate: new Date("2026-08-22"),
      actualReturnDate: new Date("2026-08-22T16:00:00"),
      conditionAtDispatch: "Working, needs calibration",
      conditionAtReturn: "Calibrated and working",
      site: fpf._id,
      sentBy: admin._id,
      approvedBy: management._id,
      securityVerification: true,
      securityVerifiedBy: storeKeeper._id,
      securityVerifiedAt: new Date("2026-08-22T16:05:00"),
      materialReturned: true,
      returnQuantity: 1,
      receiverNameSignature: "Ramesh Kumar (Store Keeper)",
    });
    console.log(`  - created ${gp2.gatePassNumber} — Weighing Scale - Platform [returned]`);
  } else {
    console.log("  - Weighing Scale gate pass already exists, skipping.");
  }
}

// ---------------------------------------------------------------------------
// Upsert helpers — every one is safe to re-run without creating duplicates.
// ---------------------------------------------------------------------------

async function upsertSite(siteDef) {
  return Site.findOneAndUpdate(
    { name: siteDef.name },
    { $setOnInsert: { ...siteDef, isActive: true } },
    { new: true, upsert: true }
  );
}

async function upsertUser({ name, email, role, site = null, designation = null }) {
  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`  - ${email} already exists, skipping.`);
    return existing;
  }
  const user = await User.create({ name, email, password: DEFAULT_PASSWORD, role, site, designation });
  console.log(`  - created ${role} ${email}`);
  return user;
}

async function upsertHoliday(def, { sites, users }) {
  const existing = await Holiday.findOne({ name: def.name, date: new Date(def.date) });
  if (existing) {
    console.log(`  - ${def.name} (${def.date}) already exists, skipping.`);
    return existing;
  }
  const proposedBy = users[def.proposedByEmail || "sumit@fortunepoultry.com"];
  const decidedByEmail = def.decidedByEmail || (def.status === "APPROVED" ? "dipender@fortunepoultry.com" : null);
  const approvedBy = decidedByEmail ? users[decidedByEmail] : null;
  const holiday = await Holiday.create({
    name: def.name,
    date: new Date(def.date),
    status: def.status,
    sites: (def.siteCodes || []).map((code) => sites[code]._id),
    proposedBy: proposedBy._id,
    approvedBy: approvedBy ? approvedBy._id : null,
    decidedAt: def.status === "PENDING" ? null : new Date(),
  });
  console.log(`  - created holiday ${def.name} (${def.date}) [${def.status}]`);
  return holiday;
}

async function upsertWageMaster(def, { sites, users }) {
  const existing = await WageMaster.findOne({ name: def.name });
  if (existing) {
    console.log(`  - ${def.name} already exists, skipping.`);
    return existing;
  }
  const wm = await WageMaster.create({
    name: def.name,
    appliesTo: def.appliesTo,
    dayRate: def.dayRate,
    overtimeRatePerHour: def.overtimeRatePerHour ?? 0,
    yearlyIncrementPercent: def.yearlyIncrementPercent ?? 0,
    eggCommissionRate: def.eggCommissionRate ?? 0,
    birdCommissionRate: def.birdCommissionRate ?? 0,
    site: def.siteCode ? sites[def.siteCode]._id : null,
    isActive: def.isActive ?? true,
    rateHistory: (def.rateHistory || []).map((rh) => ({
      oldRate: rh.oldRate,
      newRate: rh.newRate,
      reason: rh.reason,
      changedBy: users[rh.changedByEmail]._id,
    })),
  });
  console.log(`  - created wage master ${def.name}`);
  return wm;
}

async function upsertEmployee(def, { sites, wageMasters, users }) {
  const existing = await Employee.findOne({ labourId: def.labourId });
  if (existing) {
    console.log(`  - ${def.labourId} (${def.name}) already exists, skipping.`);
    return existing;
  }
  const emp = await Employee.create({
    labourId: def.labourId,
    employeeCode: def.labourId.replace("LB", "EMP"),
    name: def.name,
    phone: def.phone,
    designation: def.designation || (def.employeeType === "PERMANENT" ? "Staff" : "Labour"),
    probationPeriod: def.probationPeriod ?? 0,
    remarks: def.remarks || "",
    site: sites[def.siteCode]._id,
    allSites: def.allSites || false,
    sites: (def.extraSiteCodes || []).map((code) => sites[code]._id),
    employeeType: def.employeeType,
    wagesSubCategory: def.wagesSubCategory || null,
    basicSalary: def.basicSalary || 0,
    wageMaster: def.wageMasterKey ? wageMasters[def.wageMasterKey]._id : null,
    isActive: def.isActive ?? true,
    photoUrl: def.photoUrl || null,
    rateHistory: (def.rateHistory || []).map((rh) => ({
      oldRate: rh.oldRate,
      newRate: rh.newRate,
      reason: rh.reason,
      changedBy: users[rh.changedByEmail]._id,
    })),
  });
  console.log(`  - created employee ${def.labourId} ${def.name}`);
  return emp;
}

async function upsertAttendance(def, { employees, users }) {
  const employee = employees[def.employeeKey];
  const date = new Date(def.date);
  const existing = await Attendance.findOne({ employee: employee._id, date });
  if (existing) {
    console.log(`  - attendance for ${def.employeeKey} on ${def.date} already exists, skipping.`);
    return existing;
  }
  const record = await Attendance.create({
    employee: employee._id,
    site: employee.site,
    date,
    status: def.status,
    overtimeHours: def.overtimeHours ?? 0,
    eggsSold: def.eggsSold ?? 0,
    birdsSold: def.birdsSold ?? 0,
    remarks: def.remarks || "",
    markedBy: users[def.markedByEmail]._id,
  });
  console.log(`  - created attendance ${def.employeeKey} ${def.date} [${def.status}]`);
  return record;
}

async function upsertSalary(def, { employees, users }) {
  const employee = employees[def.employeeKey];
  const existing = await Salary.findOne({ employee: employee._id, month: def.month, year: def.year });
  if (existing) {
    console.log(`  - salary for ${def.employeeKey} ${def.month}/${def.year} already exists, skipping.`);
    return existing;
  }
  const totalDeductions = (def.deductions || []).reduce(
    (sum, d) => sum + (d.isPercentage ? (def.grossEarning * d.amount) / 100 : d.amount),
    0
  );
  const totalIncentives = (def.incentives || []).reduce((sum, i) => sum + i.amount, 0);
  const record = await Salary.create({
    employee: employee._id,
    site: employee.site,
    month: def.month,
    year: def.year,
    earnings: def.earnings,
    grossEarning: def.grossEarning,
    incentives: (def.incentives || []).map((i) => ({ ...i, addedBy: users["dipender@fortunepoultry.com"]._id })),
    totalIncentives,
    deductions: (def.deductions || []).map((d) => ({ ...d, addedBy: users["dipender@fortunepoultry.com"]._id })),
    totalDeductions,
    netSalary: def.netSalary,
    attendanceSummary: def.attendanceSummary,
    generatedBy: users["dipender@fortunepoultry.com"]._id,
  });
  console.log(`  - created salary ${def.employeeKey} ${def.month}/${def.year}`);
  return record;
}

async function upsertVendor(def) {
  const existing = await Vendor.findOne({ name: def.name });
  if (existing) {
    console.log(`  - ${def.name} already exists, skipping.`);
    return existing;
  }
  const vendorCode = await generateSequentialId(Vendor, "vendorCode", "VEN", 1000);
  const { key, ...rest } = def;
  const vendor = await Vendor.create({ ...rest, vendorCode });
  console.log(`  - created vendor ${vendor.vendorCode} ${vendor.name}`);
  return vendor;
}

async function upsertItem(def, { vendors }) {
  const existing = await Item.findOne({ name: def.name });
  if (existing) {
    console.log(`  - ${def.name} already exists, skipping.`);
    return existing;
  }
  const itemCode = await generateSequentialId(Item, "itemCode", "ITM", 1000);
  const { key, vendorKey, ...rest } = def;
  const item = await Item.create({
    ...rest,
    itemCode,
    preferredVendor: vendorKey ? vendors[vendorKey]._id : null,
  });
  console.log(`  - created item ${item.itemCode} ${item.name}`);
  return item;
}

async function upsertLeave(def, { employees, users }) {
  const employee = employees[def.employeeKey];
  const fromDate = new Date(def.fromDate);
  const toDate = new Date(def.toDate);
  const existing = await Leave.findOne({ employee: employee._id, fromDate, toDate });
  if (existing) {
    console.log(`  - leave for ${def.employeeKey} ${def.fromDate}\u2192${def.toDate} already exists, skipping.`);
    return existing;
  }
  const decidedBy = def.decidedByEmail ? users[def.decidedByEmail] : null;
  const record = await Leave.create({
    employee: employee._id,
    site: employee.site,
    month: def.month,
    year: def.year,
    fromDate,
    toDate,
    reason: def.reason,
    status: def.status,
    requestedBy: users[def.requestedByEmail]._id,
    decidedBy: decidedBy ? decidedBy._id : null,
    decidedAt: def.status === "PENDING" ? null : new Date(),
    decisionRemark: def.decisionRemark,
  });
  console.log(`  - created leave ${def.employeeKey} ${def.fromDate}\u2192${def.toDate} [${def.status}]`);
  return record;
}

// ---------------------------------------------------------------------------

async function run() {
  await connectDB();
  console.log("Seeding Fortune Poultry data...\n");

  console.log("Sites:");
  const sites = {};
  for (const siteDef of SITES) {
    const site = await upsertSite(siteDef);
    sites[siteDef.code] = site;
    console.log(`  - ${site.name} (${site._id})`);
  }

  console.log("\nSuper Admins:");
  for (const sa of SUPER_ADMINS) {
    await upsertUser({ name: sa.name, email: sa.email, role: "SUPER_ADMIN" });
  }

  console.log("\nNamed Admin (HR Executive):");
  await upsertUser({
    name: "Sumit",
    email: "sumit@fortunepoultry.com",
    role: "ADMIN",
    designation: "HR Executive",
    site: sites["FPF"]._id,
  });

  console.log("\nPer-site Admin logins (for testing each site's scoped access):");
  for (const siteDef of SITES) {
    await upsertUser({
      name: `Admin - ${siteDef.name}`,
      email: `admin.${siteDef.code.toLowerCase()}@fortunepoultry.com`,
      role: "ADMIN",
      designation: `${siteDef.name} Admin`,
      site: sites[siteDef.code]._id,
    });
  }

  // ---------------------------------------------------------------------
  // Stock, Purchase & Inventory module — sample logins, one per new role
  // (demo/dev accounts, not client-confirmed names — see Dev Task List
  // Sec. 2.1). Management, Purchase Manager and Accounts are global roles
  // (no site); Store Keeper is site-scoped, seeded at Fortune Poultry Feeds.
  // ---------------------------------------------------------------------
  console.log("\nStock & Purchase module sample logins:");
  await upsertUser({
    name: "Management User",
    email: "management@fortunepoultry.com",
    role: "MANAGEMENT",
    designation: "Management",
  });
  await upsertUser({
    name: "Purchase Manager",
    email: "purchase.manager@fortunepoultry.com",
    role: "PURCHASE_MANAGER",
    designation: "Purchase Head",
  });
  await upsertUser({
    name: "Accounts User",
    email: "accounts@fortunepoultry.com",
    role: "ACCOUNTS",
    designation: "Accounts",
  });
  await upsertUser({
    name: "Store Keeper - Fortune Poultry Feeds",
    email: "storekeeper.fpf@fortunepoultry.com",
    role: "STORE_KEEPER",
    designation: "Store Keeper",
    site: sites["FPF"]._id,
  });

  // Build a lookup of every user by email now that they all exist.
  const allUsers = await User.find({});
  const users = Object.fromEntries(allUsers.map((u) => [u.email, u]));

  console.log("\nHolidays (11 — 9 client-approved for Fortune Poultry Feeds, 1 pending, 1 rejected):");
  for (const holidayDef of HOLIDAYS) {
    await upsertHoliday(holidayDef, { sites, users });
  }

  console.log("\nWage Masters (11 demo records — every category, a site-specific rate,");
  console.log("egg/bird commission, rate history, an inactive record, and zero-OT):");
  const wageMasters = {};
  for (const wmDef of WAGE_MASTERS) {
    wageMasters[wmDef.key] = await upsertWageMaster(wmDef, { sites, users });
  }

  console.log("\nEmployees (11 demo records across all 7 sites):");
  const employees = {};
  for (const empDef of EMPLOYEES) {
    employees[empDef.key] = await upsertEmployee(empDef, { sites, wageMasters, users });
  }

  console.log("\nAttendance (11 demo records + today's batch — every status the app supports):");
  for (const attDef of ATTENDANCE) {
    await upsertAttendance(attDef, { employees, users });
  }

  console.log("\nSalary (11 demo records — every deduction type, commission, holiday/leave days):");
  for (const salDef of SALARIES) {
    await upsertSalary(salDef, { employees, users });
  }

  console.log("\nLeave (11 demo records + today's batch — Pending, Approved, and Rejected, single & multi-day):");
  for (const leaveDef of LEAVES) {
    await upsertLeave(leaveDef, { employees, users });
  }

  console.log("\nVendors (3 demo records — one deliberately inactive):");
  const vendors = {};
  for (const vendorDef of VENDORS) {
    vendors[vendorDef.key] = await upsertVendor(vendorDef);
  }

  console.log("\nItems (6 demo item-master records across Feed/Medicine/Packaging/Chemical):");
  const items = {};
  for (const itemDef of ITEMS) {
    items[itemDef.key] = await upsertItem(itemDef, { vendors });
  }

  console.log("\nPurchase-flow demo data (Item Requirements -> Requisition -> RFQ ->");
  console.log("Quotations -> Purchase Order -> Goods Receipt -> Bill -> Gate Passes):");
  await seedPurchaseFlowDemoData({ sites, users, items, vendors });

  console.log(`\nDone. Default password for all seeded accounts: "${DEFAULT_PASSWORD}"`);
  console.log("(Ask users to change it after first login — no forced-reset flow is built yet.)");

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
