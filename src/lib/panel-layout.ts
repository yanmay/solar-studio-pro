/**
 * Panel Layout Engine — fits solar panel rectangles inside an arbitrary polygon.
 *
 * Standard panel: 1.7m × 1.0m (landscape orientation)
 * Gap between panels: 0.15m
 * Approach: create a grid of panel cells over the bounding box,
 *           keep only those whose 4 corners are inside the polygon.
 */

import { polygon as turfPolygon, point as turfPoint } from "@turf/helpers";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import bbox from "@turf/bbox";

export interface PanelRect {
  /** [lat, lng] of each corner: [topLeft, topRight, bottomRight, bottomLeft] */
  corners: [number, number][];
}

export interface PanelLayoutResult {
  panels: PanelRect[];
  panelCount: number;
  panelWidthM: number;
  panelHeightM: number;
}

// Standard residential panel dimensions (meters)
const PANEL_WIDTH_M = 1.7;
const PANEL_HEIGHT_M = 1.0;
const GAP_M = 0.15; // gap between panels

// Meters per degree at equator
const M_PER_DEG_LAT = 111_320;

function metersPerDegLng(lat: number): number {
  return M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

/**
 * Given a list of lat/lng vertices forming a closed polygon,
 * produce a list of panel rectangles that fit inside.
 */
export function computePanelLayout(
  vertices: { lat: number; lng: number }[]
): PanelLayoutResult {
  if (vertices.length < 3) {
    return { panels: [], panelCount: 0, panelWidthM: PANEL_WIDTH_M, panelHeightM: PANEL_HEIGHT_M };
  }

  // Build a GeoJSON polygon (Turf expects [lng, lat])
  const coords = vertices.map((v) => [v.lng, v.lat] as [number, number]);
  coords.push(coords[0]); // close ring
  const poly = turfPolygon([coords]);

  // Get bounding box [minLng, minLat, maxLng, maxLat]
  const [minLng, minLat, maxLng, maxLat] = bbox(poly);

  // Use the centroid latitude for meter ↔ degree conversion
  const midLat = (minLat + maxLat) / 2;
  const mPerDegLng = metersPerDegLng(midLat);

  // Panel + gap dimensions in degrees
  const cellWidthDeg = (PANEL_WIDTH_M + GAP_M) / mPerDegLng;
  const cellHeightDeg = (PANEL_HEIGHT_M + GAP_M) / M_PER_DEG_LAT;
  const panelWidthDeg = PANEL_WIDTH_M / mPerDegLng;
  const panelHeightDeg = PANEL_HEIGHT_M / M_PER_DEG_LAT;

  // Offset from edge to first panel center
  const marginDeg = GAP_M / mPerDegLng;

  const panels: PanelRect[] = [];

  // Iterate grid
  for (let lng = minLng + marginDeg; lng + panelWidthDeg <= maxLng; lng += cellWidthDeg) {
    for (let lat = minLat + marginDeg; lat + panelHeightDeg <= maxLat; lat += cellHeightDeg) {
      // Panel corners [lng, lat] for Turf point-in-polygon test
      const corners: [number, number][] = [
        [lng, lat + panelHeightDeg],                   // top-left
        [lng + panelWidthDeg, lat + panelHeightDeg],   // top-right
        [lng + panelWidthDeg, lat],                     // bottom-right
        [lng, lat],                                     // bottom-left
      ];

      // Check all 4 corners are inside the polygon
      const allInside = corners.every(([cLng, cLat]) =>
        booleanPointInPolygon(turfPoint([cLng, cLat]), poly)
      );

      if (allInside) {
        // Convert to [lat, lng] for Leaflet
        panels.push({
          corners: corners.map(([cLng, cLat]) => [cLat, cLng] as [number, number]),
        });
      }
    }
  }

  return {
    panels,
    panelCount: panels.length,
    panelWidthM: PANEL_WIDTH_M,
    panelHeightM: PANEL_HEIGHT_M,
  };
}
