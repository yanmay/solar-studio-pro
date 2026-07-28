/**
 * PM-Surya Ghar Muft Bijli Yojana Subsidy Calculation Engine (2024-25 MNRE rules)
 */

export function calcPMSuryaSubsidy(systemSizeKw: number): number {
  if (systemSizeKw <= 0) return 0;
  if (systemSizeKw <= 2) {
    return Math.round(30000 * systemSizeKw);
  }
  if (systemSizeKw <= 3) {
    return Math.round(60000 + 18000 * (systemSizeKw - 2));
  }
  return 78000; // Capped at ₹78,000 for 3kW and above
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
