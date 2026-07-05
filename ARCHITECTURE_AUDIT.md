# ARCHITECTURE_AUDIT.md — SolarScan AI

> Full-repository architecture audit performed 2026-07-05 on branch `v0/noobgtx70-1763-614c4528`.
> Companion to `PROJECT_STATE.md` (current state) and `MASTER_PLAN.md` (vision). No code was changed in this audit.

---

## 1. Current Architecture

```
┌────────────────────────── CLIENT (Vite + React 18 SPA) ──────────────────────────┐
│ App.tsx: QueryClientProvider · TooltipProvider · BrowserRouter · lazy routes     │
│ Pages: Landing · Map(2,273L) · Results(1,693L) · MarketInsights · PolicyTracker  │
│        · Privacy · 404                                                           │
│ State: zustand store (use-scan-store, IN-MEMORY, no persist middleware)          │
│        + TanStack Query (installed, barely used) + share-URL encoding            │
│ UI: shadcn/ui (~60 comps) + one-off custom comps + 838-line index.css            │
│ i18n: custom, 5 locales · PWA: vite-plugin-pwa · Sentry + Plausible              │
└──────────────────────────────────────┬───────────────────────────────────────────┘
                                       │ fetch
┌──────────────────────── VERCEL SERVERLESS (api/, Node runtime) ──────────────────┐
│ geocode.ts (Nominatim proxy) · solar-data.ts (NASA POWER proxy)                  │
│ leads.ts (Resend email) · payment/{create-order,verify,status,restore}.ts        │
│ _utils/rate-limit.ts (IN-MEMORY — resets per cold start)                         │
└──────────────────────────────────────┬───────────────────────────────────────────┘
                                       │ (NOT CONNECTED)
┌───────────────────────────── SUPABASE (designed only) ───────────────────────────┐
│ 11-table schema + RLS in supabase/migrations/ — zero runtime usage               │
└───────────────────────────────────────────────────────────────────────────────────┘
   Sidecar: solar_engine.py (pvlib) — standalone reference, never called by app
```

Data flow: address → geocode → Leaflet/Esri trace (or OSM auto-detect / photo fallback) → `panel-layout.ts` → `solar-calc.ts` → zustand → Results paywall → Razorpay → client-side unlock → jsPDF.

## 2. Strengths

1. **Clean calculation core.** `src/lib/` is well-factored pure TypeScript (solar-calc, panel-layout, battery-calc, discom-rates, time-of-use) with unit tests for the three most important modules.
2. **Route-level code splitting already done.** Only Landing is eager; heavy pages lazy-load.
3. **API proxying is the right pattern.** Nominatim/NASA go through `api/` with rate limiting and User-Agent headers rather than direct client calls (with one violation — see Weaknesses).
4. **Schema-first database design.** The 11-table migration with RLS is genuinely good and matches the marketplace roadmap; it just needs wiring.
5. **Graceful degradation habits.** OSM Overpass has 3-mirror failover; NASA POWER has a regional fallback table; photo detection has a fallback model.
6. **Type discipline.** Shared types in `src/types/scan.ts`, typed env (`vite-env.d.ts`), strict-enough tsconfig; build is clean.
7. **Observability exists.** Sentry + Plausible gated on env vars — most projects at this stage have neither.

## 3. Weaknesses

| # | Weakness | Impact |
|---|---|---|
| W1 | **No persistence layer at all.** zustand store has no `persist` middleware; a page refresh on Results loses the scan. Share-URL is the only durability. | Every commercial feature is blocked; users lose paid reports on refresh |
| W2 | **Client-trusted paywall.** `isPaid` is a client flag; `verify.ts` verifies the HMAC but records nothing. | Trivially forgeable; revenue leak; blocks Stage 0 gate |
| W3 | **Monolith pages.** MapPage 2,273 lines, ResultsPage 1,693 lines — state machines, UI, data fetching, and business logic interleaved. | Every feature touching these pages is high-risk; merge conflicts already occurred here |
| W4 | **Two geocoding paths.** `api/geocode` proxy AND direct Nominatim calls inside MapPage (`geocodeAddress`, `reverseGeocode`). | Nominatim policy violation risk from client IPs; duplicated logic |
| W5 | **In-memory rate limiter** on serverless. | Effectively no rate limiting in production |
| W6 | **No authentication of any kind.** | Blocks installer accounts, scan history, admin — everything in Phases 1–2 |
| W7 | **TanStack Query installed but bypassed** — most fetching is hand-rolled `fetch` in components/hooks with manual loading state. | Duplicate loading/error handling; no caching of geocode/NASA responses client-side |
| W8 | **Two engines, no cross-validation.** TS `solar-calc.ts` and Python `solar_engine.py` can silently drift. | Accuracy claims become unverifiable |
| W9 | **838-line `index.css`** with 18 `@keyframes`, two competing token systems, and page-specific styles in the global sheet. | Design drift; dead CSS accumulates; see UI_REFACTOR_PLAN.md |
| W10 | **No CI.** Vitest + Playwright configs exist but nothing runs them on push. | Regressions reach `main` unchecked (the deploy-failure history proves it) |

