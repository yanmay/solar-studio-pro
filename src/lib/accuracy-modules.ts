export interface AccuracyConfig {
  altitudeIrrFactorPer100m: number; // e.g. 0.0075 (+0.75% per 100m)
  tempCoeffPerDegree: number;       // e.g. -0.0035 (-0.35% per °C)
  stcTemp: number;                  // e.g. 25
  cellTempOffset: number;           // e.g. 28
  windCoolingBonusLow: number;      // e.g. 0.0
  windCoolingBonusMod: number;      // e.g. 0.01 (+1% for moderate)
  windCoolingBonusHigh: number;     // e.g. 0.02 (+2% for high/v.high)
  windSurchargeLow: number;         // e.g. 5000 (INR/kWp)
  windSurchargeMod: number;         // e.g. 7500
  windSurchargeHigh: number;        // e.g. 10000
  windSurchargeVeryHigh: number;    // e.g. 12500
  windSurchargeExtreme: number;     // e.g. 15000
}

export const DEFAULT_ACCURACY_CONFIG: AccuracyConfig = {
  altitudeIrrFactorPer100m: 0.0075, // +0.75% per 100m
  tempCoeffPerDegree: -0.0035,      // -0.35% per °C
  stcTemp: 25,                      // 25°C STC
  cellTempOffset: 28,               // cell temp = air temp + 28
  windCoolingBonusLow: 0.0,
  windCoolingBonusMod: 0.01,        // +1%
  windCoolingBonusHigh: 0.02,       // +2%
  windSurchargeLow: 5000,           // ₹5,000/kWp
  windSurchargeMod: 7500,           // ₹7,500/kWp
  windSurchargeHigh: 10000,         // ₹10,000/kWp
  windSurchargeVeryHigh: 12500,     // ₹12,500/kWp
  windSurchargeExtreme: 15000,      // ₹15,000/kWp
};

export interface WindZoneDetails {
  windZone: string;
  windZoneLabel: string;
  surchargePerKwp: number;
  coolingBonus: number;
}

/**
 * Irradiance adjustment based on altitude (+0.5% - 1% per 100m elevation).
 */
export function calculateAltitudeAdjustment(
  elevationM: number,
  baseIrradiance: number,
  config: AccuracyConfig = DEFAULT_ACCURACY_CONFIG
): number {
  if (elevationM <= 0) return baseIrradiance;
  const factor = 1 + (elevationM / 100) * config.altitudeIrrFactorPer100m;
  return baseIrradiance * factor;
}

/**
 * Map wind speed to India IS 875 Part 3 wind zones.
 * Output wind zone, label, CapEx structural surcharge, and cooling yield bonus.
 */
export function calculateWindZoneDetails(
  meanWindSpeedMs: number,
  config: AccuracyConfig = DEFAULT_ACCURACY_CONFIG
): WindZoneDetails {
  // Translate mean wind speed to basic wind speed (mean wind * 10)
  const basicWind = meanWindSpeedMs * 10;

  if (basicWind < 33.0) {
    return {
      windZone: "Zone 1",
      windZoneLabel: "Low",
      surchargePerKwp: config.windSurchargeLow,
      coolingBonus: config.windCoolingBonusLow,
    };
  } else if (basicWind < 39.0) {
    return {
      windZone: "Zone 2",
      windZoneLabel: "Moderate",
      surchargePerKwp: config.windSurchargeMod,
      coolingBonus: config.windCoolingBonusMod,
    };
  } else if (basicWind < 44.0) {
    return {
      windZone: "Zone 3",
      windZoneLabel: "High",
      surchargePerKwp: config.windSurchargeHigh,
      coolingBonus: config.windCoolingBonusHigh,
    };
  } else if (basicWind < 50.0) {
    return {
      windZone: "Zone 4",
      windZoneLabel: "Very High",
      surchargePerKwp: config.windSurchargeVeryHigh,
      coolingBonus: config.windCoolingBonusHigh,
    };
  } else {
    return {
      windZone: "Zone 5/6",
      windZoneLabel: "Extreme",
      surchargePerKwp: config.windSurchargeExtreme,
      coolingBonus: config.windCoolingBonusHigh,
    };
  }
}

/**
 * Compute monthly cell temperature and temperature coefficient loss multiplier.
 * cell temp = T2M + 28C, apply tempCoeff beyond 25C STC.
 */
export function calculateTemperatureCoefficientLoss(
  t2m: number,
  config: AccuracyConfig = DEFAULT_ACCURACY_CONFIG
): number {
  const cellTemp = t2m + config.cellTempOffset;
  const tempDiff = cellTemp - config.stcTemp;
  if (tempDiff <= 0) return 1.0;
  const lossFactor = tempDiff * config.tempCoeffPerDegree; // negative value
  return Math.max(0, 1 + lossFactor);
}
