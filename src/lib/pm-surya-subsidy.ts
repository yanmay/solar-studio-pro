/**
 * PM-Surya Ghar Muft Bijli Yojana Subsidy Calculation Engine (2024-25 MNRE rules)
 *
 * Q3 fix: Added 10 kWp system-size cap per user-approved spec.
 * Systems > 10 kWp are ineligible regardless of subsidy amount tiers.
 * The free teaser still shows "up to ₹78,000" (marketing copy, intentional).
 * The paid calculator shows the accurate result via this function.
 */

export function calcPMSuryaSubsidy(systemSizeKw: number): number {
  if (systemSizeKw <= 0) return 0;
  // Q3: 10 kWp system-size cap — systems above 10 kWp are NOT eligible
  if (systemSizeKw > 10) return 0;
  if (systemSizeKw <= 2) {
    return Math.round(30000 * systemSizeKw);
  }
  if (systemSizeKw <= 3) {
    return Math.round(60000 + 18000 * (systemSizeKw - 2));
  }
  return 78000; // Capped at ₹78,000 for 3 kW–10 kW systems
}

/**
 * Checks if the state and connection type are eligible under Surya Ghar scheme
 * Eligible states: All except NE states (Arunachal Pradesh, Assam, Manipur, Meghalaya, Mizoram, Nagaland, Tripura, Sikkim)
 * Connection type: Domestic only
 */
export function isEligible(state: string, connectionType: string): boolean {
  if (!connectionType || connectionType.toLowerCase().trim() !== "domestic") {
    return false;
  }

  const neStates = [
    "arunachal pradesh",
    "assam",
    "manipur",
    "meghalaya",
    "mizoram",
    "nagaland",
    "tripura",
    "sikkim"
  ];

  const normalizedState = (state || "").toLowerCase().trim();
  
  // Return false if state matches any NE state
  if (neStates.some(ne => normalizedState === ne || normalizedState.includes(ne))) {
    return false;
  }

  return true;
}
