import type { OsmBuildingResult } from "./osm-buildings";

/**
 * Calculates monthly/annual horizon shading loss from neighbouring OSM buildings.
 * @param targetLat Target roof center latitude
 * @param targetLng Target roof center longitude
 * @param neighbours Array of neighboring building results
 * @param _roofAzimuthDeg Target roof azimuth in degrees
 * @returns Shading loss coefficient between 0.0 and 0.35
 */
export function calcHorizonShadingLoss(
  targetLat: number,
  targetLng: number,
  neighbours: OsmBuildingResult[],
  _roofAzimuthDeg: number
): number {
  let totalLoss = 0;

  for (const neighbour of neighbours) {
    if (!neighbour.polygon || neighbour.polygon.length < 3) continue;

    // 1. Centroid of the neighbour
    const pts = neighbour.polygon;
    const cLat = pts.reduce((sum, p) => sum + p.lat, 0) / pts.length;
    const cLng = pts.reduce((sum, p) => sum + p.lng, 0) / pts.length;

    // Distance in meters
    const dx = (cLng - targetLng) * 111320 * Math.cos((targetLat * Math.PI) / 180);
    const dy = (cLat - targetLat) * 110540;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Skip the building itself (distance < 4 meters)
    if (distance < 4) continue;

    // Centroid's azimuth from the target roof center (clockwise from North)
    const angleRad = Math.atan2(dx, dy);
    const azimuthDeg = (angleRad * 180 / Math.PI + 360) % 360;

    // 2. Obstruction elevation angle
    const levels = neighbour.approxLevels ?? 1;
    const height = levels * 3.0;
    const elevAngleRad = Math.atan2(height, distance);
    const elevAngleDeg = (elevAngleRad * 180) / Math.PI;

    // 3. Simplified winter sun blocking rule:
    // If elevAngle > 12° and neighbour is within 25m in the south arc (110°-250°)
    if (elevAngleDeg > 12 && distance < 25 && azimuthDeg >= 110 && azimuthDeg <= 250) {
      // It contributes partial shading: e.g. 1% loss per degree exceeding the 12° threshold
      const contribution = (elevAngleDeg - 12) / 100;
      totalLoss += contribution;
    }
  }

  // 4. Sum contributions. Return a shading loss float between 0.0 and 0.30.
  return Math.round(Math.min(0.30, Math.max(0.0, totalLoss)) * 1000) / 1000;
}
