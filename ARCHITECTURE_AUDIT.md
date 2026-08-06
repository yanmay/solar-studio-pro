# SolarScan AI / SUNPOWER LINK — Engineering Audit & Optimization Blueprint
**Date:** July 14, 2026  
**Auditor:** Tabbit Browser Automation Agent  
**Objective:** Transition the codebase from a lightweight, client-side estimator into an enterprise-grade utility achieving **98%+ accuracy** in satellite-derived rooftop solar assessments compared to manual physical site scans.

---

## Part 1: Detailed Codebase & Architectural Analysis

### 1.1 Summary of Found Core Systems
Based on a exhaustive deep-scan of the codebase, we mapped out the following five active systems:
1. **Frontend (SPA):** React 18 / Vite / TypeScript. Heavy-duty views are code-split via React Lazy but rely heavily on single-file monoliths (e.g., `MapPage.tsx` at ~2.3k lines and `ResultsPage.tsx` at ~1.7k lines). Uses standard **shadcn/ui** alongside experimental visual structures like `cobe` 3D globes and custom inline CSS variables.
2. **Backend Serverless (Vercel Node.js):** Custom proxying endpoints in `api/` that handle geocoding (`api/geocode.ts`), meteorological lookups (`api/solar-data.ts`), payment flows with Razorpay HMAC validation (`api/payment/*`), and lead ingestion via Resend (`api/leads.ts`).
3. **Database Layer (Supabase):** 11 tables defined in SQL migration files (such as `profiles`, `analysis_sessions`, `rooftop_sections`, and `payments`). 
   * *Critical Discovery:* Fully designed with Row-Level Security (RLS) but **completely decoupled** from the runtime client. No Supabase client libraries are imported in `src/` to persist real user data. Every client-side scan is fully ephemeral.
4. **Calculations Core (`src/lib/`):** Pure mathematical algorithms written in TypeScript (`solar-calc.ts`, `panel-layout.ts`, `battery-calc.ts`, `discom-rates.ts`, `time-of-use.ts`).
5. **Python Solar Engine (`solar_engine.py`):** A physical-grade 199-line execution model using `pvlib`. It reads raw coordinate variables and weather inputs via `stdin` and writes full physical profiles to `stdout`.
   * *Critical Discovery:* It is completely isolated; the actual production site runs a simplified TypeScript port (`solar-calc.ts`) instead.

---

## Part 2: Technical Bugs, Design Flaws, & Edge-Case Vulnerabilities

Our deep-code inspection identified several severe bugs and structural flaws across the pipeline:

### 2.1 Critical Security & Integrity Flaws
* **Ephemeral Scan State & Client-Auth Loophole (T0-1 & T0-2):** Scan session state is managed on-the-fly and persisted purely via client `localStorage` or encoded into URL search queries (`scan-url.ts`). A user can easily bypass the paywall and forge an unlocked report state because the state check occurs client-side.
* **Direct Nominatim Policy Violation (T0-3):** While geocoding relies on the `/api/geocode` proxy, `MapPage.tsx` contains hardcoded browser-side calls hitting `nominatim.openstreetmap.org` for reverse lookups. Under high traffic, this violates Nominatim's strict usage policy (which forbids client-side calls without customized user agents), leading to silent CORS blocks or complete IP bans.
* **Non-Durable Rate Limiter:** The Vercel function `api/_utils/rate-limit.ts` uses an in-memory Map. On Vercel serverless functions, these reset on every cold start and are isolated to individual lambda instances. This allows attackers to bypass rate limits by spinning up requests across multiple instances.

### 2.2 Deep Financial Model Discrepancies (The Triplication Bug)
The codebase has three different calculation modules that disagree mathematically on critical performance numbers:
1. **Canonical Engine (`solar-calc.ts`):** Uses tiered ₹/kWp costs, calculated losses, customized local DISCOM tariffs, and standard PM Surya Ghar subsidies.
2. **Market Insights Page (`MarketInsightsPage.tsx`):** Implements an independent, hardcoded model with a static cost basis (₹52k/kWp vs canonical ₹45k/kWp), hardcoded global solar yields (4.2 kWh/kW/day over exactly 330 days), and mock subsidies (e.g., "Delhi GBI" flat ₹10k) that directly contradict the canonical engine.
3. **Python Engine (`solar_engine.py`):** Computes physics-grade hourly yield tables using system losses and wind derating, which are never matched or reconciled against the TypeScript-based outputs.
* *Result:* The exact same address and roof size will display wildly conflicting payback periods, system yields, and capital expenses depending on which page the user views.

### 2.3 Math & Calculation Inaccuracies
* **The "Flat Roof" Assumption (No Pitch Correction):** The TypeScript engine uses plan area directly (`usableArea = planArea * 0.75`). If a roof is pitched, the flat satellite plan view underrepresents the actual physical area. The calculated area will be off by a factor of $1 / \cos(	heta)$, where $	heta$ is the pitch angle. For a standard 20° pitched roof, this underestimates the actual area by **~6.4%**.
* **Coarse Shading Buckets:** Shading is treated as a manual 3-level select field mapping to flat loss parameters (0%, 15%, or 30%). It does not evaluate dynamic shadow footprints from surrounding buildings, despite fetching OpenStreetMap neighbor elevations (`approxLevels`) in `osm-buildings.ts`.
* **Zero Obstruction Recognition:** Flat concrete roofs in India are filled with structural obstructions (water storage tanks, parapet walls, staircase cabins, and HVAC vents). By relying entirely on outer-edge polygon traces, the system over-allocates usable area, frequently overestimating capacity by **15% to 40%**.

---

