/**
 * IS 875 Part 3 Wind Zone Mapping:
 * ws10m < 17 m/s → Zone 1 (Low) → label: "Low Wind Zone"
 * ws10m 17–20 m/s → Zone 2 (Moderate) → label: "Moderate Wind Zone"
 * ws10m 20–25 m/s → Zone 3 (High) → label: "High Wind Zone"
 * ws10m > 25 m/s → Zone 4 (Very High) → label: "Very High Wind Zone"
 */
export function classifyWindZone(ws10m: number): { zone: number; label: string } {
  if (ws10m < 17) {
    return { zone: 1, label: "Low Wind Zone" };
  } else if (ws10m <= 20) {
    return { zone: 2, label: "Moderate Wind Zone" };
  } else if (ws10m <= 25) {
    return { zone: 3, label: "High Wind Zone" };
  } else {
    return { zone: 4, label: "Very High Wind Zone" };
  }
}

/**
 * Calculates the wind structure cost adder (INR per kWp) based on classified zone.
 * Zone 1 → ₹0/kWp (standard mounting)
 * Zone 2 → ₹3,000/kWp (enhanced clamping)
 * Zone 3 → ₹8,000/kWp (heavy-duty structure)
 * Zone 4 → ₹15,000/kWp (specialized anchoring)
 */
export function calcWindCostAdder(zone: number): number {
  switch (zone) {
    case 1:
      return 0;
    case 2:
      return 3000;
    case 3:
      return 8000;
    case 4:
      return 15000;
    default:
      return 0;
  }
}
