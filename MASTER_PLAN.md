# MASTER_PLAN.md — SolarScan AI

> **The permanent development guide.** This document defines the final commercial vision of SolarScan AI as a SaaS product and the order in which to build it. Read `PROJECT_STATE.md` for the current state of the codebase; read this file for where it is going. Every feature decision should trace back to a section here. Update this file when the vision changes — never let it drift silently.

---

## 1. Product Vision

**SolarScan AI is the operating system for rooftop solar adoption in India.**

One platform, three customers:

1. **Homeowners** get a bank-grade solar feasibility report for their exact roof in under 2 minutes — free preview, paid full report.
2. **Installers** get qualified, exclusive, geo-routed leads plus white-labeled proposal tooling — subscription + per-lead pricing.
3. **Enterprises** (financiers, DISCOMs, housing societies, solar OEMs) get bulk rooftop assessment, portfolio analytics, and API access — contract pricing.

**North-star metric:** paid full reports generated per month.
**Positioning:** "Project Sunroof for India" — accuracy-first, subsidy-aware, installer-connected.

**Brand decision (final):** the product is **SolarScan AI**. Retire "SUNPOWER LINK" from PDF, email, and copy. Domain strategy: `solarscan.ai` primary (or equivalent), `sunpowerlink.in` redirects.

---

## 2. Complete Feature Roadmap

Phases are cumulative. A phase is "done" when its acceptance line is true in production.

### Phase 0 — Foundation Hardening (current)
The app must stop being ephemeral before anything commercial is built.

| Feature | Detail |
|---|---|
| Supabase wiring | Apply the 11-table migration; persist `analysis_sessions`, `rooftop_sections`, `solar_reports` |
| Server-authoritative payments | Razorpay orders/verifications recorded in `payments`; unlock read from DB, never localStorage |
| Auth | Supabase Auth (email + password); roles: homeowner / installer / admin via `profiles` |
| Durable rate limiting | Replace in-memory limiter (Supabase table or Upstash) |
| NASA POWER cache | `nasa_power_cache`, 30-day TTL, keyed by rounded lat/lng |
| Brand unification | SolarScan AI everywhere: UI, PDF, email, meta tags |

**Acceptance:** a scan survives a browser wipe; a forged localStorage flag cannot unlock a report; an installer can create an account.

### Phase 1 — Homeowner Product (monetization v1)

| Feature | Detail |
|---|---|
| Scan history | Logged-in homeowners see all past scans (`/my/scans`) |
| Executive PDF report | Multi-page: suitability score, investment grade (A+–D), 25-yr cashflow table, monthly production chart, subsidy breakdown, AI narrative summary (build from the Stitch design reference) |
| Confidence score v1 | Composite score (source × polygon quality × irradiance quality) surfaced in Results + PDF |
| State subsidies | `subsidy_schemes` table wired; state-level schemes stacked on PM Surya Ghar |
| Financial upgrades | LCOE, IRR, NPV, tariff-escalation scenarios (schema fields already reserved) |
| Share & compare | Share URL (exists) + side-by-side comparison of two system configurations |
| WhatsApp report delivery | Send PDF link via WhatsApp Business API (dominant channel in India) |

**Acceptance:** a homeowner pays once and receives an executive-grade PDF with a confidence score; conversion funnel is instrumented end-to-end in Plausible.

### Phase 2 — Installer Marketplace (monetization v2)

| Feature | Detail |
|---|---|
| Installer onboarding | GSTIN-validated signup, MNRE certification upload, service pincodes, approval queue for admin |
| Lead routing engine | `lead_requests` → max 3 matched installers by pincode; 7-day expiry; funnel: delivered → viewed → contacted → quoted → won/lost |
| Installer dashboard | Lead inbox, funnel board, profile, subscription management, response-time SLA indicators |
| Lead pricing | Per-lead debit (paise-precision, schema-ready) against a prepaid wallet or subscription quota |
| Installer reputation | Verified reviews from converted homeowners; response-rate and win-rate badges |
| Replace affiliate cards | `InstallerMarketplace.tsx` hardcoded partners → live marketplace of onboarded installers (keep affiliates as backfill in uncovered pincodes) |