## 4. Technical Debt

Ordered by interest rate (how fast it compounds):

1. **Monolith pages (W3)** — every sprint adds lines to files already past maintainability. Highest interest.
2. **Client-side payment truth (W2)** — each new paid feature inherits the forgeable pattern.
3. **Schema/app divergence** — the unwired migration ages with every app-side type change (e.g. `ScanInput.unlocked` added client-side only).
4. **Duplicated geocoding (W4)** and duplicated solar engines (W8).
5. **Duplicated UI primitives** — two theme toggles (`ThemeToggle.tsx`, `ui/animated-theme-toggle-button.tsx`), one-off buttons (`chrome-button`, `liquid-chrome`, `cta-with-glow`), INR formatting re-implemented in 10+ files with no shared `formatINR()`.
6. **Repo hygiene** — `lint-results.*`, `prd_raw.xml`, `*.tsbuildinfo`, extraction scripts, and a Stitch export at repo root; none gitignored.
7. **Dead/orphan code** — `incident-report-middle.tsx`, `snappy-slider.tsx`, `animated-state-icons.tsx` (403L) have no clear consumers; Material Symbols font loaded alongside lucide.
8. **Test gaps** — zero tests for payments, leads, OSM detection, battery-calc, discom-rates, pdf-generator, and all API routes.

## 5. Scalability Problems

At thousands of users the following break, in order:

