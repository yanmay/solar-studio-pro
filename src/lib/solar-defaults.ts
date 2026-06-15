// Solar calculation constants — from /constants/solar-defaults.js spec
// Never hardcode these in endpoints or components — always import from here.

export const USABLE_AREA_FACTOR = 0.75;     // 75% of drawn area is usable
export const PANEL_AREA_PER_KW = 8;          // m² needed per kWp installed
export const PANEL_EFFICIENCY = 0.20;        // 20% — standard monocrystalline
export const SYSTEM_LOSSES = 0.14;           // 14% — inverter + wiring losses
export const ELECTRICITY_RATE_INR = 7;       // ₹ per kWh, default
export const EMISSION_FACTOR_KG = 0.82;      // kg CO₂ per kWh, India grid average
export const CO2_PER_TREE_KG_YR = 21.77;     // kg CO₂ absorbed per tree per year
export const SYSTEM_LIFETIME_YRS = 25;       // projection period
export const COST_PER_KW_INR = 45000;        // ₹/kWp installed (India 2024-25 market rate, pre-subsidy)

// ── System cost (turn-key, India residential, MNRE-empanelled installer) ──
// Tiered: smaller systems are pricier per kW (fixed costs amortize).
export const SYSTEM_COST_PER_KW_INR_TIERS = [
  { maxKw: 3, cost: 65000 },     // 1–3 kW: ~₹65k/kW
  { maxKw: 10, cost: 58000 },    // 3–10 kW: ~₹58k/kW
  { maxKw: Infinity, cost: 50000 }, // >10 kW: ~₹50k/kW
];

// ── PM Surya Ghar Muft Bijli Yojana subsidy (Feb 2024 scheme) ──
// 1 kW → ₹30,000 | 2 kW → ₹60,000 | ≥3 kW (residential cap) → ₹78,000
// Source: pmsuryaghar.gov.in
export function calcSubsidyInr(installedKw: number): number {
  if (installedKw <= 0) return 0;
  if (installedKw < 1) return Math.round(30000 * installedKw);
  if (installedKw < 2) return Math.round(30000 + 30000 * (installedKw - 1));
  if (installedKw < 3) return Math.round(60000 + 18000 * (installedKw - 2));
  return 78000;
}

// Validation bounds
export const MIN_AREA_M2 = 5;
export const MAX_AREA_M2 = 50000;
export const MIN_PSH = 2.5;
export const MAX_PSH = 7.5;
export const MIN_ELECTRICITY_RATE = 1;
export const MAX_ELECTRICITY_RATE = 50;