**Acceptance:** a homeowner lead reaches 3 installers' dashboards within 60 seconds; installers pay for leads; admin can approve/suspend installers.

### Phase 3 — Accuracy Moat

| Feature | Detail |
|---|---|
| Python engine as a service | Deploy `solar_engine.py` (pvlib) as a Vercel Python function; hourly POA simulation; TS model stays as instant preview |
| Pitch-corrected area | Roof type + pitch input; plan area ÷ cos(tilt) |
| Horizon shading | Sun-path obstruction from OSM `building:levels` (already fetched, unused) |
| P50/P90 yield bands | Uncertainty from NASA POWER interannual GHI variability |
| ML roof detection | Fine-tuned segmentation (SAM-family) on satellite tiles for one-tap detection where OSM has no footprint; IoU-based confidence |
| Cross-validation CI | Test that binds TS and Python engines within tolerance — prevents model drift |

**Acceptance:** reports show P50/P90 bands; one-tap detection works in areas with zero OSM coverage; both engines agree within 5% on the test fixture set.

### Phase 4 — Enterprise & API (monetization v3)
See §6.

---

## 3. UI Roadmap

### 3.1 Design system (do first, incrementally)
- **One brand, one token set.** Semantic tokens only (`bg-background`, `text-foreground`, etc.); audit and remove hardcoded colors. 3–5 colors: solar amber primary, deep neutral surfaces, one success/positive accent.
- **Typography:** max 2 families (current Geist-style sans + mono for data). Data-dense screens use tabular numerals.
- Consolidate one-off components (`liquid-chrome`, `chrome-button`, `cta-with-glow`) into documented variants or delete them.
- Replace all emoji-as-icons (including PDF `📍`) with lucide icons.

### 3.2 Homeowner surface
| Item | Priority |
|---|---|
| Scan progress stepper (Address → Trace → Analyze → Report) across Map/Results | High |
| Mobile trace UX: large vertex handles, tap-to-insert, undo/redo | High |
| Market Insights + Policy Tracker redesign to Landing-page visual level | Medium |
| Results dark-mode chart audit | Medium |
| Multi-step lead qualification form (replaces single dialog) | High (feeds Phase 2 lead quality) |
| Privacy page styling | Low |

### 3.3 Installer surface (new, Phase 2)
- `/dashboard` shell: sidebar nav (Leads, Pipeline, Profile, Billing, Reports), mobile-first — installers live on phones.
- Lead card anatomy: system size, location (masked until accepted), confidence score, homeowner budget signal, expiry countdown.
- Kanban pipeline board for the lead funnel.
- White-label report theming controls (Phase 4): logo, colors, contact block.

### 3.4 Admin surface (new, Phase 2)
- Installer approval queue, lead dispute resolution, subsidy/tariff config editors (`tariff_configs`, `subsidy_schemes` become admin-editable, not migration-edited).

### 3.5 Structural refactors
- Decompose `MapPage.tsx` (~1,900 lines) and `ResultsPage.tsx` (~1,700 lines) into feature components before adding any new UI to them.
- Route-level code splitting; keep Landing bundle < 200 KB gz.

---

## 4. AI Roadmap

Ordered by ROI, not novelty. Every AI feature must degrade gracefully to the non-AI path.

### 4.1 AI report narrative (Phase 1) — cheapest, highest perceived value
- LLM-generated executive summary per report (`solar_reports.ai_summary`, `ai_roof_insights` — schema-ready): plain-language verdict, risk notes, financing suggestion. Generated server-side at report creation via AI SDK + AI Gateway; cached in the DB (one generation per report, no per-view cost).

### 4.2 Roof intelligence (Phase 3)
- **Satellite segmentation model** for one-tap roof detection (replaces/augments OSM). Start with zero-shot SAM + prompt point, evaluate; fine-tune on Indian rooftop imagery if IoU < 0.85.
- **Obstruction detection** (water tanks, AC units, staircases) to auto-subtract unusable area — currently a silent accuracy gap.
- Existing HF photo-segmentation fallback is maintained but demoted to last resort.

