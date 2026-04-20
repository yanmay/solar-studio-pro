import { captureApiError } from "./sentry";
// Auto-detect rooftop polygon from OSM Overpass API
// Free, no API key, India coverage. Returns the smallest building polygon
// that contains the tap point — typically the user's actual house.

export interface OsmBuildingPoint {
  lat: number;
  lng: number;
}

export interface OsmBuildingResult {
  polygon: OsmBuildingPoint[];      // outer ring, in order
  source: "osm";
  buildingTags: Record<string, string>;
  approxLevels?: number;             // building:levels if available
}

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

/** Ray-casting point-in-polygon */
function pointInPoly(pt: OsmBuildingPoint, poly: OsmBuildingPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].lng, yi = poly[i].lat;
    const xj = poly[j].lng, yj = poly[j].lat;
    const intersect = ((yi > pt.lat) !== (yj > pt.lat))
      && (pt.lng < (xj - xi) * (pt.lat - yi) / ((yj - yi) || 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Approximate polygon area (m²) using equirectangular projection — good for small buildings */
function approxAreaM2(poly: OsmBuildingPoint[]): number {
  if (poly.length < 3) return 0;
  const lat0 = poly[0].lat * Math.PI / 180;
  const cosLat = Math.cos(lat0);
  let area = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].lng * 111320 * cosLat;
    const yi = poly[i].lat * 110540;
    const xj = poly[j].lng * 111320 * cosLat;
    const yj = poly[j].lat * 110540;
    area += xj * yi - xi * yj;
  }
  return Math.abs(area / 2);
}

/**
 * Query Overpass for buildings near (lat, lng) and return the one that contains
 * the tap point (or the nearest one if the tap missed any).
 */
export async function detectBuildingAt(
  lat: number,
  lng: number,
  radiusMeters: number = 25,
  signal?: AbortSignal,
): Promise<OsmBuildingResult | null> {
  // Overpass QL query: all building ways within radius, with their geometry
  const query = `
    [out:json][timeout:8];
    (
      way["building"](around:${radiusMeters},${lat},${lng});
      relation["building"](around:${radiusMeters},${lat},${lng});
    );
    out tags geom;
  `.trim();

  let lastErr: Error | null = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal,
      });
      if (!res.ok) {
        lastErr = new Error(`Overpass ${endpoint} HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      const elements: Array<{ type: string; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] }> = data?.elements || [];
      if (!elements.length) return null;

      // Build polygons from each way
      const candidates: { poly: OsmBuildingPoint[]; tags: Record<string, string>; area: number }[] = [];
      for (const el of elements) {
        if (!el.geometry || el.geometry.length < 3) continue;
        const poly: OsmBuildingPoint[] = el.geometry.map((g) => ({ lat: g.lat, lng: g.lon }));
        // Drop if not closed enough — Overpass returns closed rings already
        candidates.push({ poly, tags: el.tags || {}, area: approxAreaM2(poly) });
      }
      if (!candidates.length) return null;

      // Prefer building that *contains* the tap; fall back to smallest by area
      const containing = candidates.filter((c) => pointInPoly({ lat, lng }, c.poly));
      const pool = containing.length > 0 ? containing : candidates;
      // Smallest first — avoids picking a giant industrial complex when a small house exists
      pool.sort((a, b) => a.area - b.area);
      const best = pool[0];

      // Levels parsing
      const levelsRaw = best.tags["building:levels"] || best.tags.levels;
      const approxLevels = levelsRaw ? parseFloat(levelsRaw) : undefined;

      return {
        polygon: best.poly,
        source: "osm",
        buildingTags: best.tags,
        approxLevels: Number.isFinite(approxLevels) ? approxLevels : undefined,
      };
    } catch (err) {
      lastErr = err as Error;
      if ((err as Error).name === "AbortError") throw err;
      continue;
    }
  }
  if (lastErr) {
    captureApiError("overpass", lastErr, { lat, lng, radiusMeters });
    throw lastErr;
  }
  return null;
}

/**
 * Query nearby buildings *not* at the tap point — used for shading advisory.
 * Returns array of { area, levels (if known) } for buildings within radius.
 */
export async function nearbyBuildings(
  lat: number,
  lng: number,
  radiusMeters: number = 50,
  signal?: AbortSignal,
): Promise<{ areaM2: number; levels?: number; distanceM: number }[]> {
  const query = `
    [out:json][timeout:6];
    (way["building"](around:${radiusMeters},${lat},${lng}););
    out tags geom;
  `.trim();
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal,
      });
      if (!res.ok) continue;
      const data = await res.json();
      const out: { areaM2: number; levels?: number; distanceM: number }[] = [];
      for (const el of (data?.elements || [])) {
        if (!el.geometry || el.geometry.length < 3) continue;
        const poly: OsmBuildingPoint[] = el.geometry.map((g: { lat: number; lon: number }) => ({ lat: g.lat, lng: g.lon }));
        const cLat = poly.reduce((s, p) => s + p.lat, 0) / poly.length;
        const cLng = poly.reduce((s, p) => s + p.lng, 0) / poly.length;
        const dx = (cLng - lng) * 111320 * Math.cos(lat * Math.PI / 180);
        const dy = (cLat - lat) * 110540;
        const distanceM = Math.sqrt(dx * dx + dy * dy);
        // Skip the building right at the tap (distance < 4 m → likely the user's roof)
        if (distanceM < 4) continue;
        const levelsRaw = el.tags?.["building:levels"] || el.tags?.levels;
        const levels = levelsRaw ? parseFloat(levelsRaw) : undefined;
        out.push({
          areaM2: approxAreaM2(poly),
          levels: Number.isFinite(levels) ? levels : undefined,
          distanceM,
        });
      }
      return out;
    } catch { continue; }
  }
  return [];
}
