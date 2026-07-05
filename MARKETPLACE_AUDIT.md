# MARKETPLACE_AUDIT.md — Vendor Marketplace & CRM Audit

> Audit of the installer marketplace, CRM, and lead systems performed 2026-07-05.
> Verdict up front: **the current implementation is an affiliate-link facade; the long-term marketplace strategy is designed only in the database schema. Nothing in the runtime supports it yet — but the schema is a strong foundation and should be built on, not replaced.**

---

## 1. What Actually Exists (runtime)

| Area | Reality |
|---|---|
| **Marketplace UI** | `InstallerMarketplace.tsx` (113 lines): three **hardcoded affiliate partners** (Loom Solar, Fenice Energy, Tata Power Solar) with static ratings/badges and UTM-tagged affiliate links parameterized by kW/city. Plausible click tracking. No live data of any kind. |
| **Lead capture** | `LeadCaptureForm.tsx` (204 lines) + `api/leads.ts`: name/phone/city validated (Indian mobile regex) → **one email via Resend to `LEADS_EMAIL`**. The inbox is the database. No dedupe, no status, no assignment, no follow-up. |
| **Payments** | Razorpay checkout works for homeowner report unlock (`pay_per_scan`, `pro_monthly`) — but unlock state is client-trusted and nothing is recorded. No installer-side payments exist. |
| **Auth / roles** | **None.** No login of any kind. |
| **Dashboards** | **None** — no installer dashboard, no admin dashboard, no routes for either. |

## 2. What Exists Only as Schema (designed, unwired)

The migration (`20260101_001_schema.sql`) already models most of Phase 2 correctly:

| Capability | Schema support | Gap vs MASTER_PLAN |
|---|---|---|
| Installer onboarding | `installer_profiles`: **GSTIN regex CHECK** (`^[0-9]{2}[A-Z]{5}[0-9]{4}...`), service pincodes, MNRE certification, approval flow fields | No certificate-upload storage path defined |
| Subscriptions | `subscription_tier` (trial/basic/pro/enterprise), `subscription_status`, `subscription_expires_at` | **No quota counter** (leads used this cycle) — needs a column or ledger |
| Lead lifecycle | `lead_requests` (open/assigned/fulfilled/cancelled, **7-day expiry default**) | Matches plan |
| Lead routing | `lead_assignments` FK'd to request+installer, funnel `delivered→viewed→contacted→quoted→won/lost`, `price_charged_paise` | **Max-3 routing is a business rule, not enforced in schema** — needs app logic or a trigger |
| Lead billing | `payments.payment_type` includes `installer_subscription` and `lead_purchase` (paise precision) | **No wallet/ledger table** — see §4 |
| Roles & security | `profiles.role` (homeowner/installer/admin) + RLS policies written for installers seeing only their assignments, admins seeing all | Solid; matches the access model needed |
| Quote management | — | **Nothing.** No `quotes` table (amount, line items, validity, PDF ref) |
| Admin config | `tariff_configs`, `subsidy_schemes` tables | Exist; no admin UI |
| White-label | — | **Nothing.** No tenant/branding layer (correctly deferred to Phase 4) |

## 3. Gap Analysis — Requirement by Requirement

| Requirement | Exists? | What's missing |
|---|---|---|
| Installer onboarding | Schema only | Signup flow, GSTIN validation UX (schema regex is format-only — no GSTN API verification), MNRE cert upload (needs storage bucket), admin approval queue |
| CRM | No | Lead inbox UI, funnel actions (accept/decline/log outcome), notifications |
| Lead routing | Schema only | Matching engine (pincode/city → ≤3 installers), delivery within 60 s SLA, expiry job |
| Subscription system | Schema only | Razorpay Subscriptions integration, quota tracking/reset per cycle, tier gating |
| Wallet | **No — including schema** | Ledger table for prepaid lead credits (see §4.3) |
| GST validation | Schema regex only | Format check ≠ validity; optional GSTN public API verification at approval time |
| Lead lifecycle | Schema only | State-transition enforcement, T-48h expiry reminders, homeowner-side status view |
| Quote management | **No — including schema** | `quotes` table + builder UI reusing scan data (CRM v2 in MASTER_PLAN) |
| Installer dashboard | No | `/dashboard` shell: leads, pipeline, profile, billing |
| Admin dashboard | No | `/admin`: approval queue, disputes, tariff/subsidy editors |
| Marketplace UI | Affiliate facade | Live installer cards from `installer_profiles`; affiliates demoted to backfill for uncovered pincodes |
| White-label | No | Deferred to Phase 4 (correct per MASTER_PLAN — do not build now) |

