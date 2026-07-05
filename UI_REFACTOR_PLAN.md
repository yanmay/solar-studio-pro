# UI_REFACTOR_PLAN.md — Design System & UI Debt Inventory

> UI audit performed 2026-07-05. **No redesign is implemented here** — this documents every inconsistency found in the codebase and defines the target design system. Implementation is sequenced in IMPLEMENTATION_BACKLOG.md.

---

## Part A — Inventory of Problems (evidence-based)

### A1. Inconsistent / duplicated components

| Problem | Evidence |
|---|---|
| **Two theme toggles** | `components/ThemeToggle.tsx` (86L) AND `components/ui/animated-theme-toggle-button.tsx` — different animations, both in tree |
| **Three button aesthetics** | shadcn `Button` variants + `ui/chrome-button.tsx` + `ui/liquid-chrome.tsx` + `ui/cta-with-glow.tsx` — no documented rule for when to use which |
| **Orphan/unclear components** | `ui/incident-report-middle.tsx` (241L — name matches nothing in a solar product), `ui/snappy-slider.tsx` (409L), `ui/animated-state-icons.tsx` (403L) — imported one-offs pasted from component libraries |
| **INR/number formatting duplicated** | `toLocaleString`/₹ formatting re-implemented in 10+ files (pages, InstallerMarketplace, Testimonials, chart.tsx, battery-calc…) — no shared `formatINR()` |
| **Two icon systems** | lucide-react (correct, everywhere) + **Material Symbols font** loaded globally in `index.css` but used only in `ResultsPage.tsx` — a whole icon font for one page |
| **Loading states differ per page** | `RouteFallback` spinner (App), skeletons (Results), ad-hoc spinners (Map dialogs) — no shared pattern |

### A2. Inconsistent spacing

- **`space-x-*`/`space-y-*` used 67 times across pages** (MapPage 16, Landing 14, MarketInsights 12…) while other sections of the same pages use `gap-*` — two spacing systems interleaved, sometimes on sibling elements.
- **373 arbitrary values** (`[13px]`, `[#hex]`, `[42px]`…) in pages alone — off-scale spacing that can't be themed.
- Card paddings vary between `p-4`, `p-5`, `p-6`, `p-[18px]` for visually identical card types on the same page.

### A3. Typography issues

- **7 font families load on first paint**: Outfit, Plus Jakarta Sans, JetBrains Mono, Fraunces, Inter, DM Serif Display, Material Symbols (3 Google Fonts requests in `index.css`). Design guideline maximum is 2. This is both a brand problem and a ~300 KB render-blocking cost.
- Font assignment is contradictory: base body = Plus Jakarta Sans, headings = Outfit, but `--font-editorial-serif` (Fraunces) and `--font-editorial-sans` (Inter) power a parallel "editorial" system used by some sections; DM Serif Display floats free.
- No type scale — headings use ad-hoc `text-3xl`/`text-4xl`/`text-[42px]` per page rather than tokens.
- Financial figures don't use tabular numerals (`tabular-nums`) — numbers jitter in charts/counters.

### A4. Color inconsistencies

- **Three token systems coexist in `index.css` (838 lines):**
  1. Editorial palette (`--color-forest-ink`, `--color-sage-wash`, `--color-linen`… — hex)
  2. shadcn HSL semantic tokens (`--background`, `--card`, `--accent`… — HSL triplets)
  3. `sunpower-*` utility classes (used in 15 files) + `--brand-gradient-hero` (orange→amber→yellow)
- **Hardcoded Tailwind palette colors in 20+ files** (`bg-white`, `text-gray-*`, raw hex) including 6 of 7 pages — these ignore dark mode.
- The forest/sage/linen palette and the orange solar gradient are **two different brand identities** living in one stylesheet.
- Dark mode: hardcoded colors mean sections of Results/MarketInsights/PolicyTracker don't invert correctly.

### A5. Animation inconsistencies

- Three animation systems: framer-motion (5 components), **18 `@keyframes` in index.css**, and 8 inline `animate-[...]` arbitrary utilities. No shared duration/easing tokens — durations range 0.15 s–3 s arbitrarily.
- Landing is animation-heavy (globe, liquid chrome, glow CTAs) while Results — the page users pay on — has almost none, inverting where polish should live.
- No `prefers-reduced-motion` handling anywhere.

### A6. Poor mobile experiences

- **Polygon tracing on touch**: small vertex hit targets, no undo/redo, no tap-to-insert vertex — the core interaction is desktop-tuned (known issue, PROJECT_STATE §2.2).
- Results metric grid overflows horizontally on ≤360 px widths (arbitrary min-widths on metric cards).
- MapPage toolbars stack awkwardly on small screens; voice search button can overlap the Leaflet attribution.
- Paywall dialog exceeds viewport height on small phones — pay button can be off-screen (revenue-critical).
- 7-font payload hurts most on mobile connections — India-first product on 4G.

### A7. Accessibility issues

- **aria/sr-only usage: MapPage 24, ResultsPage 1, LandingPage 1, all other pages 0.** Charts have no text alternatives; metric cards are unlabeled `div`s; PolicyTracker/MarketInsights interactive filters have no ARIA states.
- Hardcoded `text-gray-*` on tinted backgrounds produces multiple likely WCAG AA contrast failures (needs contrast pass at implementation).
- Focus states: default ring removed in places by custom buttons (`chrome-button`) without replacement.
- No skip-to-content link; Leaflet map traps keyboard focus.
- i18n exists for 5 locales but `lang` attribute isn't updated on switch — screen readers read Hindi text with English phonetics.

### A8. Where the UI feels AI-generated

