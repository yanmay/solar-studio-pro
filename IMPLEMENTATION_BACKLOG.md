# IMPLEMENTATION_BACKLOG.md — Prioritized Work Queue

> Consolidates ARCHITECTURE_AUDIT.md, GOOGLE_SOLAR_AUDIT.md, MARKETPLACE_AUDIT.md, and UI_REFACTOR_PLAN.md
> into a single ordered backlog. Aligned with MASTER_PLAN.md gates and PROJECT_STATE.md debt items.
> Status: living document. Update statuses as items land; do not reorder tiers without updating MASTER_PLAN.md.

---

## How to read this backlog

- **Tier 0 (Blockers)** — security/correctness issues that undermine revenue or trust. Do these first, in order.
- **Tier 1 (Foundation)** — persistence, auth, and payment integrity. Gates all marketplace work.
- **Tier 2 (Product)** — installer marketplace, CRM, report quality. Revenue-expanding.
- **Tier 3 (Polish)** — UI refactor waves, performance, accessibility, testing depth.
- Each item lists: source audit, affected files, and acceptance criteria.

---

## Tier 0 — Blockers (do first, in order)

### T0-1. Server-authoritative payment verification — **DONE**
- **Landed:** schema applied to Supabase (11 tables + RLS, migration `initial_schema_solarscan`); all four `api/payment/*` routes DB-backed; `use-unlock-status` SWR hook makes `/api/payment/status` the client's source of truth; `unlocked` flag stripped from scan-url encode/decode; shared URLs and sessionStorage can no longer grant unlock.
- **Source:** ARCHITECTURE_AUDIT §Payments, MARKETPLACE_AUDIT §Trust
- **Problem:** `api/payment/verify.ts` verifies the Razorpay HMAC but persists nothing; unlock state lives in client localStorage (`use-payment.ts`) and in the shareable scan URL (`unlocked` flag in `scan-url.ts`). Anyone can forge an unlocked URL.
- **Files:** `api/payment/verify.ts`, `api/payment/status.ts`, `api/payment/restore.ts`, `src/hooks/use-payment.ts`, `src/lib/scan-url.ts`, Supabase `payments` table
- **Done when:** verify writes a `payments` row (order_id, payment_id, amount, scan hash, status); status/restore read from DB; the `unlocked` URL flag is removed; a tampered URL cannot unlock a report.

### T0-2. Wire Supabase client + persist scans and leads — **DONE (leads); scan persistence at analysis time deferred to T1-2**
- **Landed:** `api/_utils/supabase.ts` (service-role client + `ensureSession`); `api/leads.ts` inserts into `lead_requests` with Resend demoted to best-effort notification; `LeadCaptureForm` posts to the API with error handling. Sessions are created lazily (at payment/lead time); persisting every completed scan moves to T1-2 (scan history).
- **Source:** ARCHITECTURE_AUDIT §Persistence
- **Problem:** 11-table schema with RLS exists in `supabase/migrations/` but zero runtime code references Supabase. `api/leads.ts` logs and discards leads — every lead is lost.
- **Files:** new `src/lib/supabase.ts` + `api/_utils/supabase.ts` (service role), `api/leads.ts`, `src/pages/ResultsPage.tsx`
- **Done when:** leads POST inserts into `leads`; completed scans insert into `scans`; both verified via Supabase dashboard; RLS policies confirmed active.

### T0-3. Move secrets audit + rate-limit hardening
- **Source:** ARCHITECTURE_AUDIT §API
- **Problem:** `api/_utils/rate-limit.ts` is in-memory per-lambda (resets on cold start, per-instance); Razorpay key id is exposed client-side by design but secret handling needs re-verification post-persistence.
- **Done when:** rate limiting is backed by Upstash Redis (or documented as acceptable risk with per-IP + per-endpoint limits); no secret appears in client bundles (`grep` of `dist/`).

---

## Tier 1 — Foundation

### T1-1. Auth (Supabase email+password) for installers and returning homeowners
- **Source:** MARKETPLACE_AUDIT §Onboarding — schema has `profiles` + roles but no auth flow exists.
- **Done when:** sign-up/sign-in pages exist; sessions persist; `profiles` row created on signup; role stored (`homeowner` / `installer`).

### T1-2. Scan history ("My Scans")
- **Source:** MARKETPLACE_AUDIT §Homeowner retention
- **Done when:** authenticated users see past scans (from `scans` table) and can reopen paid reports without the URL.

