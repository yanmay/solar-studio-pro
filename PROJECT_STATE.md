# PROJECT_STATE.md — SolarScan AI / SUNPOWER LINK

> Reconstructed from a full repository read on 2026-07-05 (branch `v0/noobgtx70-1763-614c4528`).
> This document is the single source of truth for continuing development.

---

## 1. Overall Architecture

### 1.1 Frontend

| Aspect | Implementation |
|---|---|
| Framework | **Vite + React 18 + TypeScript** (SPA, *not* Next.js) |
| Routing | `react-router-dom` — 7 routes (Landing, Map, Results, Market Insights, Policy Tracker, Privacy, 404) |
| UI kit | shadcn/ui (~60 components in `src/components/ui/`) + Tailwind CSS |
| Maps | Leaflet + Esri World Imagery satellite tiles (`MapPage.tsx`, ~1,900 lines) |
| State | Custom store hook `use-scan-store.ts` (localStorage-persisted scan state), no Redux/Zustand |
| Animation | framer-motion; `cobe` v2 globe (`cosmic-404.tsx`, `Globe3D.tsx`) |
| i18n | Custom i18n in `src/i18n/` — 5 locales: en, hi, bn, mr, ta |
| PWA | `vite-plugin-pwa` with service worker + install prompt (`PwaInstallPrompt.tsx`) |
| Observability | Sentry (`src/lib/sentry.ts`, gated on `VITE_SENTRY_DSN`), Plausible analytics (`src/lib/analytics.ts`) |
| Env typing | `src/vite-env.d.ts` types all `VITE_*` vars |

**Page flow:** Landing → Map (address search / voice search → satellite view → roof trace) → Results (analysis + paywall) → PDF / installer leads.

### 1.2 Backend / API (Vercel Serverless Functions, `api/`)

All routes run on the **Node.js runtime** (switched from Edge — Razorpay SDK and `node:crypto` require Node):

| Route | Purpose |
|---|---|
| `api/geocode.ts` | Nominatim forward/reverse geocode proxy (rate-limited) |
| `api/solar-data.ts` | NASA POWER climatology proxy (rate-limited) |
| `api/leads.ts` | Installer lead capture → **Resend email** to `LEADS_EMAIL` (validates Indian mobile `^[6-9]\d{9}$`) |
| `api/payment/create-order.ts` | Razorpay order creation (`pay_per_scan` / `pro_monthly`) |
| `api/payment/verify.ts` | HMAC-SHA256 signature verification (`node:crypto`) |
| `api/payment/status.ts` | Payment status check |
| `api/payment/restore.ts` | Restore a previous unlock by payment ID |
| `api/_utils/rate-limit.ts` | **In-memory** rate limiter (resets per cold start — not durable) |

**Key architectural fact:** there is **no database wiring anywhere**. Payment unlock state lives in the client (scan store / localStorage) and leads go out as email only.

### 1.3 Supabase Integration — designed, NOT wired

- `supabase/migrations/20260101_001_schema.sql` defines a complete **11-table schema with RLS**: `profiles`, `analysis_sessions`, `rooftop_sections`, `solar_reports`, `payments`, `installer_profiles`, `lead_requests`, `lead_assignments`, `tariff_configs`, `subsidy_schemes`, `nasa_power_cache`.
- **Zero Supabase client usage exists in `src/` or `api/`.** No `@supabase/supabase-js` import, no auth, no persistence. The schema is a blueprint awaiting implementation.

### 1.4 Python Solar Engine — standalone, NOT called by the webapp

- `solar_engine.py` (199 lines): pvlib-based yield model — takes lat/lng, tilt, azimuth, albedo, monthly GHI/DHI/temp/wind, elevation-derived pressure; applies shading loss (none 0% / partial 15% / heavy 30%) and IS 875 Part 3 wind-zone classification. Reads JSON on stdin, writes JSON to stdout.
- Tested by `test_solar_engine.py` / `test_webapp.py`, but the deployed webapp uses the **TypeScript port** (`src/lib/solar-calc.ts`) instead. The Python engine is a reference/validation implementation.

### 1.5 Deployment (GitHub + Vercel)