### 4.3 Conversational scan assistant (Phase 3–4)
- Chat entry point: "My address is X, my bill is ₹3,000/month" → assistant runs geocode + scan + config and explains results. Voice search hook (`use-voice-search`) already exists as foundation; extend to Hindi + 4 existing locales.

### 4.4 Lead scoring & routing intelligence (Phase 2–4)
- Score leads (bill size, confidence score, engagement signals) → price leads dynamically and prioritize routing to high-win-rate installers.

### 4.5 Portfolio AI (Phase 4, enterprise)
- Bulk-scan a pincode/city → ranked rooftop opportunity list for DISCOMs/financiers.

**Non-goals:** no chat-with-PDF gimmicks, no AI where a deterministic calculation is correct (financial math stays deterministic pvlib/TS — AI only narrates it).

---

## 5. CRM Roadmap

The CRM is installer-facing and grows from the lead funnel — not a general-purpose CRM.

### CRM v1 (Phase 2) — Lead inbox
- Funnel states from schema: delivered → viewed → contacted → quoted → won/lost.
- Actions: accept/decline, log call outcome, attach quote amount, mark won/lost with reason.
- Notifications: WhatsApp + email on new lead; expiry reminders at T-48h.

### CRM v2 — Pipeline & quoting
- Kanban pipeline; quote builder that reuses the homeowner's actual scan data (system size, layout, financials) → branded proposal PDF in installer identity.
- Homeowner-side status visibility ("2 installers have viewed your request").

### CRM v3 — Post-sale & retention
- Installation milestone tracking (site survey → order → install → net-metering) feeding homeowner notifications.
- Commissioned-system registry → future O&M and monitoring upsell.
- Review collection at commissioning → feeds installer reputation (closes the marketplace flywheel).

### CRM v4 (Phase 4) — Team & territory
- Multi-seat installer accounts with roles (owner/sales/ops), territory assignment, per-seat pricing.
- Export/API + webhook sync to external CRMs (Zoho/Salesforce) for large installers.

---

## 6. Enterprise Features (Phase 4)

| Feature | Buyer | Detail |
|---|---|---|
| Bulk assessment API | Financiers, OEMs | REST API: address/polygon in → full analysis JSON out; API-key metered |
| Portfolio dashboard | DISCOMs, housing societies | Upload address list / draw boundary → ranked rooftop opportunities, aggregate capacity, subsidy exposure |
| White-label deployments | Large installers, OEMs | Tenant layer (new `tenants` table + branding config): custom domain, logo, colors, own Razorpay account; reports carry tenant identity |
| Financing integration | NBFCs, banks | Loan pre-qualification embedded in the report; lender referral fees; requires P50/P90 bands (Phase 3) as underwriting input |
| SLA & compliance | All enterprise | 99.9% uptime target, data-residency in India (Supabase Mumbai region), audit logs, DPDP Act compliance documentation |
| SSO | Enterprise accounts | SAML/OIDC for enterprise dashboards |

**Sequencing rule:** enterprise sales only after Phase 3 accuracy work — enterprise buyers audit the methodology first.

---

## 7. Monetization Strategy

### 7.1 Revenue streams (stacked, in launch order)

