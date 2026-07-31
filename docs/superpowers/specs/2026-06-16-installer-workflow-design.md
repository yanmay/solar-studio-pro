# System Design Specification: Installer Sales & Workflow Layer

This document defines the specification for building the Installer Sales & Workflow Layer for SUNPOWER LINK, consisting of:
1. Homeowner Proposal PDF (Module 1)
2. CRM Lead Pipeline (Module 2)
3. Lightweight Project Management Kanban Board (Module 3)

---

## 1. Database Schema Extensions & Migration

A new database migration [20260616_crm_kanban.sql](file:///c:/Users/noobg/solar-studio-pro/supabase/migrations/20260616_crm_kanban.sql) will be created to alter and extend the schema:

### Reconciling Status Enums
We will alter the status check constraint on `lead_assignments` to allow `'site_visit'`:
```sql
ALTER TABLE lead_assignments DROP CONSTRAINT IF EXISTS lead_assignments_status_check;
ALTER TABLE lead_assignments ADD CONSTRAINT lead_assignments_status_check
  CHECK (status IN ('delivered', 'viewed', 'contacted', 'site_visit', 'quoted', 'won', 'lost'));
```
**UI Mapping to Database Statuses:**
* `'delivered'` or `'viewed'` $\rightarrow$ **New**
* `'contacted'` $\rightarrow$ **Contacted**
* `'site_visit'` $\rightarrow$ **Site Visit**
* `'quoted'` $\rightarrow$ **Quoted**
* `'won'` $\rightarrow$ **Won**
* `'lost'` $\rightarrow$ **Lost**

### Structured Columns as Canonical Source
We add the following fields to `solar_reports` to avoid JSON duplication and prevent data drift:
* `confidence_level` (TEXT check constraint: `'High'`, `'Medium'`, `'Low'`)
* `confidence_reason` (TEXT) - Describes low/medium confidence reasons (e.g., *"elevation data fell back to SRTM modeling"*).

### Kanban Project Workflow Columns
We add the nullable project management attributes directly to the `lead_assignments` table:
* `project_stage` (TEXT check constraint: `'lead'`, `'survey'`, `'design'`, `'install'`, `'commissioned'`). A non-null value indicates that the assignment is an active project visible on the Kanban board.
* `project_assignee` (TEXT, default `NULL`)
* `project_due_date` (TIMESTAMPTZ, default `NULL`)
* `project_notes` (TEXT, default `NULL`)

*Mock Parity:* The local memory database tables inside `api-server.cjs` will support identical columns and enums to maintain parity.

---

## 2. Module 1: Homeowner Proposal PDF & Subsidy Source

* **Canonical Subsidy Source**: The proposal PDF reads its system details and total subsidy amount directly from the persisted `solar_reports.pm_surya_subsidy` and `solar_reports.system_size_kwp` database columns instead of recalculating the subsidy dynamically. This prevents data drift between the PDF and the CRM lead detail view.
* **Subsidy Formula Breakdown**: The JS `SUBSIDY_SLABS` configuration constant imported from [solar-defaults.ts](file:///c:/Users/noobg/solar-studio-pro/src/lib/solar-defaults.ts) is used exclusively to construct the text explanation and formula breakdown (e.g., *"Formula: 2 kWp x ₹30,000 + 1 kWp x ₹18,000 = ₹78,000"*).
* **Branding White-Labeling**: Integrates existing Pro white-label settings (reads `company_name`, `custom_logo_url`, `custom_domain` from installer profile) to render custom headers.
* **ROI Vector Graph**: Renders the 25-year cumulative savings forecast using sharp jsPDF vector APIs (`doc.line`, `doc.circle`), explicitly highlighting the zero-crossing payback point.
* **Confidence Disclaimer**: The disclaimer section will carry the report's `confidence_level` and `confidence_reason` with **no certainty copy**:
  * *"This is a [High/Medium/Low] confidence estimate based on satellite modeling: [confidence_reason]. Subject to on-site physical verification before construction."*

---

## 3. Module 2: Lead Creation & Silent Persisting Flow

To support coordinate-only (automated) scans without requiring pre-saved data, we implement the following database creation and lookup lifecycles:

### A. Report Load (Silent Session & Report Save)
When the frontend fetches `/api/feasibility?lat=X&lng=Y`:
1. The backend checks if an active `analysis_sessions` record exists for the exact coordinates (rounded to 4 decimal places) created within the last 15 minutes.
2. **Deduplication Scope**: This time-window coordinate reuse applies **only** to scans run with default configurations. If any custom inputs (e.g. customized setback, panel wattage, or shading parameters) are supplied, a new session is always created to ensure parameter fidelity.
3. If no reusable session exists, the backend silently inserts:
   * A new `analysis_sessions` record. To prevent database unique-constraint collisions on the `site_id` column, the backend will generate a unique identifier (e.g. `site_id = 'automated_' + uuid`).
   * A new `solar_reports` record populated with the feasibility engine output (system size, yield, net capex, subsidy, and confidence level/reason).
4. The API returns the computed feasibility report to the frontend, carrying the unique `analysisId` (equal to the database session UUID `id`).

### B. Lead Capture Form Submission (Homeowner)
When the homeowner submits the `LeadCaptureForm` (which calls `/api/leads`):
1. The endpoint queries `analysis_sessions` by the submitted `siteId` (resolving strictly on the session's UUID `id` field to ensure visitor isolation).
2. It resolves the session and inserts a new `lead_requests` record (with `homeowner_name`, `homeowner_phone`, `status = 'open'`, linked to the session `id`).

### C. Installer Purchase & Direct Save
* **Marketplace Lead Purchase**: When an installer purchases an open lead request (calling `/api/installer/leads/purchase`), it inserts a `lead_assignments` record for that installer with `status = 'delivered'`, making it active in their CRM Lead Pipeline.
* **Installer Explicit "Save to CRM"**: If a logged-in installer runs a scan and clicks "Save to CRM" in the UI:
  1. The frontend calls `/api/leads` to create a `lead_requests` record.
  2. It then automatically calls `/api/installer/leads/purchase` directly to create a `lead_assignments` record assigned to the installer, skipping the open marketplace pool.

---

## 4. Module 3: Idempotent Won $\rightarrow$ Project Auto-Trigger

To maintain clean and idempotent status transitions:
* **Server-Side Enforcement**: Inside the `/api/installer/leads/update-assignment` endpoint, when updating a lead's status to `won`, the API will set `project_stage = 'lead'` **only if `project_stage` is currently `NULL`**. 
* **Manual Revivals**: Reviving a `lost` lead explicitly by clicking "Convert to Project" in the UI is allowed, which will explicitly set `project_stage = 'lead'`. 
* **No Side-Effects for Lost Status**: Saving a lead as `lost` will not auto-convert it. If a project was already active (`project_stage` is non-null), setting its status to `lost` does not clear or alter its `project_stage`, preserving the active card stage and notes.
* **Tolerant UI Rendering**: Kanban cards will render smoothly even when `project_assignee` or `project_due_date` are `NULL` (displaying *"Unassigned"* or *"Set target date"*), allowing auto-converted leads to appear on the board and be updated later.

---

## 5. UI Layout & Surfacing Reminders

* **Lead List View**: Located in the Installer CRM, showing purchased leads. Filterable by status stages (New, Contacted, Site Visit, Quoted, Won, Lost). Clicking a lead opens a modal showing the full scan details, with a "Download Homeowner Proposal" button and a "Convert to Project" button.
* **Kanban Board View**: Located under a new Tab in the Installer CRM. Displays 5 columns: `Lead` $\rightarrow$ `Survey` $\rightarrow$ `Design` $\rightarrow$ `Install` $\rightarrow$ `Commissioned`. Cards show the system size, net CapEx, and assignee. Enables HTML5 drag-and-drop to update `project_stage`.
* **Overdue Reminder Bar**: Rendered as a high-visibility dashboard banner at the top of the CRM portal, displaying all active follow-up reminders that are overdue or due today. Clicking a reminder slides open the corresponding card.

---

## 6. Test Coverage Specifications

We will implement the following tests in Vitest:
1. **Module 1**: Verify `calcSubsidyInr` math against the configured slabs, and ensure the proposal generator generates a valid PDF schema without crashing. Also assert that `calcSubsidyInr(report.system_size_kwp)` equals the stored `pm_surya_subsidy` value in test runs to catch any math divergence.
2. **Module 2**: Verify `/api/leads` successfully retrieves and links the silent-upserted session and populates the lead request with accurate coordinates, address, and report metrics.
3. **Module 3**: Verify `/api/installer/leads/update-assignment` updates the stage, assignee, notes, and due date.
4. **Idempotency**: Test that calling status change to `won` on an assignment with an existing `project_stage` (e.g. `'survey'`) does **not** reset it back to `'lead'`.