1. **Rate limiter (W5)** — first to fail; Nominatim/NASA quota exhaustion → geocoding and irradiance outages.
2. **No NASA cache** — every scan pays a 1–3 s upstream round-trip; NASA may throttle the Vercel egress IPs.
3. **Overpass dependency** — public mirrors are community-run; 3–8 s queries with no cache means auto-detect fails under load. Needs server-side caching keyed by tile.
4. **Email-as-database for leads** — leads exist only in an inbox; unqueryable, unassignable, unbillable. Marketplace cannot exist on this.
5. **Client-side PDF at scale is fine** (it's the server that would suffer otherwise) — but report *storage* doesn't exist, so "re-download my report" is unsupported.
6. **Zero horizontal state** — no DB means no queues, no jobs, no analytics warehouse; every future system (lead routing, wallets, caching) needs the Supabase wiring first.
7. **Bundle growth** — Landing already pulls cobe + framer-motion; 5 font families load on first paint (see UI plan). Perf budget needed before Phase 1 marketing pushes.

## 6. Recommended Folder Structure

Evolve, don't big-bang. Target (feature-module layout):

```
src/
  app/                      # App.tsx, providers, router
  features/
    scan/                   # map, trace, detection (from MapPage)
      components/           # MapCanvas, TracePanel, AddressSearch, PhotoEstimator...
      hooks/                # use-draw-state, use-osm-detect
      lib/                  # osm-buildings, roof-from-photo, tilt-azimuth
    results/                # from ResultsPage
      components/           # MetricGrid, ProductionChart, PaywallOverlay, BatteryCard...
    payments/               # use-payment, paywall logic
    leads/                  # LeadCaptureForm, InstallerMarketplace
    reports/                # pdf-generator, future executive report
  components/               # truly shared: MetricCard, NavLink, ThemeToggle
    ui/                     # shadcn primitives ONLY (no one-off customs)
  lib/                      # cross-feature pure logic: solar-calc, battery-calc,
                            # discom-rates, format.ts (INR/number), analytics, sentry
  hooks/                    # cross-feature hooks only
  stores/                   # zustand stores
  types/
  i18n/
api/
  _lib/                     # supabase.ts (server client), rate-limit.ts, validation.ts
  ...(routes unchanged — Vercel filesystem routing)
```

Rule: a file goes in `features/X` unless ≥2 features import it. Move files opportunistically when touched, except MapPage/ResultsPage which get a dedicated decomposition task (backlog C-1).

## 7. Recommended Component Structure

- **Decompose by responsibility, not by size.** MapPage → `AddressSearchBar`, `VoiceSearchButton`, `MapCanvas` (Leaflet lifecycle only), `TraceToolbar`, `PolygonEditor` (draw state machine as `use-draw-state` hook), `AutoDetectButton`, `PhotoEstimatorDialog`, `ScanSummaryFooter`. ResultsPage → `ResultsHeader`, `MetricGrid`, `ProductionChart`, `FinancialBreakdown`, `BatteryCard`, `TouCard`, `PaywallOverlay`, `ReportActions`, `InstallerSection`.
- **Container/presenter split only at page level**: pages fetch/select from stores; leaf components receive props. No fetching inside leaf components.
- **Kill duplicates:** one `ThemeToggle`; one button system (shadcn `Button` variants — fold `chrome-button`/`liquid-chrome` styling into a `variant="premium"` or delete).
- **Shared formatting:** `lib/format.ts` with `formatINR`, `formatKWh`, `formatYears` — replaces 10+ ad-hoc implementations.
- Every new component: props-typed, semantic tokens only, no direct `fetch`.

## 8. Recommended API Structure

- Keep Vercel filesystem routing; standardize internals:
  - `api/_lib/response.ts` — uniform `{ ok, data | error, code }` envelope + error helper (routes currently hand-roll responses).
  - `api/_lib/validate.ts` — zod schemas per route (zod is already a dependency); reject before any upstream call.
  - `api/_lib/supabase.ts` — service-role client (server only, Stage 0).
  - `api/_lib/rate-limit.ts` — durable limiter (Supabase table now; Upstash if/when Redis semantics needed).
- **Route changes (Stage 0):**
  - `payment/create-order` → also INSERT `payments` row (`pending`).
  - `payment/verify` → UPDATE row to `success`, flip `analysis_sessions.is_full_unlocked`; response derived from DB.
  - `payment/status`, `payment/restore` → read DB, not client claims.
  - `leads` → INSERT `lead_requests` first; Resend becomes notification-only.
  - NEW `api/sessions` (POST/GET) — persist/fetch scans by `session_token`/`site_id`.
- All Node runtime (already correct). No Edge until a route provably needs it.

## 9. Recommended Supabase Structure

- **Apply `20260101_001_schema.sql` as-is** — it's sound. Then:
  1. **Access pattern:** browser uses anon key + RLS for reads of own data; all writes involving money/leads/unlocks go through `api/` with the service-role key. Never expose service role client-side.
  2. **Auth:** Supabase Auth email+password; on-signup trigger creates `profiles` with role (already in schema).
  3. **Anonymous scans:** use the schema's `user_id IS NULL` + `session_token` path so scans persist pre-signup and can be claimed on login (UPDATE user_id).
  4. **Add migrations (small, numbered):** `nasa_power_cache` usage needs an index on rounded lat/lng key; `rate_limits` table (`key text, window_start timestamptz, count int`); later `tenants` (Phase 4) — do NOT add now.
  5. **Migration discipline:** one file per change, applied via Supabase CLI/MCP, never edited retroactively. Keep a `schema.md` snapshot updated per migration.

## 10. Recommended State Management

Current zustand + TanStack Query is the **right stack** — fix usage, don't replace:

1. Add zustand `persist` middleware to the scan store (sessionStorage; scan survives refresh) — but **`isPaid`/`paymentId` must move OUT of persisted client state** entirely once server-authoritative unlocks land; the store then caches a server-verified flag keyed by session id.
2. Route ALL server data through TanStack Query (`useQuery(['geocode', q])`, `['nasa', lat, lng]`, `['payment-status', orderId]`) — deletes manual loading/error state and gives client caching for free.
3. Split stores by domain when auth lands: `useScanStore`, `useAuthStore` (thin wrapper on Supabase session), later `useInstallerStore`. No global god-store.
4. Server state lives in Query, client/UI state in zustand, URL state (share links) stays in `scan-url.ts`. Never duplicate one piece of state across two of these.

## 11. Performance Improvements

| Item | Action |
|---|---|
| Fonts | 7 families load today → cut to 2 (see UI plan); saves ~300 KB+ and render-blocking requests |
| NASA POWER | Server cache (`nasa_power_cache`, 30-day TTL) — biggest latency win per scan |
| Overpass | Cache detected footprints server-side keyed by rounded lat/lng; add client Query cache |
| Results recompute | `runFullCalculation` re-executes on render-path changes — memoize by input hash (useMemo/selector) |
| Bundle | `rollup-plugin-visualizer` audit; verify cobe/framer-motion don't leak into non-Landing chunks; Landing target < 200 KB gz (MASTER_PLAN) |
| Images/tiles | Esri tiles dominate Map paint — correct; just ensure `loading="lazy"` on Landing imagery |
| PWA | Verify service worker doesn't cache `api/` responses (stale payment status would be a bug) |

## 12. Testing Strategy

1. **Unit (Vitest)** — keep existing; add: battery-calc, discom-rates, time-of-use, osm-buildings (point-in-polygon + area math with fixtures), format.ts, subsidy slabs.
2. **API integration** — test payment routes against Razorpay test keys with a mocked/branch DB: order→verify→status happy path, forged-signature rejection, replayed verify, restore by payment id. This is the revenue path; it gets the most tests.
3. **Engine cross-validation** — one fixture set (5 sites across India) run through both TS and Python engines; assert ≤5% divergence. Runs in CI; blocks drift (MASTER_PLAN Stage 3 gate, but the harness is cheap to build now).
4. **E2E (Playwright)** — existing `flow.spec.ts` promoted to CI: land → search → trace → results → paywall visible. Add post-Stage-0: refresh-survival and forged-localStorage-stays-locked.
5. **CI (GitHub Actions)** — on PR: typecheck + vitest + build; nightly: Playwright + engine cross-validation. No merge to `main` without green.

## 13. Security Improvements

| # | Issue | Fix |
|---|---|---|
| S1 | Forgeable client unlock (critical) | Server-authoritative payments (Stage 0, backlog C-2) |
| S2 | No input validation on API bodies beyond ad-hoc checks | zod schemas per route (`_lib/validate.ts`) |
| S3 | Rate limiting ineffective | Durable limiter; per-IP + per-session keys; stricter caps on `payment/*` and `leads` |
| S4 | Lead PII emailed in plaintext, retained in inbox | Move PII to DB with RLS; email becomes notification without full PII; DPDP Act alignment (MASTER_PLAN §6) |
| S5 | No auth → no audit trail | Supabase Auth + `payments`/`lead_assignments` rows give attributability |
| S6 | Env hygiene | Server-only secrets (`RAZORPAY_KEY_SECRET`, `RESEND_API_KEY`, future service role) never in `VITE_*`; add a CI grep guard |
| S7 | Webhook gap | Add Razorpay webhook endpoint (signature-verified) as source of truth for payment events, not just the browser callback |
| S8 | CORS/headers | Add explicit security headers (`vercel.json`): HSTS, X-Content-Type-Options, frame-ancestors |

## 14. Deployment Improvements

1. **CI gate before Vercel build** (§12.5) — the June deploy-failure streak (missing dep, runtime mismatch, type errors) would all have been caught by `tsc && vite build` in CI.
2. **Preview environments per PR** (Vercel default — keep) + Supabase branch databases for schema changes.
3. **Env var parity check** — a `scripts/check-env.ts` run at build start that fails fast listing missing required vars (deploys currently fail late or silently degrade).
4. **Repo hygiene** — gitignore + remove build artifacts (`*.tsbuildinfo`, `lint-results.*`), move `prd_raw.xml`/Stitch export to `docs/reference/`.
5. **Sentry releases** — tag releases with git SHA in build so Sentry errors map to deploys.
6. **Region** — pin Vercel functions + Supabase to Mumbai (`bom1` / ap-south-1) — users and Razorpay are India-based; also a DPDP data-residency story (MASTER_PLAN §6).

## 15. Recommended Implementation Order

Maps directly onto MASTER_PLAN Stage 0; architecture work interleaves rather than preceding it:

```
0. CI pipeline + repo hygiene + env check          (half day — do first, protects everything after)
1. Supabase wiring: migration applied, api/_lib/supabase.ts,
   sessions persisted (anonymous session_token flow)
2. Server-authoritative payments (+ webhook, + payment route tests)
3. Auth (email+password, roles, claim-anonymous-scan flow)
4. Durable rate limiting + NASA/Overpass caching
5. API standardization (zod validation + response envelope) — done WITH items 2–4, not after
6. Store fixes: zustand persist (minus payment flags), TanStack Query adoption for geocode/NASA/status
7. MapPage/ResultsPage decomposition  ← REQUIRED before any Phase 1 feature touches them
8. lib/format.ts + duplicate component consolidation (with UI_REFACTOR_PLAN.md)
9. Engine cross-validation harness (cheap now, mandatory later)
```

Items 1–4 are the Stage 0 gate. Items 5–9 are architecture debt paid alongside, each sized ≤2 days. **Nothing in Phase 1 (executive PDF, confidence score, subsidies) starts before item 7 is done** — those features all land inside ResultsPage.

---

*Audit complete. See GOOGLE_SOLAR_AUDIT.md, MARKETPLACE_AUDIT.md, UI_REFACTOR_PLAN.md, IMPLEMENTATION_BACKLOG.md for the companion documents.*
