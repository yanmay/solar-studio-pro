/**
 * Temperature Derate Calculation Algorithm:
 * cellTemp = t2mCelsius + 28 (ambient + 28°C panel heating)
 * tempCoefficient = -0.35 (% per °C above 25°C)
 * Returns the efficiency multiplier (e.g. 0.86 for 14% loss).
 */
export function calcTemperatureDerate(t2mCelsius: number): number {
  const cellTemp = t2mCelsius + 28;
  const tempCoefficient = -0.35;
  // If cellTemp > 25, the calculation yields a negative value (representing a loss in output).
  // Math.min(0, ...) ensures we only derate the output and don't artificially increase it when cellTemp < 25°C.
  const deratePercent = Math.min(0, ((cellTemp - 25) * tempCoefficient) / 100);
  return 1 + deratePercent;
}