### T1-3. Server-side report generation
- **Source:** GOOGLE_SOLAR_AUDIT §Integrity — paid PDF is generated client-side from client-computed numbers; a paid artifact should come from a server-computed, stored result.
- **Done when:** a `/api/report` endpoint recomputes results server-side from stored scan input, stores the canonical result JSON, and the PDF is generated from that record.

### T1-4. Google Solar API integration (feature-flagged)
- **Source:** GOOGLE_SOLAR_AUDIT §Pipeline — current stack is OSM Overpass footprints + NASA POWER irradiance + client heuristics. Google Solar API (buildingInsights) offers measured roof segments, tilt/azimuth, and shading where coverage exists (limited in India — hence flag + fallback).
- **Done when:** `api/solar-data.ts` tries Google Solar first (if `GOOGLE_SOLAR_API_KEY` set), falls back to NASA POWER; provenance (`irradianceSource`) is surfaced in the report; accuracy disclaimer updated.

---

## Tier 2 — Product / Marketplace

### T2-1. Installer onboarding + verified directory
- **Source:** MARKETPLACE_AUDIT §Supply — `InstallerMarketplace.tsx` renders hardcoded installers.
- **Done when:** installers register, submit GSTIN + docs, admin verifies, directory reads from `installers` table.

### T2-2. Lead routing + installer dashboard
- **Source:** MARKETPLACE_AUDIT §Demand — leads must reach installers to justify subscriptions.
- **Done when:** new leads are matched (pincode/district), appear in an installer dashboard with status pipeline (new → contacted → quoted → won/lost), and quota is enforced per tier.

### T2-3. Razorpay subscriptions for installer tiers
- **Source:** MARKETPLACE_AUDIT §Monetization, MASTER_PLAN Phase 3
- **Done when:** ₹2,999/₹7,999 plans exist in Razorpay; webhook (`payment.captured`, `subscription.charged`) updates `subscriptions`; feature gates read from DB.

### T2-4. Report v2 (accuracy + provenance)
- **Source:** GOOGLE_SOLAR_AUDIT §Accuracy — single-source irradiance, fixed PR, flat cost/kWp; MarketInsights uses its own duplicate math.
- **Done when:** shared calc module is the single source (MarketInsights duplication removed); monthly P50/P90 bands shown; assumptions table in PDF; state-wise cost tables replace flat ₹45k/kWp.

---

## Tier 3 — Polish

### T3-1. UI refactor Wave 1: tokens + fonts (UI_REFACTOR_PLAN §Wave 1)
Collapse to one token system in `src/index.css`; cut 7 font families to 2; remove `sunpower-*` parallel classes.

### T3-2. UI refactor Wave 2: page decomposition (UI_REFACTOR_PLAN §Wave 2)
Split `MapPage.tsx` (~1.6k lines) and `ResultsPage.tsx` (~1.7k lines) into feature components; extract shared INR/number formatting into `src/lib/format.ts`.

### T3-3. UI refactor Wave 3: a11y + motion discipline (UI_REFACTOR_PLAN §Wave 3)
ARIA on interactive map controls; `prefers-reduced-motion`; replace emoji-as-icon instances with lucide icons.

### T3-4. Test depth
- Unit: solar-calc golden tests vs `solar_engine.py` outputs (tolerance ±5%).
- E2E: Playwright paid-unlock flow with Razorpay test mode; lead submission; installer dashboard smoke.
- CI: type-check + build + tests on PR (no workflow exists today).

### T3-5. Performance
- Code-split heavy routes (Leaflet, cobe, pdf libs are all in the main bundle today).
- Target: LCP ≤ 2.5s on landing, bundle < 350 KB gz for initial route.

---

## Explicitly deferred (do not start without a MASTER_PLAN gate)
- Enterprise API / white-label (MASTER_PLAN Phase 5)
- ML roof detection replacing OSM (keep HF photo fallback as-is)
- Native mobile apps (PWA is sufficient through Phase 4)
- Multi-country expansion

## Dependency graph (summary)

```
T0-1 ──► T1-3 ──► T2-4
T0-2 ──► T1-1 ──► T1-2
   └───► T2-1 ──► T2-2 ──► T2-3
T1-4 ──► T2-4
T3-* independent (schedule alongside Tier 2)
```
