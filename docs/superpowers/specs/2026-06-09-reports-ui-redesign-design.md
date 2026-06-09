# Reports UI Redesign Specification

**Date**: 2026-06-09  
**Topic**: Reports Section UI Redesign matching shared Premium HTML templates  
**Status**: Approved  

---

## 1. Goal & Context
The current Reports section UI is basic and needs to be completely updated to match the high-end, premium design aesthetics provided in two target HTML templates:
1. `stitch_solar_intelligence_report_executive_summary (1)/code.html` (Locked / Teaser state)
2. `stitch_solar_intelligence_report_executive_summary/code.html` (Unlocked / Premium state)

The redesign will support dynamic loading from the Zustand store's scan data, calculate solar performance metrics dynamically, and preserve the interactive ROI Tuning console. All financial metrics will be strictly in Indian Rupees (₹) and savings projections will represent a 5-to-25-year timeline.

---

## 2. Requirements & UI Specification

### A. General Design & Layout
* **Themes & Fonts**: Dark mode themed by default (`bg-background text-on-surface`). Fonts configured to use `Inter`.
* **Aesthetics**: Glassmorphism (`backdrop-blur-md`), dark backgrounds (`bg-surface-dim`), subtle borders (`border-white/5`), and high-end orange-to-amber gradients.

### B. Report Teaser (Locked State)
* **Title & Subtitle**: Dynamic address loading from scan data (e.g. `1420 Horizon Ridge Parkway` or coordinates) with preliminary report description.
* **AI Summary Card**: Left-aligned card describing unshaded roof area and energy offset.
* **Teaser Metric Cards**:
  1. Est. System Size (kW) - computed dynamically.
  2. Annual Production (kWh) - computed dynamically.
  3. 25-Yr Savings (₹) - formatted in Lakhs (e.g., `₹45L+` or dynamic calculation in ₹).
* **Blurred Paywall Overlay**:
  * Blurred Cumulative Cash Flow Projection container.
  * Upgrade CTA: "Unlock Your Full Solar Intelligence Report".
  * Action button: "Unlock Report — ₹149".
  * Security check tag: "Secure checkout. Immediate access."

### C. Checkout Dialog Modal
* Triggered by clicking the "Unlock Report" button in the paywall overlay.
* Opens a clean React `<Dialog>` modal.
* **Plan Selector**: Toggle between "Pay-Per-Scan" (₹149) and "Pro Plan Monthly" (₹999).
* **Payment Tabs**: Switch between "Card" details and "UPI / QR" simulation.
* **Simulation Action**: Clicking payment submission activates processing spinner and updates the Zustand store's `isPaid` state to `true`, instantly lifting the paywall.

### D. Premium Report (Unlocked State)
* **Analyst Recommendation**: Text summary of geospatial solar irradiance and payback viability with a large **98% Confidence Score** meter.
* **Core Metrics Grid**:
  1. **Annual Savings**: Calculated savings in INR.
  2. **Payback Period**: Duration in years (e.g., `4.1 Years`).
  3. **25-Yr Net Gain**: Cumulative savings minus net system cost (in ₹).
  4. **System Capacity**: Dynamic capacity in kWp.
* **ROI Tuning Console**:
  * Placed directly above the cumulative cash flow chart.
  * Sliders for **Electricity Tariff** (₹3 - ₹15 per kWh) and **Active Panels Count** (1 to Max).
  * Toggle group for **Solar Module Efficiency** (450W Compact vs 550W Premium).
* **Cumulative Cash Flow Projection**:
  * Area chart plotting 25-year cumulative cash flow in INR.
  * Dotted break-even marker showing payback year.
* **Financial Outlay Ledger**:
  * Itemized table: Gross Cost, PM Surya Ghar Subsidies, Net Project Cost.
* **System Intelligence Specs Grid**:
  * Cards for Modules, Inverter, and Roof Assumptions.
* **Environmental Impact (25 Yrs)**:
  * Tons of CO2 avoided, trees equivalent.
* **Lead-Gen form**:
  * Dynamic form for getting installer quotes.

---

## 3. Tech Stack & Dependencies
* **Framework**: React / Vite / TailwindCSS.
* **State**: Zustand (`useScanStore`).
* **Icons**: Lucide React + Material Symbols Outlined font.
* **Charts**: Recharts (fully responsive).
* **PDF Export**: jsPDF (configured to download the new premium layout).

---

## 4. Verification Plan
* **CLI Auditing**: Verify the build succeeds and run `squirrel audit` on the local page to check accessibility, SEO, and visual guidelines.
* **Manual Verification**: Run Vitest suite to ensure no regressions, test payment mock flow, and check charts render correctly.
