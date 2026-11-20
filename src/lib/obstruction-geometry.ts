export type ObstructionClass = "water_tank" | "mumty" | "ac_unit" | "solar_panel" | "vent_pipe" | "parapet";

export interface ObstructionDetection {
  id: string;
  className: ObstructionClass;
  confidence: number;
  footprint: Array<{ lat: number; lng: number }>;
  heightM: number;
  source: "google_solar" | "segmentation_model";
}

export interface PanelFootprint {
  corners: Array<{ lat: number; lng: number }>;
}

const MAX_VERTICES = 100;
const CLASS_HEIGHTS: Record<ObstructionClass, number> = {
  water_tank: 1.2,
  mumty: 2.4,
  ac_unit: 0.8,
  solar_panel: 0.12,
  vent_pipe: 0.6,
  parapet: 1.0,
};

export function validateRoofPolygon(vertices: Array<{ lat: number; lng: number }>): { valid: true } | { valid: false; reason: string } {
  if (!Array.isArray(vertices) || vertices.length < 3 || vertices.length > MAX_VERTICES) {
    return { valid: false, reason: "Roof polygon must contain between 3 and 100 vertices." };
  }
  if (vertices.some((point) => !Number.isFinite(point.lat) || !Number.isFinite(point.lng) || point.lat < -90 || point.lat > 90 || point.lng < -180 || point.lng > 180)) {
    return { valid: false, reason: "Roof polygon contains an invalid coordinate." };
  }
  const distinct = new Set(vertices.map((point) => `${point.lat.toFixed(7)},${point.lng.toFixed(7)}`));
  if (distinct.size < 3) return { valid: false, reason: "Roof polygon must contain three distinct points." };
  return { valid: true };
}

export function defaultHeightForClass(className: ObstructionClass): number {
  return CLASS_HEIGHTS[className];
}

function orientation(a: { lat: number; lng: number }, b: { lat: number; lng: number }, c: { lat: number; lng: number }): number {
  return (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng);
}

function segmentsIntersect(a: any, b: any, c: any, d: any): boolean {
  const o1 = orientation(a, b, c); const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a); const o4 = orientation(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

function pointInPolygon(point: { lat: number; lng: number }, polygon: Array<{ lat: number; lng: number }>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]; const b = polygon[j];
    if ((a.lng > point.lng) !== (b.lng > point.lng) && point.lat < ((b.lat - a.lat) * (point.lng - a.lng)) / (b.lng - a.lng) + a.lat) inside = !inside;
  }
  return inside;
}

export function panelOverlapsObstruction(panel: PanelFootprint, obstruction: ObstructionDetection): boolean {
  const panelCorners = panel.corners;
  const obstructionCorners = obstruction.footprint;
  if (panelCorners.some((corner) => pointInPolygon(corner, obstructionCorners)) || obstructionCorners.some((corner) => pointInPolygon(corner, panelCorners))) return true;
  return panelCorners.some((a, i) => panelCorners.some((b, j) => i < j && obstructionCorners.some((c, k) => obstructionCorners.some((d, l) => k < l && segmentsIntersect(a, b, c, d))))) || false;
}

export function canPlacePanel(panel: PanelFootprint, obstructions: ObstructionDetection[]): boolean {
  return !obstructions.some((obstruction) => panelOverlapsObstruction(panel, obstruction));
}