| # | Stream | Price point (initial) | Phase |
|---|---|---|---|
| 1 | **Pay-per-report** (homeowner) | ₹99–₹199 per full report | Live now → hardened in Phase 0 |
| 2 | **Homeowner Pro** | ₹499/mo — multi-property, comparisons, priority support (small segment; keep but don't over-invest) | Phase 1 |
| 3 | **Installer subscriptions** | Trial (5 leads) → Basic ₹2,999/mo (15 leads) → Pro ₹7,999/mo (50 leads + white-label proposals) → Enterprise custom | Phase 2 |
| 4 | **Per-lead top-ups** | ₹300–₹800/lead, dynamically priced by system size and confidence score | Phase 2 |
| 5 | **Affiliate backfill** | Existing Loom/Fenice/Tata affiliate links, only in pincodes with no subscribed installer | Ongoing |
| 6 | **Enterprise contracts & API** | ₹50k–₹5L/yr; API metered per assessment | Phase 4 |
| 7 | **Financing referrals** | Per-disbursal fee from lender partners | Phase 4 |

### 7.2 Free tier (the funnel — never paywall these)
Address search, roof trace, system size estimate, headline savings number, CO₂ impact. Paywalled: full financials (payback/IRR/NPV/cashflow), executive PDF, installer connection, battery + TOU detail.

### 7.3 Unit economics guardrails
- Report COGS ≈ ₹0 (cached NASA data, client-side PDF) → pay-per-report is ~pure margin; AI narrative adds < ₹2/report.
- Lead value chain: homeowner pays for report → same scan becomes a lead sold to ≤3 installers → one scan can yield ₹99 + 3×₹500. Protect lead quality (multi-step qualification) above lead volume.
- Razorpay is the single payment rail (subscriptions via Razorpay Subscriptions API).

### 7.4 Pricing principles
- Never price-discriminate the accuracy — every paid report gets full accuracy; tiers differ by volume, tooling, and branding.
- Installer pricing scales with lead *quota*, not features that affect homeowner experience.
- Revisit prices after 500 paid reports of funnel data.

---

## 8. Implementation Order

Strict sequence — each stage funds and de-risks the next. Do not start a stage before the previous stage's gate is met.

```
Stage 0: Foundation Hardening        [Phase 0]  ← YOU ARE HERE
   Gate: server-authoritative unlocks + auth live in production
Stage 1: Homeowner Monetization      [Phase 1]
   Gate: ≥100 paid reports/month OR 3 months elapsed
Stage 2: Installer Marketplace       [Phase 2]
   Gate: ≥20 subscribed installers, lead SLA < 60s
Stage 3: Accuracy Moat               [Phase 3]
   Gate: P50/P90 shipping; engines cross-validated in CI
Stage 4: Enterprise & API            [Phase 4]
```

### Stage 0 detail (immediate sprint — mirrors PROJECT_STATE.md §9)
1. Supabase foundation (migration applied, sessions persisted)
2. Server-side payment truth
3. Auth + roles
4. Durable rate limiting + NASA cache
5. Brand unification pass

### Stage 1 detail
6. Executive PDF (Stitch design) + AI narrative
7. Confidence score v1 in Results + PDF
8. State subsidy engine + LCOE/IRR/NPV
9. Scan history + WhatsApp delivery
10. Funnel instrumentation + pricing experiment (₹99 vs ₹199)

### Stage 2 detail
11. Installer onboarding + admin approval queue
12. Lead routing engine + CRM v1 inbox
13. Lead wallet/quota billing
14. Marketplace UI replaces affiliate cards (affiliates as backfill)
15. Multi-step lead qualification form

### Stage 3 detail
16. Python pvlib service + hourly simulation
17. Pitch correction + horizon shading
18. P50/P90 bands + engine cross-validation CI
19. ML roof detection pilot (top-10 metro coverage first)

### Stage 4 detail
20. Tenant/white-label layer
21. Bulk API + portfolio dashboard
22. Financing partner integration
23. SSO, audit logs, compliance pack

### Standing engineering rules (apply during every stage)
- Decompose `MapPage.tsx` / `ResultsPage.tsx` before adding features to them.
- Every new calculation gets a unit test; every payment path gets an integration test.
- No new feature may read unlock/payment state from the client.
- Nominatim/Overpass calls go through cached proxies — never direct from new code.
- Keep `PROJECT_STATE.md` updated at the end of each stage; keep this file updated when the vision changes.

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| OSM coverage gaps stall auto-detect in Tier-2/3 cities | Manual trace is always first-class; ML detection in Stage 3 |
| Subsidy policy changes (PM Surya Ghar revisions) | `subsidy_schemes` is admin-editable data, not code |
| Installer chicken-and-egg (no installers → no lead value) | Affiliate backfill keeps homeowner UX complete from day one |
| Free-tier scraping / API abuse | Durable rate limiting (Stage 0), API keys for programmatic access |
| Accuracy disputes damaging trust | Confidence score + P50/P90 bands set honest expectations; disclaimers in every report |
| Razorpay dependency | Abstract payment provider behind `api/payment/*` interface; UPI-first alternatives evaluated at Stage 2 |

---

*Last updated: 2026-07-05. Owner: project maintainer. Changes to vision, pricing, or stage gates must be reflected here in the same PR.*
