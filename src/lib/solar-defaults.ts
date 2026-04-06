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

// Validation bounds
export const MIN_AREA_M2 = 5;
export const MAX_AREA_M2 = 50000;
export const MIN_PSH = 2.5;
export const MAX_PSH = 7.5;
export const MIN_ELECTRICITY_RATE = 1;
export const MAX_ELECTRICITY_RATE = 50;
