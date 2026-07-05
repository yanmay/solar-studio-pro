# GOOGLE_SOLAR_AUDIT.md — Solar Data Pipeline Audit

> Audit of the rooftop/solar data pipeline performed 2026-07-05. Answers: what is actually used, what is accurate, and what the highest-accuracy pipeline for India looks like.

---

## 1. Findings — Question by Question

| Question | Finding |
|---|---|
| Is Google Solar API actually being used? | **No.** Zero references in the entire codebase (`src/`, `api/`, Python, config). No API key, no endpoint, no types. |
| Are rooftop insights accurate? | Accuracy = trace quality. Area math (equirectangular projection, ray-cast point-in-polygon) is sound for small roofs. Truth depends on OSM footprint quality or user tracing skill. **No pitch correction** — plan area is used even for pitched roofs, systematically underestimating usable area by 1/cos(tilt). |
| Are Google building polygons used? | **No.** Building footprints come exclusively from OSM via Overpass (`osm-buildings.ts`, 3-mirror failover, 25 m radius query). |
| Is imagery quality correct? | Basemap is **Esri World Imagery** via Leaflet — good resolution in Indian metros, variable vintage elsewhere. No imagery metadata (capture date/resolution) is surfaced, so users can trace an outdated roof unknowingly. No Google imagery anywhere. |
| Are solar calcs using Google's data correctly? | N/A — no Google data exists in the pipeline. |
| Does fallback logic exist? | **Yes, and it's good:** Overpass 3-mirror failover; NASA POWER → regional PSH table (`india-grid.ts`); HF photo segmentation primary → fallback model; manual trace always available. |
| Is OSM overriding Google incorrectly? | N/A — there is no Google source to override. OSM *is* the only auto-detect source. |
| Is NASA POWER used correctly? | **Mostly yes.** `/api/solar-data` proxies the climatology endpoint; monthly GHI (`ALLSKY_SFC_SW_DWN`) → peak sun hours is a standard, correct simplification. Client-side 24 h in-memory cache keyed by 2-decimal lat/lng (~1.1 km) is reasonable. Gaps: no server-side cache (`nasa_power_cache` table unwired), monthly resolution only, no interannual variability (blocks P50/P90). |
| Is reverse geocoding correct? | **Functionally yes, architecturally no.** Two paths exist: the rate-limited `/api/geocode` proxy AND direct browser calls to `nominatim.openstreetmap.org` inside MapPage (`reverseGeocode`, `geocodeAddress`). Direct client calls violate Nominatim's usage policy (per-IP rate limits, required contactable User-Agent — browsers can't set UA) and risk IP blocks. |
| Is the financial model consistent? | **No — three models exist and disagree:** ① `solar-calc.ts` (canonical: tiered ₹/kW cost, PSH × 365 × (1−losses), DISCOM tariffs, PM Surya Ghar slabs); ② **`MarketInsightsPage.tsx` has its own hardcoded model** (base ₹52k/kW with ad-hoc 58k/45k tiers, flat 4.2 kWh/kW/day × 330 days, flat ₹8.20/kWh, a mock "Delhi GBI" ₹10k subsidy) that contradicts ①; ③ `solar_engine.py` (pvlib hourly, 14% system losses, 97.5% inverter eff, wind derating) — never cross-validated against ①. Same address can show different paybacks on Results vs Market Insights. |

## 2. Limitations of the Current Pipeline (complete list)

1. **No Google Solar API** — and note: Google Solar API coverage in India is effectively absent (it covers primarily US/EU). This is *not* the miss it appears to be; the real gap is items 2–9.
2. **OSM coverage is patchy** outside metros — auto-detect silently fails in Tier-2/3 India, dropping users to manual trace with no explanation of why.
3. **No DSM / elevation data** — roof height, pitch, and orientation are user-guessed (`tilt-azimuth.ts` hints), never measured.
4. **Flat-roof assumption** — no pitch correction of area (underestimates pitched roofs).
5. **Shading is a 3-bucket user guess** (0/15/30% flat loss) — no horizon computation, despite OSM `building:levels` for neighbors already being fetched (`approxLevels`) and discarded.
6. **No obstruction detection** — water tanks, AC units, staircases (ubiquitous on Indian flat roofs) silently inflate usable area.
7. **Monthly irradiance only** — no hourly POA simulation in the deployed path; the pvlib engine that can do it is not deployed.
8. **No uncertainty quantification** — single-point estimates, no P50/P90, no confidence score outside the photo pipeline heuristic.
9. **No imagery vintage awareness** — Esri tile capture date is not checked or shown.
10. **Client-side Nominatim calls** — policy violation + un-rate-limited duplicate path.
11. **Financial model triplication** — Market Insights contradicts the canonical engine (worst kind of inaccuracy: self-inconsistency).
12. **No caching of Overpass/NASA server-side** — repeat scans re-pay full upstream latency and quota.

## 3. Data Source Reliability Ranking (for India)

Ranked by trustworthiness *for this product's use case*:

