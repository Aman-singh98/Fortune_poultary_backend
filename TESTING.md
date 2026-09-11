# A10 — Testing & Env Config

Covers the testing half of task A10 (Postman collection + manual smoke-test pass).
**Deployment is intentionally out of scope here** — see the note at the bottom.

## What's included

- `Fortune-Poultry.postman_collection.json` — every HR-module endpoint (auth, sites,
  employees, wage-masters, attendance, salaries, leaves, holidays), with example request
  bodies, a `{{baseUrl}}` / `{{token}}` variable setup, and a few intentional "should fail"
  requests (missing mandatory `reason`/`remark` fields, cross-site access as Admin, Admin
  attempting a SuperAdmin-only decision) so you can confirm the guardrails actually hold, not
  just the happy path. **Not included in this repository snapshot** — it was referenced by an
  earlier pass on task A10 but isn't present in this zip; the Stock, Purchase & Inventory
  module below is documented as example requests/responses in this file instead, per Dev Task
  List Sec. 2.5.
- Automated checks already run against this codebase in this session (no live MongoDB was
  available in this environment, so these stop short of a live end-to-end run — see below):
  - **Syntax-checked every backend source file** (`node --check`) — all clean.
  - **Loaded the full Express module graph** (`app.js` → all 20 routers → all 20 controllers →
    all 19 models → middleware → all 4 services) with no import/wiring errors — this now
    includes the Stock, Purchase & Inventory module routers added below, not just the
    original HR module.
  - **Frontend production build** (`npm run build`) — compiles clean, no errors.

## How to run the real smoke test (needs your own MongoDB)

1. `cd backend && cp .env.example .env` and fill in a real `MONGO_URI` (local `mongod` or an
   Atlas free-tier cluster both work) and a `JWT_SECRET`.
2. `npm install && npm run dev` — confirm you see
   `Fortune Poultry API running on http://localhost:5000` with no Mongo connection error.
3. `curl http://localhost:5000/api/health` — should return `200 OK`.
4. `npm run seed` — should upsert 7 sites + 12 users and print the login table; **safe to
   re-run**, confirm running it twice doesn't create duplicates (check user/site counts in
   Mongo Compass or `mongosh`).
5. Import `Fortune-Poultry.postman_collection.json` into Postman (or Thunder Client in
   VS Code). Set `baseUrl` to `http://localhost:5000/api` if different from the default.
6. Run **Auth → Login (Super Admin)** first — its test script saves `{{token}}`
   automatically. Run **Auth → Login (Admin A)** to populate `{{adminToken}}` for the
   negative-path checks.
7. Work through the folders top to bottom — **Sites → Employees → Wage Masters →
   Attendance → Salaries → Leaves → Holidays**. Several requests have test scripts that
   auto-capture IDs (`siteId`, `employeeId`, `wageMasterId`, `salaryId`, `leaveId`,
   `holidayId`) into collection variables, so later requests in the same folder resolve
   correctly without manual copy-pasting.

### Specifically confirm these behaviours (the ones called out in the requirement doc)

- [ ] `POST /api/employees` auto-generates a sequential `labourId` (`LB1001`, `LB1002`, ...).
- [ ] `POST /api/employees` as **Admin A**, targeting a different site's ID, returns
  **403** (site-scoping is enforced server-side, not just hidden in the UI).
- [ ] `PATCH /api/wage-masters/:id/manual-override` **without** a `reason` returns **400**.
- [ ] `POST /api/attendance/mark` called twice for the same employee+date **updates** the
  existing record rather than creating a duplicate (unique index working).
- [ ] `POST /api/salaries/generate` for an employee **without** a `wageMaster` assigned
  returns a clear 400, not a 500.