1. **Component-library patchwork** — `liquid-chrome`, `cta-with-glow`, `snappy-slider`, `incident-report-middle`, cosmic-404 globe are pasted showcase pieces with unrelated aesthetics (chrome/glossy vs editorial serif vs solar orange).
2. **Testimonials** — generic names/photos placeholder pattern.
3. **Landing over-decorated, product under-designed** — glow buttons and 3D globe on Landing vs default shadcn styling on the pages that do the actual work (Map, Results).
4. **Brand identity split**: "SUNPOWER LINK" (PDF, i18n locales, lead form, payment desc) vs "SolarScan AI" — found in 10+ files; MASTER_PLAN already ruled: **SolarScan AI wins**.
5. Stock badge/rating stars on hardcoded installer cards (fake-looking social proof).
6. Inconsistent copy voice: marketing-speak on Landing, terse labels on Map, formal-legal on Privacy.

---

## Part B — Target Design System (define once, then implement)

### B1. Brand
- **Name:** SolarScan AI everywhere (UI, PDF, email, i18n strings, `index.html` meta, payment descriptors). Kill "SUNPOWER LINK" and the `sunpower-*` class prefix in the same pass.
- **Personality:** precise, trustworthy, sunlit. An instrument, not a brochure.

### B2. Color (3–5 total, semantic tokens only)

| Token role | Choice | Notes |
|---|---|---|
| Primary / brand | **Solar amber** `hsl(28 95% 52%)` | From the existing hero gradient — keep one stop, drop the gradient as a default |
| Neutrals (3) | Warm off-white bg `hsl(30 15% 98%)`, card white, deep charcoal fg `hsl(24 15% 12%)` | Already the shadcn base — keep |
| Success accent | Green `hsl(142 70% 40%)` | Savings/CO₂ positives; already exists as `--color-success` |
| (Info blue stays only for charts) | `hsl(215 80% 55%)` | Chart series, never UI chrome |

Rules: **delete the editorial forest/sage/linen palette entirely**; all component color via shadcn semantic tokens (`bg-background`, `text-foreground`, `text-primary`…); zero raw hex/`bg-white`/`text-gray-*` in components; gradients only as the single hero accent, nowhere else.

### B3. Typography (2 families)
- **Sans (UI + headings): Plus Jakarta Sans** — already the body font, humanist, good Devanagari pairing behavior.
- **Mono (data): JetBrains Mono** — already used for figures; add `tabular-nums` for all financial numbers.
- **Remove: Outfit, Fraunces, Inter, DM Serif Display, Material Symbols** (port the one ResultsPage usage to lucide).
- Type scale tokens: `display / h1 / h2 / h3 / body / small / caption` mapped to Tailwind sizes with `text-balance` on headings; `leading-relaxed` body.

### B4. Spacing & layout
- **`gap-*` only** — migrate all 67 `space-*` usages; forbid new `space-*` via convention (and a lint rule if cheap).
- Spacing scale only (`p-4`, `p-6`, `gap-2/4/6/8`) — eliminate the 373 arbitrary values except genuinely irreplaceable ones (Leaflet overlay offsets).
- Card anatomy standard: `rounded-lg border bg-card p-6` (one card, everywhere).
- Flexbox first; grid only for 2D layouts (metric grid, dashboard).

### B5. Components
- **Buttons:** shadcn `Button` variants only. Fold the glow-CTA into `variant="hero"` used exactly once per page; **delete** `chrome-button`, `liquid-chrome`.
- **Delete orphans:** `incident-report-middle`, `snappy-slider`, `animated-state-icons` (after confirming zero imports at implementation time).
- **One ThemeToggle** (keep the better-animated one, delete the other).
- **Shared primitives to create:** `StatValue` (formatted number + label + tabular-nums), `SectionHeader`, `LoadingState` (skeleton-based, replaces ad-hoc spinners), `EmptyState`.
- `lib/format.ts` — `formatINR`, `formatKWh`, `formatArea`, `formatYears` used by every component and the PDF.

### B6. Motion
- Tokens: `duration-fast 150ms / base 250ms / slow 400ms`, one easing (`ease-out`); framer-motion only for orchestrated sequences (page transitions, globe), CSS transitions for everything else; delete unused keyframes from index.css (audit the 18); respect `prefers-reduced-motion` globally.
- Move polish budget from Landing to the paid surface: Results number count-ups, chart draw-in — subtle, once.

### B7. Accessibility baseline (definition of done for every refactored component)
- Interactive elements: accessible name + visible focus ring.
- Charts: `aria-label` summary + data table fallback (sr-only).
- Contrast AA verified for all token pairs (once, at token level — the point of tokens).
- `lang` attribute synced to locale switcher.
- Skip-to-content link; Leaflet keyboard-trap mitigation (documented escape hatch).
- Paywall dialog: max-height + internal scroll so the pay button is always reachable.

### B8. Implementation sequence (matches backlog; do NOT redesign ad hoc)

```
1. Token consolidation: one palette, two fonts, index.css slimmed  (unblocks everything)
2. Brand rename pass (SolarScan AI): i18n strings, PDF, payment descriptor, meta
3. lib/format.ts + StatValue/LoadingState primitives
4. Component deletions/merges (buttons, toggles, orphans)
5. Page-by-page token migration: Results → Map → Landing → Insights/Policy/Privacy
   (Results first — it's the paid surface — and only AFTER its decomposition, C-1)
6. Mobile trace UX (vertex handles, undo) — its own feature task, not a styling pass
7. Accessibility sweep per B7 as each page is touched (not a separate big-bang)
```

Standing rule: **no new UI may use raw colors, `space-*`, off-scale values, or non-system fonts.** Every PR touching a page migrates that page's violations opportunistically.