| Rank | Source | Reliability | Notes |
|---|---|---|---|
| 1 | **Manual polygon trace** | Highest (when careful) | Ground truth from the person who owns the roof; the accuracy ceiling today |
| 2 | **Python engine (pvlib)** | High | Physics-grade hourly simulation; industry standard; currently undeployed |
| 3 | **NASA POWER** | High | 40+ year satellite-derived climatology, global including all of India; ±5–10% monthly GHI |
| 4 | **Esri World Imagery** | Medium-high | Good metro resolution; unknown vintage; trace substrate only |
| 5 | **OSM footprints (Overpass)** | Medium | Excellent where mapped; sparse/outdated in smaller cities; no quality metadata |
| 6 | **Nominatim geocoding** | Medium | Good for Indian cities; weak for unstructured addresses ("near temple, 2nd street"); free-tier rate limits |
| 7 | **TS engine (`solar-calc.ts`)** | Medium | Sound simplified model; monthly resolution; needs cross-validation against pvlib |
| 8 | **HF photo segmentation** | Low-medium | Accuracy hinges entirely on user-supplied reference scale; cold starts |
| 9 | **Google Solar API / Building Insights / DSM / Imagery** | **Unavailable in India** | Would rank #1–2 if coverage existed; monitor for expansion, do not build against it |

## 4. Highest-Accuracy Pipeline Design (recommended)

Principle: **fuse sources by confidence, never let a lower-ranked source silently override a higher-ranked one, and always tell the user which source produced their number.**

### 4.1 Footprint resolution (waterfall)

```
1. Manual trace (if user draws)            → confidence 0.90–0.95
2. OSM footprint w/ point-in-polygon hit   → confidence 0.75
   (reject if footprint vertex count < 4 or area outside 8–2,000 m²)
3. ML segmentation on Esri tile (Phase 3)  → confidence = f(IoU)   [future]
4. Photo estimator                          → existing heuristic 0.4–0.8
Each auto source ALWAYS drops into the manual editor for confirmation —
auto-detect proposes, the user disposes. (Current UX already does this. Keep.)
```

### 4.2 Geometry enrichment
- **Pitch correction:** roof-type question (flat / pitched + slider) → `usable_area = plan_area / cos(tilt)` for pitched. Cheap, immediate accuracy win.
- **Horizon shading:** neighbor obstruction from already-fetched OSM `building:levels` (assume 3 m/level) → sun-path blocking per month → replaces the 15/30% guess with a computed loss. Data is already in `OsmBuildingResult.approxLevels` — currently thrown away.
- **Obstruction subtraction (Phase 3):** ML detection of tanks/AC/stairwells on the tile crop → auto-subtract from usable area.

### 4.3 Irradiance & yield
```
Instant preview  : TS engine (monthly PSH model)      — as today
Paid report      : Python pvlib service (hourly POA,   — deploy solar_engine.py
                   temp derating, measured tilt/azimuth) as a Vercel Python function
Uncertainty      : NASA POWER interannual GHI variance → P50/P90 bands
Cache            : nasa_power_cache (30-day TTL, server-side, keyed rounded lat/lng)
Cross-validation : CI fixture set, TS vs pvlib ≤5% divergence
```

### 4.4 Geocoding
- **All** geocoding through `/api/geocode` (delete direct Nominatim calls in MapPage — move `geocodeAddress`/`reverseGeocode` behind the proxy).
- Add server-side result cache; add a paid fallback (Google Geocoding API or Ola Maps/MapmyIndia — strong Indian address parsing) triggered only when Nominatim returns nothing. This is the one place a Google API *is* worth adding for India.

### 4.5 Financial truth
- **One engine.** `solar-calc.ts` (+ pvlib for paid) is the single financial model. Market Insights' embedded calculator must be refactored to call the canonical functions with a "quick estimate" preset — delete its hardcoded rates, yield factor, and mock Delhi GBI.
- State subsidies move to the `subsidy_schemes` table (admin-editable) per MASTER_PLAN — not hardcoded mocks.

### 4.6 Source interaction summary

```
Address ──► /api/geocode (Nominatim, cached; paid-API fallback)
   │
Tile view (Esri) ──► footprint waterfall (§4.1) ──► manual editor (always)
   │                                                    │
OSM neighbors (levels) ──► horizon shading ─────────────┤
Roof-type input ──► pitch correction ───────────────────┤
   │                                                    ▼
NASA POWER (cached) ──► TS engine (preview) ──► pvlib service (paid, P50/P90)
                                 │                      │
                                 └── cross-validated ───┘
                                            │
                              Confidence score = source × polygon quality
                                            × irradiance quality (shown everywhere)
```

## 5. What NOT to Do

- **Do not integrate Google Solar API now** — no India coverage; building against it produces dead code. Re-evaluate quarterly.
- **Do not replace Leaflet/Esri with Google Maps SDK** — cost per load at marketplace scale, no accuracy gain for tracing.
- **Do not add more fallback data sources** before caching + confidence scoring exist — fusion without confidence weighting just adds noise.

---

*Implementation items from this audit are prioritized in IMPLEMENTATION_BACKLOG.md (financial model unification is Critical; pitch correction and horizon shading are High).*