- [ ] Every `POST /api/salaries/:id/deduction` **without** a `remark` returns **400**.
- [ ] Every `POST /api/salaries/:id/incentive` **without** a `remark` returns **400**.
- [ ] Adding an incentive/expense entry increases `netSalary` by the entry amount (`netSalary = grossEarning + totalIncentives - totalDeductions`).
- [ ] `PATCH /api/leaves/:id/decision` as **Admin A** (not Super Admin) returns **403**.
- [ ] Approving a leave writes `LEAVE`-status attendance records for the date range
  automatically (check via `GET /api/attendance` after approval).
- [ ] `PATCH /api/holidays/:id/decision` with `decision: APPROVED` and **no `sites` array**
  returns 400 — holidays are never auto-applied to all 7 sites.
- [ ] Log in as each of the 9 seeded users at least once and confirm the JWT + `/api/auth/me`
  round-trip works and the role/site on the returned user matches expectations.

## Stock, Purchase & Inventory module — endpoints & example payloads

Covers the 10 routers added per the Dev Task List (Sec. 2.4): Item, Vendor, Item
Requirement, Purchase Requisition, RFQ, Quotation, Purchase Order, Goods Receipt,
Bill, Item Issue Slip, Stock, and Gate Pass. All endpoints require `Authorization:
Bearer {{token}}` like every other route in this API; role restrictions are noted
per endpoint. Log in as the matching seeded user (`management@fortunepoultry.com`,
`purchase.manager@fortunepoultry.com`, `accounts@fortunepoultry.com`,
`storekeeper.fpf@fortunepoultry.com`, or an FPF Admin) to exercise each step —
`npm run seed` creates one of each.

### Item & Vendor masters

```
POST /api/items                (Super Admin, Management)
{ "name": "Broiler Feed - Starter", "unit": "Kg", "reorderLevel": 200, "gstPercent": 5, "hsnCode": "2309" }
→ 201 { success: true, data: { itemCode: "ITM1007", ... } }

GET /api/items?lowStock=true   (any role) → positions at/below reorderLevel

POST /api/vendors              (Super Admin, Management)
{ "name": "Venky's India", "mobile": "9876543210", "gstNumber": "06ABCDE1234F1Z5" }
→ 201 { data: { vendorCode: "VEN1004", ... } }
```

### Requirement → Requisition → Approval

```
POST /api/item-requirements                    (Admin, own site only)
{ "department": "Veterinary", "item": "<itemId>", "quantity": 80, "site": "<own siteId>" }
→ 201 PENDING requirement

POST /api/item-requirements/:id/process         (Admin) — the availability check
→ 200 { path: "A"|"B" (mixed if partially covered), requirement, issueSlip, purchaseRequisition }

POST /api/purchase-requisitions                 (Admin, standalone PR)
GET  /api/purchase-requisitions?status=APPROVED (Purchase Manager — always forced to APPROVED-only server-side)
PATCH /api/purchase-requisitions/:id/decision   (Management only)
{ "decision": "APPROVED", "decisionRemark": "Urgent — vaccination schedule." }
```

### RFQ → Quotation → Comparison

```
POST /api/rfqs                                  (Purchase Manager)
{ "prRef": "<approved PR id>", "vendor": "<vendorId>", "items": [{ "item": "<itemId>", "quantity": 80 }] }
→ 400 if prRef isn't APPROVED — "An RFQ can only be raised against an approved Purchase Requisition."

POST /api/quotations                            (Purchase Manager) — one per vendor+item+RFQ
→ 409 on a duplicate vendor/item/RFQ combination
→ finalLandedCost computed server-side; isLowestRate recomputed across all sibling quotations

GET /api/quotations/comparison/:rfqId?item=<itemId>
→ 200 { count, canSelect (true once count >= 3), quotations[] sorted by landed cost, recommendedVendor, selectedVendor }

PATCH /api/quotations/:id/decision              (Management only)
{ "decision": "APPROVED", "reasonForSelection": "Lowest landed cost." }
→ 400 if fewer than 3 quotations exist yet for this RFQ/item — "At least 3 quotations are required..."
```

### Purchase Order → Goods Receipt → Bill

