// Battery / off-grid storage sizing
// For grid-tied systems with backup: size for evening load (6-10 PM).
// For off-grid: size for full overnight autonomy.

import { SYSTEM_LIFETIME_YRS } from "./solar-defaults";

export type BackupMode = "none" | "evening" | "offgrid";

// Typical Indian home consumption split
const EVENING_LOAD_FRACTION = 0.40;   // 40% of daily use happens 6pm-10pm
const AUTONOMY_HOURS_EVENING = 4;
const AUTONOMY_HOURS_OFFGRID = 16;    // overnight + cloudy buffer

// Li-ion battery: ~₹25k per kWh installed in India 2024 (LFP residential)
const BATTERY_COST_PER_KWH_INR = 25000;
const BATTERY_DOD = 0.85;              // depth-of-discharge
const BATTERY_CYCLE_LIFE_YRS = 10;     // replacement every 10 years

export interface BatteryRecommendation {
  mode: BackupMode;
  recommendedKwh: number;
  costInr: number;
  lifetimeCostInr: number;      // includes 1 replacement over 25yr system life
  backupHours: number;
  description: string;
}

/**
 * Recommend battery size given daily generation and backup mode.
 * dailyKwh here is the *home load*, which for a correctly-sized solar system
 * roughly equals the daily generation.
 */
export function recommendBattery(dailyKwh: number, mode: BackupMode): BatteryRecommendation {
  if (mode === "none") {
    return {
      mode,
      recommendedKwh: 0,
      costInr: 0,
      lifetimeCostInr: 0,
      backupHours: 0,
      description: "Grid-tied only — net metering feeds excess back to the grid.",
    };
  }

  let usableKwhNeeded: number;
  let backupHours: number;
  let description: string;

  if (mode === "evening") {
    usableKwhNeeded = dailyKwh * EVENING_LOAD_FRACTION;
    backupHours = AUTONOMY_HOURS_EVENING;
    description = "Covers evening load (6-10 PM) during outages. Runs lights, fans, TV, Wi-Fi, fridge.";
  } else {
    usableKwhNeeded = dailyKwh * 0.90; // 90% of daily load (some goes direct to inverter)
    backupHours = AUTONOMY_HOURS_OFFGRID;
    description = "Full off-grid autonomy — overnight + a cloudy day. Includes AC/kitchen loads.";
  }

  const recommendedKwh = Math.round((usableKwhNeeded / BATTERY_DOD) * 10) / 10;
  const costInr = Math.round(recommendedKwh * BATTERY_COST_PER_KWH_INR);
  // 25-yr lifetime needs ~2.5 replacements (every 10 yrs)
  const replacements = Math.max(0, Math.ceil(SYSTEM_LIFETIME_YRS / BATTERY_CYCLE_LIFE_YRS) - 1);
  const lifetimeCostInr = costInr * (1 + replacements * 0.75); // newer batteries cheaper

  return {
    mode,
    recommendedKwh,
    costInr,
    lifetimeCostInr: Math.round(lifetimeCostInr),
    backupHours,
    description,
  };
}