## 4. Recommended Architecture

### 4.1 Principles
1. **Build on the existing schema** — it anticipates the strategy well. Extend with small migrations; never fork a parallel model.
2. **All money and lead mutations happen server-side** (service-role via `api/`), RLS governs reads. No client ever writes a lead assignment or wallet entry.
3. **Email/WhatsApp become notifications, never storage.** `lead_requests` is the source of truth from day one of Phase 2.
4. **The homeowner flow must not regress** — affiliate cards remain as backfill so uncovered pincodes still get value (MASTER_PLAN §9 chicken-and-egg mitigation).

### 4.2 Lead routing engine (Phase 2 core)

```
LeadCaptureForm (multi-step qualification)
   └─► POST /api/leads → INSERT lead_requests (status=open)
         └─► matching: installer_profiles WHERE service_pincodes @> lead.pincode
             AND subscription_status='active' AND quota_remaining > 0
             ORDER BY (response_rate, win_rate) LIMIT 3
               └─► INSERT lead_assignments (delivered) × ≤3
               └─► debit quota/wallet per assignment
               └─► notify (Resend email + WhatsApp later); SLA target < 60 s
Expiry job (cron): open>7d → expired; assignments untouched at T-48h → reminder
```
Enforce "≤3 assignments" in the API layer with a COUNT check inside a transaction (a DB trigger is optional hardening later — don't over-engineer now).

### 4.3 Wallet — add one small migration (when Phase 2 starts, not before)

```sql
CREATE TABLE installer_wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installer_id uuid REFERENCES installer_profiles(id) NOT NULL,
  delta_paise integer NOT NULL,             -- +topup / -lead debit
  reason text NOT NULL CHECK (reason IN ('topup','lead_debit','refund','adjustment')),
  lead_assignment_id uuid REFERENCES lead_assignments(id),
  payment_id uuid REFERENCES payments(id),
  created_at timestamptz DEFAULT now()
);
-- balance = SUM(delta_paise); never store a mutable balance column
```
Append-only ledger (auditable, dispute-friendly) instead of a balance field. Subscription quota can be a simple `leads_used_this_cycle` counter on `installer_profiles` reset by the billing cycle job; wallet covers per-lead top-ups beyond quota.

### 4.4 Quote management (CRM v2 — schema when needed)
`quotes` table: `lead_assignment_id`, `amount_paise`, `system_kwp`, `line_items jsonb`, `valid_until`, `status (draft/sent/accepted/rejected)`, `pdf_path`. The quote builder pre-fills from the homeowner's actual `analysis_sessions` data — this is the differentiator vs generic CRMs.

### 4.5 Surfaces (build order)
1. **Installer onboarding** (`/onboard`): account → business details (GSTIN format check) → service pincodes → cert upload (Supabase Storage) → pending approval state.
2. **Admin approval queue** (`/admin`): approve/reject/suspend; later tariff/subsidy editors.
3. **Installer dashboard** (`/dashboard`): lead inbox (masked location until accepted, expiry countdown, confidence score), funnel actions, profile, billing. **Mobile-first — installers live on phones** (MASTER_PLAN §3.3).
4. **Marketplace section on Results**: live installers matched by pincode replace hardcoded cards; affiliates render only when zero matches.

### 4.6 What NOT to build yet
- White-label/tenant layer (Phase 4).
- External CRM sync/webhooks (CRM v4).
- Dynamic lead pricing ML (needs funnel data first — launch with flat per-tier pricing).
- Reviews/reputation (needs won-lead volume; CRM v3).

## 5. Risks Specific to the Marketplace

| Risk | Mitigation |
|---|---|
| Leads sold before payment persistence is trustworthy | **Hard dependency: Stage 0 (server-authoritative payments + auth) ships first.** Do not start Phase 2 before the gate |
| Lead quality complaints from installers | Multi-step qualification form + confidence score on every lead; refund path exists via ledger `refund` reason |
| Fake/duplicate homeowner leads | Phone OTP verification at capture (add at Phase 2 start); dedupe on phone+pincode within 30 days |
| Installer churn from empty inboxes | Only sell subscriptions in pincodes with demonstrated scan volume; show scan-density data during onboarding |
| GSTIN format-valid but fake | Manual admin approval initially; GSTN API check when volume justifies it |

---

*Sequencing and estimates for everything above live in IMPLEMENTATION_BACKLOG.md. Nothing in this document should be implemented before Stage 0 completes.*
