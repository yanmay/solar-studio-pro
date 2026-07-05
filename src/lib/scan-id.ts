import type { ScanInput } from "@/types/scan";

/**
 * Deterministic scan identity.
 *
 * The random per-render `analysisId` from solar-calc cannot be used to look up
 * server-side unlock state, because a re-opened share URL recomputes a new id.
 * Instead we derive a stable id from the immutable facts of the scan: the
 * address and the traced roof polygon. The same roof always maps to the same
 * `site_id` in `analysis_sessions`, so a paid unlock survives reloads,
 * share-URL round-trips, and device changes.
 */

/** FNV-1a 32-bit hash, rendered as fixed-width hex. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Compute the stable scan id for a scan input.
 * Uses address + rounded polygon coordinates (5 decimal places ≈ 1.1 m,
 * well below roof scale) so trivial float noise does not change identity.
 * Falls back to lat/lng + area when no polygon was traced (photo estimator).
 */
export function computeScanId(scanInput: ScanInput): string {
  const coords = scanInput.roofPolygon?.[0]?.coordinates?.[0] ?? [];
  const geometry =
    coords.length > 0
      ? coords.map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join(";")
      : `${scanInput.lng?.toFixed(5) ?? "0"},${scanInput.lat?.toFixed(5) ?? "0"},${Math.round(scanInput.roofAreaM2 ?? 0)}`;

  const basis = `${(scanInput.address ?? "").trim().toLowerCase()}|${geometry}`;
  return `scan_${fnv1a(basis)}${fnv1a(basis.split("").reverse().join(""))}`;
}