- Repo: `yanmay/solar-studio-pro`, base branch `main`; v0 works on feature branches (current: `v0/noobgtx70-1763-614c4528`).
- Vercel builds the Vite SPA + bundles `api/` as serverless functions. `vercel.json` handles SPA rewrites.
- Recent deploy failures (now fixed): missing `razorpay` dep, Edge runtime with Node modules, NodeNext import extensions, missing `vite-env.d.ts`, cobe v2 API break, framer-motion typing.
- Required env vars: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RESEND_API_KEY`, `LEADS_EMAIL`; optional: `VITE_SENTRY_DSN`, `VITE_PLAUSIBLE_DOMAIN`, `VITE_ROOF_ML_ENDPOINT`, `HUGGINGFACE_API_KEY`.

---

## 2. UI/UX Roadmap

### 2.1 Already redesigned
- **Landing page** — hero with `cobe` photorealistic globe, feature cards, testimonials, CTA-with-glow, liquid-chrome buttons, theme toggle (light/dark), language switcher.
- **404 page** — cosmic globe animation (rewritten for cobe v2), framer-motion variants.
- **Results page** — metric cards, Recharts monthly production chart, battery recommendation card, TOU scheduling card, paywall overlay, loading skeletons.
- **Map page** — satellite tracing UI with draw state machine, auto-detect button, photo estimator dialog, voice search.

### 2.2 Still needs redesign
- **Market Insights** and **Policy Tracker** pages — functional but visually thinner than Landing/Results.
- **Privacy page** — plain text.
- **Lead capture form** — basic dialog; no multi-step qualification.
- **No installer/vendor-facing UI at all** (dashboard, onboarding, CRM — see §5).
- **Mobile trace UX** — polygon vertex dragging on small touchscreens is fiddly; needs larger hit targets and an undo affordance.

### 2.3 Design-system inconsistencies
- Mixed brand names in copy: "SolarScan AI", "SUNPOWER LINK" (PDF), "sunpowerlink.in" — needs one brand.
- One-off components (`liquid-chrome`, `chrome-button`, `cta-with-glow`, `incident-report-middle`, `snappy-slider`) coexist with stock shadcn styles — token usage is inconsistent between them.
- Some pages hardcode colors instead of semantic tokens (`bg-background`, `text-foreground`).
- Emoji used in PDF (`📍`) and some UI where lucide icons should be used.

### 2.4 Component hierarchy & reusable components
```
App (router, theme, i18n, Sentry)
├── LandingPage → Globe3D, FeatureCard, Testimonials, LanguageSwitcher, ThemeToggle, PwaInstallPrompt
├── MapPage → Leaflet map, PhotoRoofEstimator, voice search (use-voice-search)
├── ResultsPage → MetricCard, TimeOfUseCard, InstallerMarketplace, LeadCaptureForm, RooftopARViewer, charts
├── MarketInsightsPage / PolicyTrackerPage / PrivacyPage
└── NotFound → cosmic-404 Globe
```
Reusable: `MetricCard`, `FeatureCard`, `NavLink`, all of `components/ui/*`, hooks (`use-scan-store`, `use-solar-data`, `use-geocode`, `use-payment`, `use-voice-search`, `use-mobile`, `use-toast`).

### 2.5 Recommended UI improvements
1. Unify brand name + typography tokens across pages and PDF.
2. Promote Market Insights / Policy Tracker to the Landing page's visual level.
3. Replace hardcoded colors with semantic tokens; audit dark mode on Results charts.
4. Add an explicit "scan progress" stepper (Address → Trace → Analyze → Report).
5. Mobile-first polygon editing (bigger vertex handles, tap-to-insert, undo/redo).

---

## 3. Solar Intelligence Engine

### 3.1 Rooftop detection pipeline (current)
1. **Geocode** address via `/api/geocode` (Nominatim proxy) or browser geolocation; voice search available.
2. User confirms location on **Esri satellite tiles** in Leaflet.
3. **Auto-detect (OSM):** `src/lib/osm-buildings.ts → detectBuildingAt()` queries **Overpass API** (3 mirror endpoints with failover) for `building` ways/relations within a 25 m radius; picks the polygon **containing the tap point** via ray-casting, else the smallest nearby; area via equirectangular projection.
4. **Manual trace:** user draws/edits polygon vertices on the map (draw state machine in `MapPage.tsx`).
5. **Photo fallback:** `roof-from-photo.ts` — Hugging Face Inference API segmentation of an uploaded roof photo; roof-pixel fraction → area estimate with a user-supplied reference scale.
6. Polygon → `panel-layout.ts` (setbacks, walkways, portrait/landscape packing, roof-perimeter vs geographic-south alignment) → panel count and kWp.

### 3.2 Data sources
- **OSM/Overpass** — building footprints (free, no key; coverage in India is patchy in smaller towns).
- **Google Solar API — NOT integrated.** No references anywhere in the codebase. (India coverage is limited anyway.)
- **Google Maps — NOT used.** Mapping is Leaflet + Esri tiles; geocoding is Nominatim.
- **Reverse geocoding** — Nominatim (`reverseGeocode` in MapPage; `geocodeAddress` forward fallback also hits Nominatim directly, viewbox-biased).
- **NASA POWER** — `/api/solar-data` proxies the climatology endpoint; `nasa-power.ts` converts monthly GHI → peak sun hours, with a **regional fallback table** when the API fails. Schema has a `nasa_power_cache` table (unwired).

### 3.3 Financial model (`src/lib/solar-calc.ts` + `solar-defaults.ts`)
- Usable area → installed kWp (`calcInstalledCapacity`), annual energy from peak sun hours (`calcAnnualEnergy`).
- System cost: **₹45,000/kWp** (2024-25 market rate, pre-subsidy).
- **Subsidy: PM Surya Ghar Muft Bijli Yojana** (central, Feb 2024 slabs) via `calcSubsidyInr` — this is the only subsidy implemented; **no per-state subsidy logic** (schema's `subsidy_schemes` table is unwired).
- Payback years, 25-yr ROI, CO₂ impact (`calcCO2Impact`: annual/25-yr kg + tree equivalents).
- **DISCOM tariffs:** `discom-rates.ts` — `STATE_DISCOM_MAP` covering major states, `detectDiscom()` from geocode state.
- **Time-of-Use:** `time-of-use.ts` — TOU window scheduling recommendations.
- Schema anticipates LCOE / IRR / NPV / investment grades (A+–D) — **not yet computed in the app**.

### 3.4 Battery recommendation (`battery-calc.ts`)
- Modes: `none` / `evening` (40% of daily load over 4 h autonomy) / `offgrid` (16 h autonomy).
- ₹25,000/kWh, 85% DoD, 10-yr replacement cycle → sizes capacity and computes cost.

### 3.5 Current limitations
- OSM footprint coverage is inconsistent across India; no imagery-based ML detection on satellite tiles.
- Flat-roof assumption; tilt/azimuth come from user hints (`tilt-azimuth.ts`) not measured geometry.
- Shading is a 3-bucket user selection (none/partial/heavy), not computed from obstructions or horizon.
- Monthly-resolution irradiance only (no hourly simulation in the deployed TS path).
- No persistence: every scan is ephemeral client state (share-URL encoding in `scan-url.ts` is the only "storage").

---

## 4. Accuracy System

### 4.1 What exists today
- **Confidence score exists ONLY in the photo pipeline** (`roof-from-photo.ts`): heuristic 0.8/0.55 (primary model) or 0.6/0.4 (fallback) based on roof-pixel fraction sanity (`0.1 < frac < 0.75`). Nothing else in the app produces a confidence value.
- **No uncertainty estimation** on area, yield, or financials anywhere.
- **Shadow calculations:** none computed. `shading` is a user-selected enum applied as a flat 0/15/30% loss (both TS and Python engines). Schema has `horizon_shading_loss` / `sky_view_factor` fields — unpopulated.
- **ML/photo detection:** HF segmentation fallback only; accuracy depends entirely on the user's reference scale.
- **Google Solar API contribution: zero** (not integrated).
- **Manual polygon tracing** is the accuracy ceiling — good when the user traces carefully; unquantified otherwise.
- **OSM fallback:** correct building selection is good (point-in-polygon), but OSM footprints can be outdated/simplified; no vintage/quality check.

### 4.2 How rooftop "accuracy" is effectively determined
Accuracy = trace quality. Area is planimetric (equirectangular / Leaflet geodesy), which is sound for small roofs; errors come from footprint truth (OSM), user tracing skill, and the flat-roof assumption (no pitch correction of area).

### 4.3 Recommended path to professional-grade accuracy
1. **Composite confidence score** per scan: source weight (manual trace > OSM > photo) × polygon quality (vertex count, self-intersection, area sanity vs building type) × irradiance source quality.
2. **Pitch-corrected area**: ask roof type (flat/pitched + pitch angle) and divide plan area by cos(tilt).
3. **Horizon shading**: compute sun-path obstruction from nearby OSM buildings with `building:levels` heights (already fetched in `OsmBuildingResult.approxLevels` — unused).
4. **Hourly simulation**: promote the pvlib Python engine to a deployed service (Vercel Python function) for hourly POA irradiance + temperature-derated yield; keep the TS model as instant preview.
5. **Uncertainty bands**: report P50/P90 yield using ±GHI interannual variability from NASA POWER.
6. **Imagery ML**: fine-tuned segmentation (e.g. SAM-family) on Esri tiles for one-tap detection where OSM is missing, with IoU-based confidence.

---

## 5. Vendor / CRM System

### 5.1 Implemented
- **`InstallerMarketplace.tsx`** — hardcoded affiliate partner cards (Loom Solar, Fenice Energy, Tata Power Solar) with ratings, badges, and UTM-tagged affiliate links parameterized by kW and city. Click tracking via Plausible.
- **`LeadCaptureForm.tsx` + `api/leads.ts`** — homeowner submits name/phone/city; validated and emailed via Resend to a single `LEADS_EMAIL` inbox. That's the entire "CRM".
- **Payments** — Razorpay checkout (`use-payment.ts` loads the script dynamically, `create-order` → checkout → `verify` HMAC). Plans: `pay_per_scan`, `pro_monthly`. Unlock state is client-side; `restore.ts` re-validates by payment ID.

### 5.2 Designed in schema but NOT implemented
- Vendor onboarding (`installer_profiles`: GSTIN regex validation, service pincodes, MNRE certification, approval flow).
- Subscription tiers (`trial`/`basic`/`pro`/`enterprise`, trial scan quota, expiry).
- Lead routing (`lead_requests` max-3-installer assignment, 7-day expiry; `lead_assignments` funnel: delivered→viewed→contacted→quoted→won/lost, per-lead pricing in paise).
- Roles (`profiles.role`: homeowner/installer/admin) with RLS policies written for all of it.
- **No authentication of any kind exists in the app.** No dashboard, no white-label support (nothing in code or schema addresses white-labeling — it would need a `tenants`/branding layer).

---

## 6. Report Generation

### 6.1 Current pipeline
Scan store (`SolarAnalysis` from `runFullCalculation`) → `src/lib/pdf-generator.ts` → **jsPDF 2-page client-side PDF**:
- **Page 1:** SUNPOWER LINK header, location label, analysis ID, date, core system metrics.
- **Page 2:** Net capital outlay (post-subsidy), 25-year cumulative savings, notes, disclaimer footer.
- Helpers: `drawSectionTitle`, key-value row renderer.

### 6.2 Data sources feeding the report
Roof polygon area → panel layout → kWp; NASA POWER GHI → annual/monthly kWh; PM Surya Ghar subsidy; DISCOM tariff → savings; battery + TOU cards shown in-app (not in the PDF yet).

### 6.3 Executive report
A design reference exists in `stitch_solar_intelligence_report_executive_summary/` (Stitch export), and the schema reserves `ai_summary`, `ai_roof_insights`, `cashflow_projection`, `suitability_score`, `investment_grade` — the executive-grade report (scores, cashflow table, AI narrative) is **designed but not built**.

---

## 7. Remaining Work (prioritized)

### Critical
1. **Wire Supabase**: apply the migration, add client + persistence for `analysis_sessions`/`solar_reports`/`payments` (server-side unlock verification instead of client trust).
2. **Auth** (Supabase Auth) — required for installer accounts and durable payment restore.
3. **Server-side payment truth**: record Razorpay orders/verifications in `payments`; stop relying on localStorage unlock.
4. **Durable rate limiting** (current in-memory limiter is per-cold-start).

### High Priority
5. Installer onboarding + dashboard (profiles, subscription tiers, lead inbox) per schema.
6. Lead routing engine (`lead_requests` → max 3 assignments) replacing email-only flow.
7. NASA POWER caching via `nasa_power_cache` (cuts latency and API dependence).
8. Composite accuracy/confidence score surfaced in Results + PDF.

### Medium Priority
9. Deploy Python pvlib engine as a Vercel Python function; hourly simulation + LCOE/IRR/NPV + investment grade.
10. State-level subsidies via `subsidy_schemes` (beyond PM Surya Ghar).
11. Executive PDF report (scores, cashflow projection, AI summary).
12. Market Insights / Policy Tracker redesign; brand unification.

### Nice to Have
13. Imagery ML roof detection on satellite tiles.
14. Horizon shading from OSM building heights.
15. White-label/tenant support for installer-branded reports.
16. WhatsApp lead notifications (higher engagement than email in India).

---

## 8. Technical Debt

- **Duplicated solar models**: `solar-calc.ts` (TS) vs `solar_engine.py` (pvlib) can drift; no cross-validation test binding them.
- **Duplicated geocoding**: `use-geocode.ts` / `api/geocode.ts` proxy vs direct Nominatim calls in `MapPage.tsx` (`geocodeAddress`, `reverseGeocode`) — two code paths, two rate-limit exposures.
- **Monolith pages**: `MapPage.tsx` (~1,900 lines) and `ResultsPage.tsx` (~1,700 lines) need decomposition into components.
- **Schema/app mismatch**: 11-table schema with RLS exists with zero runtime usage — risk of silent drift as the app evolves.
- **In-memory rate limiter** — ineffective on serverless.
- **Client-trusted paywall** — unlock state can be forged in localStorage.
- **Missing tests**: none for battery-calc, discom-rates, time-of-use, pdf-generator, payment endpoints, or the OSM detection logic; Playwright specs exist (`flow.spec.ts`, `screenshot.spec.ts`) but no CI config found.
- **Performance**: Overpass queries can take 3–8 s with no cache; HF inference cold starts; Results page recomputes full analysis on every render path change.
- **Deployment risks**: Nominatim/Overpass usage policies (rate limits, User-Agent) — a proxy cache is advisable; repo-root clutter (`lint-results.*`, `prd_raw.xml`, `*.tsbuildinfo`, extraction scripts) should be cleaned/gitignored.
- **Brand inconsistency** across UI, PDF, and email copy.

---

## 9. Next Development Sprint — "Persistence & Monetization Hardening"

Continues directly from the deployment-fix session. Effort sizing: S (≤half day), M (1–2 days), L (3–5 days).

### Milestone 1 — Supabase foundation (L)
- Apply `20260101_001_schema.sql` to a Supabase project; add `@supabase/supabase-js`.
- Server-side client in `api/_utils/supabase.ts` (service role) + browser client.
- Persist `analysis_sessions` + `rooftop_sections` on scan completion (anonymous `session_token` flow — schema already allows `user_id IS NULL`).
- Acceptance: a scan survives a browser wipe via its `site_id` share URL.

### Milestone 2 — Real payment persistence (M)
- `create-order` writes a `payments` row (`pending`); `verify` updates to `success` and flips `analysis_sessions.is_full_unlocked`.
- `status`/`restore` read from DB instead of trusting the client.
- Acceptance: unlock state is server-authoritative; forged localStorage no longer unlocks.

### Milestone 3 — Auth + installer onboarding (L)
- Supabase Auth (email+password) with `profiles` trigger; role selection at signup.
- Installer onboarding form → `installer_profiles` (GSTIN validation reusing the schema regex, service pincodes, tier = trial).
- Minimal installer dashboard route (`/dashboard`): profile, subscription status, lead inbox (empty state).
- Acceptance: an installer can register, complete a profile, and see the dashboard behind auth.

### Milestone 4 — Lead routing v1 (M)
- Replace email-only flow: `LeadCaptureForm` → creates `lead_requests`; assignment job picks ≤3 matching installers by pincode/city → `lead_assignments`; Resend email becomes a notification, not the datastore.
- Acceptance: a homeowner lead appears in matching installers' dashboards with funnel status tracking.

### Milestone 5 — NASA cache + rate limiting (S)
- `api/solar-data` reads/writes `nasa_power_cache` (30-day TTL, keyed by rounded lat/lng).
- Move rate limiting to a durable store (same Supabase table or Upstash if Redis semantics are preferred).
- Acceptance: repeat scans of the same area skip the NASA round-trip; limiter survives cold starts.

### Milestone 6 — Confidence score v1 (M)
- `src/lib/confidence.ts`: composite score from source (manual 0.9 / OSM 0.75 / photo = its existing heuristic), polygon sanity, and irradiance source (API vs regional fallback).
- Surface as a badge on Results and a line in the PDF.
- Acceptance: every completed scan displays a confidence percentage with a tooltip explaining its factors.

**Sprint exit criteria:** all scans and payments persisted in Supabase with RLS enforced; installers can onboard and receive routed leads; NASA data cached; every report carries a confidence score.
