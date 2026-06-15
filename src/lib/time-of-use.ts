// Time-of-use self-consumption model
// Generates 15-minute interval curves for solar generation + typical Indian
// home load, and estimates what fraction of generated kWh is consumed
// directly vs exported to grid.

// Indian residential load profile (fraction of daily kWh by 15-min bucket).
// Derived from typical IE rules / Prayas Energy data for urban India.
// Hours are local wall-clock. Sums to 1.0.
const LOAD_SHAPE_24H_QH: number[] = (() => {
  // Coarse hourly profile (0-23). AM peak ~7-9 (cooking), PM peak ~19-22 (AC/TV).
  const hourly = [
    0.020, 0.015, 0.012, 0.010, 0.012, 0.018,  // 0-5am
    0.030, 0.055, 0.060, 0.045, 0.035, 0.032,  // 6-11am
    0.038, 0.040, 0.035, 0.032, 0.035, 0.045,  // 12-5pm
    0.065, 0.078, 0.082, 0.070, 0.050, 0.031,  // 6-11pm
  ];
  const total = hourly.reduce((a, b) => a + b, 0);
  const normalized = hourly.map((h) => h / total);
  // Expand to 96 quarter-hour buckets (4 per hour)
  const qh: number[] = [];
  for (let i = 0; i < 24; i++) {
    const per = normalized[i] / 4;
    for (let j = 0; j < 4; j++) qh.push(per);
  }
  return qh;
})();

/**
 * Solar generation shape — cosine bell centered on solar noon.
 * Returns 96 quarter-hour values (0..23.75 hrs), normalized to sum = 1.
 */
function generationShape(sunriseHour: number, sunsetHour: number): number[] {
  const qh = new Array(96).fill(0);
  const noon = (sunriseHour + sunsetHour) / 2;
  const halfDay = (sunsetHour - sunriseHour) / 2;
  let sum = 0;
  for (let i = 0; i < 96; i++) {
    const h = i / 4; // hour of day
    if (h < sunriseHour || h > sunsetHour) continue;
    // Cosine bell: peaks at noon, 0 at sunrise/sunset
    const x = (h - noon) / halfDay; // -1..+1
    const v = Math.pow(Math.cos((Math.PI / 2) * x), 1.5);
    qh[i] = Math.max(0, v);
    sum += qh[i];
  }
  if (sum > 0) {
    for (let i = 0; i < 96; i++) qh[i] /= sum;
  }
  return qh;
}

export interface TouCurve {
  hour: number;               // 0..23.75
  genKwh: number;             // generation in this 15-min bucket
  loadKwh: number;            // home load in this 15-min bucket
  selfKwh: number;            // min(gen, load) — consumed directly
  exportKwh: number;          // max(gen - load, 0) — fed to grid
  importKwh: number;          // max(load - gen, 0) — drawn from grid
}

export interface TouResult {
  curve: TouCurve[];
  selfConsumptionPct: number;  // (selfTotal / genTotal) * 100
  gridExportKwh: number;
  gridImportKwh: number;
  selfKwh: number;
  genKwh: number;
  loadKwh: number;
  suggestions: string[];
}

/**
 * Build a 96-bucket time-of-use analysis.
 *
 * @param dailyGenKwh  Daily generation (kWh) — from SolarAnalysis.energy.dailyKwh
 * @param dailyLoadKwh Daily home consumption (kWh) — assumed roughly == generation
 *                     for a correctly-sized residential system
 * @param lat          Latitude (degrees) — for sunrise/sunset estimate
 * @param dayOfYear    1..365 — defaults to today
 */
export function buildTimeOfUse(
  dailyGenKwh: number,
  dailyLoadKwh: number,
  lat: number = 20,
  dayOfYear?: number,
): TouResult {
  // Simplified sunrise/sunset via solar declination (good enough for ToU)
  const n = dayOfYear ?? Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const decl = 23.45 * Math.sin(((360 / 365) * (n - 81)) * (Math.PI / 180));
  const latRad = lat * (Math.PI / 180);
  const declRad = decl * (Math.PI / 180);
  const cosH = -Math.tan(latRad) * Math.tan(declRad);
  // Clamp for polar regions (shouldn't happen in India)
  const h0 = Math.acos(Math.max(-1, Math.min(1, cosH))) * (180 / Math.PI);
  const halfDayHrs = h0 / 15;
  const sunrise = 12 - halfDayHrs;
  const sunset = 12 + halfDayHrs;

  const genShape = generationShape(sunrise, sunset);

  const curve: TouCurve[] = [];
  let self = 0, exp = 0, imp = 0, gen = 0, load = 0;
  for (let i = 0; i < 96; i++) {
    const g = genShape[i] * dailyGenKwh;
    const l = LOAD_SHAPE_24H_QH[i] * dailyLoadKwh;
    const s = Math.min(g, l);
    const e = Math.max(g - l, 0);
    const im = Math.max(l - g, 0);
    curve.push({
      hour: i / 4,
      genKwh: Math.round(g * 1000) / 1000,
      loadKwh: Math.round(l * 1000) / 1000,
      selfKwh: Math.round(s * 1000) / 1000,
      exportKwh: Math.round(e * 1000) / 1000,
      importKwh: Math.round(im * 1000) / 1000,
    });
    self += s; exp += e; imp += im; gen += g; load += l;
  }

  const selfPct = gen > 0 ? Math.round((self / gen) * 100) : 0;

  // Scheduling suggestions — find the peak export window
  let peakExportHour = 12;
  let peakExport = 0;
  for (const c of curve) {
    if (c.exportKwh > peakExport) { peakExport = c.exportKwh; peakExportHour = c.hour; }
  }
  const startH = Math.floor(peakExportHour) - 1;
  const endH = Math.floor(peakExportHour) + 2;
  const suggestions = [
    `☀️ Peak self-use window: ${pad(startH)}:00 – ${pad(endH)}:00. Schedule heavy loads here.`,
    `🧺 Washing machine + dishwasher: run between ${pad(Math.max(10, startH - 1))}:00 and ${pad(Math.min(15, startH + 2))}:00 for ~100% solar-powered cycles.`,
    `🔋 EV charging / pool pump: best between 11:00 and 14:00 when generation peaks.`,
    `❄️ AC pre-cooling at 15:00-16:00 reduces evening grid draw; house stays cool via thermal mass.`,
  ];

  return {
    curve,
    selfConsumptionPct: selfPct,
    gridExportKwh: Math.round(exp * 100) / 100,
    gridImportKwh: Math.round(imp * 100) / 100,
    selfKwh: Math.round(self * 100) / 100,
    genKwh: Math.round(gen * 100) / 100,
    loadKwh: Math.round(load * 100) / 100,
    suggestions,
  };
}

function pad(h: number): string {
  const v = ((h % 24) + 24) % 24;
  return v < 10 ? `0${v}` : `${v}`;
}