```
POST /api/purchase-orders                       (Accounts only)
{ "quotationRef": "<selected quotation id>", "deliveryLocation": "FPF Main Store" }
→ 400 if the quotation isn't `selected: true`

POST /api/goods-receipts                        (Store Keeper or Accounts)
{ "poRef": "<poId>", "site": "<siteId>", "receivedQuantity": 80, "acceptedQuantity": 78, "rejectedQuantity": 2 }
→ accepted/rejected fields are silently zeroed unless the caller is a Store Keeper;
  Stock only increments if acceptedQuantity > 0
PATCH /api/goods-receipts/:id/verify            (Store Keeper only) — completes a GRN Accounts logged bare

POST /api/bills                                 (Accounts)
{ "poRef": "<poId>", "grnRef": "<grnId>", "billNumber": "VNK-INV-1", "invoiceDate": "2026-09-09", "amount": 20132 }
PATCH /api/bills/:id/match                      (Accounts) — runs the 3-way match, sets MATCHED/MISMATCH + matchNotes
```

### Item Issue, Stock & Returnable Gate Pass

```
POST /api/item-issues                           (Admin, own site) — direct issue against a Requirement
GET  /api/stock?site=&item=                     (any role, Admin/Store Keeper forced to own site)
GET  /api/stock/low?site=                       (any role) — feeds the dashboard low-stock widget

POST /api/gate-passes                           (Admin or Store Keeper)
{ "materialName": "Feed Auger Motor", "quantity": 1, "site": "<siteId>", "approvedBy": "<userId>" }
→ 400 if approvedBy is missing/invalid (enforced non-null before save)
PATCH /api/gate-passes/:id/return
{ "returnQuantity": 1, "receiverNameSignature": "Ramesh Kumar" }

GET  /api/users?role=&site=&isActive=           (any authenticated role)
— lightweight directory (name/email/role/site only, no password), added so the
frontend can populate the Gate Pass "Approved By" picker without a full
user-management module.
```

### Specifically confirm these behaviours (RA v2.0 Sec. 8 callouts)

- [ ] `GET /api/purchase-requisitions` as **Purchase Manager** never returns a non-APPROVED
  requisition, even when `?status=PENDING` is passed explicitly.
- [ ] `POST /api/rfqs` against a PENDING or REJECTED requisition returns **400**, not 201.
- [ ] `PATCH /api/quotations/:id/decision` with `decision: APPROVED` returns **400** when
  fewer than 3 quotations exist for that RFQ + item; succeeds on the 3rd.
- [ ] `POST /api/purchase-orders` against a quotation that isn't `selected: true` returns **400**.
- [ ] `POST /api/goods-receipts` submitted by **Accounts** (not Store Keeper) leaves
  `acceptedQuantity`/`rejectedQuantity` at 0 and does **not** move Stock, even if those fields
  are included in the request body.
- [ ] `PATCH /api/goods-receipts/:id/verify` as Store Keeper increments `Stock` by exactly
  `acceptedQuantity` (check via `GET /api/stock`) and cannot be run twice on the same GRN.
- [ ] `PATCH /api/bills/:id/match` flags **MISMATCH** with a note when GRN accepted qty ≠ PO
  qty (the seeded short-receipt bill demonstrates this out of the box).
- [ ] `POST /api/item-requirements/:id/process` on the seeded PENDING vaccine requirement (no
  stock) creates a linked Purchase Requisition rather than an Item Issue Slip (Path B); the
  seeded FULFILLED broiler-feed requirement instead shows Path A already happened.
- [ ] `POST /api/gate-passes` without `approvedBy` returns **400**.
- [ ] `GET /api/stock/low` includes the seeded disinfectant record (stocked at 10, below its
  reorder level of 30) and excludes items above their reorder level.

## Note on deployment (A10's other half, and B9)

Per your instruction, the deployment checklist and the actual build/deploy step (Render/
Railway hosting config, Vercel/Netlify frontend deploy, production env vars) were **skipped**
in this pass. Everything above is local-only. Say the word when you want that part done and
I'll pick it up as its own task.