## Part 3: Why Satellite Scans Diverge from Manual site Scans

To achieve 98% scan accuracy, we must bridge the gap between satellite estimations and manual surveys. Manual site surveyors measure variables that satellite models typically ignore:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      SATELLITE SCAN ACCURACY GAP                       │
├───────────────────┬────────────────────────────────────────────────────┤
│ Manual site Scan  │ Satellite Scan Limitations (Current Stack)         │
├───────────────────┼────────────────────────────────────────────────────┤
│ Roof Pitch        │ Flat plan-view tracing underestimates area by      │
│ (Inclinometer)    │ 1/cos(theta) on pitched roofs.                     │
├───────────────────┼────────────────────────────────────────────────────┤
│ Obstructions      │ Water tanks, AC units, and vents are ignored,      │
│ (Laser Measure)   │ causing over-allocation.                           │
├───────────────────┼────────────────────────────────────────────────────┤
│ Shading Profile   │ Simple loss percentages instead of calculating solar  │
│ (Solmetric SunEye)│ path blocking from neighboring structures.         │
├───────────────────┼────────────────────────────────────────────────────┤
│ Structural Integrity│ Weight limitations are unchecked, which may      │
│ (Visual Check)    │ disqualify heavy mounting structures.              │
└───────────────────┴────────────────────────────────────────────────────┘
```

---

## Part 4: Technical Blueprint to Reach 98%+ Accuracy

To systematically eliminate these inaccuracies, we recommend implementing the following high-value features and engineering modifications:

### 4.1 Step 1: Implement Plan-Area Pitch Correction
Adjust the area calculation formula in `calcUsableArea` in `src/lib/solar-calc.ts` to support pitch-angle inputs:
$$	ext{Usable Area} = rac{	ext{Plan Area} \cdot 	ext{Usable Area Factor}}{\cos(	heta)}$$
* *Implementation:* Add a slider to the UI representing the roof pitch (0° to 45°). Pass this pitch angle to the frontend calculation engine to scale the usable area, immediately recovering the ~6% to 15% area loss on pitched roofs.

### 4.2 Step 2: Implement Neighbor Shadow Profiling (Horizon Shading)
The OpenStreetMap Overpass client `osm-buildings.ts` already extracts the height (`building:levels`) of neighboring structures under the `approxLevels` property, but this data is currently discarded.
* *Implementation:* Build a geometric solar-path algorithm. For any detected neighbor polygon within a 30-meter radius, calculate its azimuth and elevation angles relative to the target roof. Use its height (assuming a standard 3.0 meters per level) to calculate monthly sun-path blocking. Apply these dynamic monthly shading losses instead of using a flat manual percentage.

### 4.3 Step 3: Integrate the Python `pvlib` Engine
The standalone `solar_engine.py` script is highly accurate, utilizing physics-grade irradiance modeling and temperature-dependent losses.
* *Implementation:* Deploy the Python script as a serverless Vercel Python Function (`api/solar-calculation-engine.py`). For paid, high-precision reports, direct the client to send the roof footprint, pitch, and orientation to this endpoint. This replaces simple monthly PSH estimations with hourly POA (Plane of Array) simulations, ensuring the calculated output is nearly identical to manual site calculations.

### 4.4 Step 4: Implement Satellite Imagery Scale Calibration
When users utilize the "Photo Fallback" feature (`roof-from-photo.ts`), they upload an image to predict roof boundaries. This fallback is highly prone to scale errors because it relies on manual user inputs for calibration.
* *Implementation:* Require the user to trace a known reference length in the image (such as an exterior doorway, standard parking space, or brick wall). Use this reference length to calibrate the pixel-to-meter ratio, stabilizing the area estimate.

### 4.5 Step 5: Unify the Financial Engines
* *Implementation:* Refactor `MarketInsightsPage.tsx` to completely remove its hardcoded calculations. Import and call the shared methods in `src/lib/solar-calc.ts` using a "quick-estimate" preset. This ensures that the Landing, Map, Results, and Insights pages always display identical, consistent financial projections.

---

## Part 5: Phased Execution Roadmap

To roll out these optimizations safely without disrupting the current codebase, we recommend following this 4-step backlog:

### Phase 1: Security, Compliance, & Database Persistence (Immediate)
* Move all direct geocoding requests in `MapPage.tsx` behind the Vercel proxy `/api/geocode`.
* Replace the in-memory rate limiter with a Redis-backed rate limiter (e.g., Upstash) to secure endpoints.
* Import the `@supabase/supabase-js` library into `src/lib/supabase.ts` and wire up scan session saves to persist user scan histories.

### Phase 2: Calculation Accuracy & Pitch Correction
* Update `solar-calc.ts` to support pitch-angle correction.
* Add a roof-type selection dropdown (Flat, Pitched Tiles, Pitched Metal) to the map drawing UI.
* Deploy the `pvlib` Python engine on Vercel to handle high-accuracy paid reports.

### Phase 3: Obstruction Modeling & Horizon Shading
* Integrate neighbor height modeling into the shadow calculation using the retrieved OSM properties.
* Add manual exclusion zones in the map-tracing UI, allowing users to draw holes around obstructions (such as water tanks or HVAC systems) to subtract them from the active panel placement area.

### Phase 4: Verification & Automated Testing
* Set up integration tests to compare TypeScript calculation outputs against the `pvlib` Python engine, ensuring that any variation between the quick preview and the paid report is less than 5%.
* Implement Playwright end-to-end testing to verify the entire user flow: Address Input $ightarrow$ Roof Trace $ightarrow$ Payment Sandbox $ightarrow$ Generated PDF.
