// India electricity tariff lookup — domestic (residential) average ₹/kWh
// Sources: state DISCOM tariff orders FY24-25 (BESCOM, MSEDCL, TPDDL, Adani, etc.)
// Numbers are average of 100-300 kWh slab (typical home consumption).

export interface DiscomInfo {
  /** Average domestic tariff at typical 100-300 kWh slab */
  rate: number;
  /** Primary discom serving the state */
  discom: string;
}

// Keyed by state name (lowercase, matches Nominatim's state field)
export const STATE_DISCOM_MAP: Record<string, DiscomInfo> = {
  "andhra pradesh":   { rate: 6.8,  discom: "APSPDCL / APEPDCL" },
  "arunachal pradesh":{ rate: 5.2,  discom: "APDCL" },
  "assam":            { rate: 7.4,  discom: "APDCL" },
  "bihar":            { rate: 6.7,  discom: "NBPDCL / SBPDCL" },
  "chhattisgarh":     { rate: 5.9,  discom: "CSPDCL" },
  "delhi":            { rate: 7.5,  discom: "BSES Rajdhani / TPDDL" },
  "goa":              { rate: 4.5,  discom: "Goa Electricity Dept" },
  "gujarat":          { rate: 5.8,  discom: "Torrent / DGVCL / MGVCL" },
  "haryana":          { rate: 6.4,  discom: "DHBVN / UHBVN" },
  "himachal pradesh": { rate: 4.7,  discom: "HPSEBL" },
  "jharkhand":        { rate: 6.6,  discom: "JBVNL" },
  "karnataka":        { rate: 7.7,  discom: "BESCOM" },
  "kerala":           { rate: 6.9,  discom: "KSEB" },
  "madhya pradesh":   { rate: 7.1,  discom: "MPMKVVCL / MPPKVVCL" },
  "maharashtra":      { rate: 9.2,  discom: "MSEDCL / Tata Power / Adani" },
  "manipur":          { rate: 5.4,  discom: "MSPDCL" },
  "meghalaya":        { rate: 6.4,  discom: "MePDCL" },
  "mizoram":          { rate: 6.9,  discom: "P&E Dept Mizoram" },
  "nagaland":         { rate: 6.8,  discom: "DoP Nagaland" },
  "odisha":           { rate: 5.7,  discom: "TPCODL / TPNODL / TPSODL / TPWODL" },
  "punjab":           { rate: 6.0,  discom: "PSPCL" },
  "rajasthan":        { rate: 7.3,  discom: "JVVNL / AVVNL / JdVVNL" },
  "sikkim":           { rate: 5.0,  discom: "Sikkim Power Dept" },
  "tamil nadu":       { rate: 5.6,  discom: "TNPDCL (TANGEDCO)" },
  "telangana":        { rate: 7.0,  discom: "TGSPDCL / TGNPDCL" },
  "tripura":          { rate: 6.4,  discom: "TSECL" },
  "uttar pradesh":    { rate: 7.5,  discom: "UPPCL (PVVNL/MVVNL/PuVVNL/DVVNL/KESCO)" },
  "uttarakhand":      { rate: 5.4,  discom: "UPCL" },
  "west bengal":      { rate: 8.2,  discom: "WBSEDCL / CESC Kolkata" },
  // Union Territories
  "chandigarh":       { rate: 4.8,  discom: "CED Chandigarh" },
  "puducherry":       { rate: 5.5,  discom: "Puducherry Electricity Dept" },
  "jammu and kashmir":{ rate: 4.2,  discom: "JPDCL / KPDCL" },
  "ladakh":           { rate: 4.5,  discom: "PDD Ladakh" },
  "andaman and nicobar islands": { rate: 5.5, discom: "Electricity Dept A&N" },
  "dadra and nagar haveli and daman and diu": { rate: 4.0, discom: "DNHPDCL" },
  "lakshadweep":      { rate: 4.6,  discom: "Electricity Dept Lakshadweep" },
};

const STATE_ALIASES: Record<string, string> = {
  "ncr": "delhi",
  "national capital territory of delhi": "delhi",
  "j&k": "jammu and kashmir",
  "jammu & kashmir": "jammu and kashmir",
  "tamilnadu": "tamil nadu",
  "uttarpradesh": "uttar pradesh",
  "uttar predesh": "uttar pradesh",
  "andhrapradesh": "andhra pradesh",
  "ap": "andhra pradesh",
  "wb": "west bengal",
  "tn": "tamil nadu",
  "up": "uttar pradesh",
  "mp": "madhya pradesh",
  "mh": "maharashtra",
  "ka": "karnataka",
  "kl": "kerala",
  "gj": "gujarat",
  "rj": "rajasthan",
  "br": "bihar",
};

/** Detect discom info from Nominatim address fields or label string */
export function detectDiscom(input: {
  state?: string;
  label?: string;
}): DiscomInfo | null {
  const candidates: string[] = [];
  if (input.state) candidates.push(input.state.toLowerCase().trim());
  if (input.label) {
    // Pull last 3 comma-separated parts (typically: city, state, country)
    const parts = input.label.split(",").map(p => p.trim().toLowerCase());
    for (let i = Math.max(0, parts.length - 4); i < parts.length; i++) candidates.push(parts[i]);
  }

  for (const c of candidates) {
    if (STATE_DISCOM_MAP[c]) return STATE_DISCOM_MAP[c];
    if (STATE_ALIASES[c] && STATE_DISCOM_MAP[STATE_ALIASES[c]]) return STATE_DISCOM_MAP[STATE_ALIASES[c]];
    // Fuzzy: any candidate substring match
    for (const key of Object.keys(STATE_DISCOM_MAP)) {
      if (c.includes(key) || key.includes(c)) return STATE_DISCOM_MAP[key];
    }
  }
  return null;
}
