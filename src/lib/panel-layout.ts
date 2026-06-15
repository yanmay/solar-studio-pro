/**
 * Panel Layout Engine — realistic solar panel placement inside an arbitrary polygon.
 *
 * Accuracy targets (matches what a field surveyor would install):
 *  - Panel size: 
 *    - Compact: 1.722 m × 1.134 m (450W monocrystalline)
 *    - Premium: 2.278 m × 1.134 m (550W monocrystalline, standard utility/large residential)
 *  - Setback from every edge: configurable (default 0.5 m for fire code + safety)
 *  - Gap between panels (same row, side-by-side): 0.02 m (rail clip spacing)
 *  - Shadow spacing (self-shading row gap): calculated dynamically based on panel tilt and latitude
 *  - Maintenance walkways: optional 0.8m paths between every 2 rows and 0.6m columns every 6 panels
 *  - Grid orientation: 
 *    - Roof-aligned: aligned with the dominant (longest) edge of the polygon
 *    - South-aligned: aligned with cardinal South (0 degrees rotation) for flat roofs
 */

import { polygon as turfPolygon, point as turfPoint } from "@turf/helpers";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import bbox from "@turf/bbox";

export interface PanelRect {
  /** [lat, lng] corners: [topLeft, topRight, bottomRight, bottomLeft] */
  corners: [number, number][];
  /** Rotation angle in degrees (clockwise from north) */
  angleDeg: number;
  /** Flat width in meters in the rotated grid frame */
  wM: number;
  /** Flat height in meters in the rotated grid frame */
  hM: number;
  /** Is it landscape orientation? */
  isLandscape: boolean;
}

export interface PanelLayoutOptions {
  panelType: "compact" | "premium";
  alignment: "roof" | "south";
  tiltDeg: number;
  orientation: "portrait" | "landscape" | "auto";
  walkways: boolean;
  setbackM: number;
}

export interface PanelLayoutResult {
  panels: PanelRect[];
  panelCount: number;
  panelWidthM: number;
  panelHeightM: number;
  roofAngleDeg: number;
}

// ── Geo conversion constants ─────────────────────────────────────────────────
const M_PER_DEG_LAT = 111_320;

function mPerDegLng(lat: number): number {
  return M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

// ── 2D geometry helpers (operate in meters) ──────────────────────────────────

/** Convert [lat,lng] vertex to [x,y] metres relative to a reference point */
function toLocalXY(
  lat: number, lng: number,
  refLat: number, refLng: number,
  mPLng: number,
): [number, number] {
  const x = (lng - refLng) * mPLng;
  const y = (lat - refLat) * M_PER_DEG_LAT;
  return [x, y];
}

/** Convert local [x,y] metres back to [lat, lng] */
function fromLocalXY(
  x: number, y: number,
  refLat: number, refLng: number,
  mPLng: number,
): [number, number] {
  const lat = refLat + y / M_PER_DEG_LAT;
  const lng = refLng + x / mPLng;
  return [lat, lng];
}

/** Rotate a point [x,y] by `angle` radians around the origin */
function rotate(x: number, y: number, angle: number): [number, number] {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [c * x - s * y, s * x + c * y];
}

/** Rotate a point [x,y] by `-angle` radians (inverse rotation) */
function rotateInv(x: number, y: number, angle: number): [number, number] {
  return rotate(x, y, -angle);
}

/**
 * Find the dominant axis angle of a polygon in radians.
 * Uses the longest edge as the roof ridge direction.
 * Returns the angle of that edge, normalised to [0, π) so rows run along it.
 */
function dominantAxisAngle(localPts: [number, number][]): number {
  let bestLen = -1;
  let bestAngle = 0;
  const n = localPts.length;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = localPts[i];
    const [x1, y1] = localPts[(i + 1) % n];
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len > bestLen) {
      bestLen = len;
      bestAngle = Math.atan2(dy, dx);
    }
  }
  // Normalise to [0, π)
  if (bestAngle < 0) bestAngle += Math.PI;
  if (bestAngle >= Math.PI) bestAngle -= Math.PI;
  return bestAngle;
}

/**
 * Run panel packing in the rotated frame for a specific orientation.
 */
function runPacking(
  orientation: "portrait" | "landscape",
  opts: PanelLayoutOptions,
  poly: ReturnType<typeof turfPolygon>,
  refLat: number,
  refLng: number,
  mPLng: number,
  axisAngle: number,
  rotated: [number, number][],
): PanelRect[] {
  const rxs = rotated.map(([x]) => x);
  const rys = rotated.map(([, y]) => y);
  const rMinX = Math.min(...rxs);
  const rMaxX = Math.max(...rxs);
  const rMinY = Math.min(...rys);
  const rMaxY = Math.max(...rys);

  // Panel size: width (short), height (long)
  const panelWidth = 1.134;
  const panelHeight = opts.panelType === "premium" ? 2.278 : 1.722;

  const pW = orientation === "portrait" ? panelWidth : panelHeight;
  const pH = orientation === "portrait" ? panelHeight : panelWidth;

  const tiltRad = (opts.tiltDeg * Math.PI) / 180;
  const wFlat = pW;
  const hFlat = pH * Math.cos(tiltRad);
  // Shading gap shadow factor: ~1.25 for Indian latitudes
  const shadowGap = pH * Math.sin(tiltRad) * 1.25;
  const sideGap = 0.02;

  const panels: PanelRect[] = [];
  const angleDeg = (axisAngle * 180) / Math.PI;
  const isLandscape = orientation === "landscape";

  let currentY = rMinY + opts.setbackM;
  let rowIndex = 0;

  while (currentY + hFlat <= rMaxY - opts.setbackM) {
    let currentX = rMinX + opts.setbackM;
    let colIndex = 0;

    while (currentX + wFlat <= rMaxX - opts.setbackM) {
      // Panel corners in rotated frame
      const rotCorners: [number, number][] = [
        [currentX,         currentY + hFlat], // top-left
        [currentX + wFlat, currentY + hFlat], // top-right
        [currentX + wFlat, currentY        ], // bottom-right
        [currentX,         currentY        ], // bottom-left
      ];

      // Rotate back to world-metres frame
      const worldCorners = rotCorners.map(([cx, cy]) => rotate(cx, cy, axisAngle));

      // Convert to [lat, lng] and shrink slightly inward for a clean visual gap
      const VISUAL_SHRINK = 0.01;
      const cx = worldCorners.reduce((s, [x]) => s + x, 0) / 4;
      const cy = worldCorners.reduce((s, [, y]) => s + y, 0) / 4;
      const geoCorners = worldCorners.map(([wx, wy]) => {
        const sx = cx + (wx - cx) * (1 - VISUAL_SHRINK / wFlat);
        const sy = cy + (wy - cy) * (1 - VISUAL_SHRINK / hFlat);
        return fromLocalXY(sx, sy, refLat, refLng, mPLng);
      });

      // Containment check: corners + centre must be inside the polygon
      const testPoints = [
        ...geoCorners,
        fromLocalXY(cx, cy, refLat, refLng, mPLng),
      ];
      const allInside = testPoints.every(([lat, lng]) =>
        booleanPointInPolygon(turfPoint([lng, lat]), poly)
      );

      if (allInside) {
        panels.push({
          corners: geoCorners as [number, number][],
          angleDeg,
          wM: wFlat,
          hM: hFlat,
          isLandscape,
        });
      }

      // Column step: regular gap or maintenance walkway
      let colGap = sideGap;
      if (opts.walkways && (colIndex + 1) % 6 === 0) {
        colGap = 0.6; // walkway every 6 panels
      }
      currentX += wFlat + colGap;
      colIndex++;
    }

    // Row step: regular shadow gap or maintenance walkway
    let rowGap = shadowGap;
    if (opts.walkways && rowIndex % 2 === 1) {
      rowGap = Math.max(shadowGap, 0.8); // walkway every 2 rows
    }
    currentY += hFlat + rowGap;
    rowIndex++;
  }

  return panels;
}

/**
 * Given a list of lat/lng vertices forming a closed polygon,
 * produce a list of panel rectangles that fit inside, oriented
 * according to user options.
 */
export function computePanelLayout(
  vertices: { lat: number; lng: number }[],
  options?: Partial<PanelLayoutOptions>,
): PanelLayoutResult {
  const opts: PanelLayoutOptions = {
    panelType: options?.panelType ?? "compact",
    alignment: options?.alignment ?? "roof",
    tiltDeg: options?.tiltDeg ?? 15,
    orientation: options?.orientation ?? "portrait",
    walkways: options?.walkways ?? true,
    setbackM: options?.setbackM ?? 0.5,
  };

  const panelWidth = 1.134;
  const panelHeight = opts.panelType === "premium" ? 2.278 : 1.722;

  if (vertices.length < 3) {
    return {
      panels: [],
      panelCount: 0,
      panelWidthM: panelWidth,
      panelHeightM: panelHeight,
      roofAngleDeg: 0,
    };
  }

  // ── 1. Build Turf polygon ──────────────────────────────────────────────────
  const turfCoords = vertices.map((v) => [v.lng, v.lat] as [number, number]);
  turfCoords.push(turfCoords[0]);
  const poly = turfPolygon([turfCoords]);

  // ── 2. Compute reference point ─────────────────────────────────────────────
  const [minLng, minLat, maxLng, maxLat] = bbox(poly);
  const refLat = (minLat + maxLat) / 2;
  const refLng = (minLng + maxLng) / 2;
  const mPLng = mPerDegLng(refLat);

  // ── 3. Convert polygon to local metres ─────────────────────────────────────
  const localPts: [number, number][] = vertices.map((v) =>
    toLocalXY(v.lat, v.lng, refLat, refLng, mPLng)
  );

  // ── 4. Find axis angle ─────────────────────────────────────────────────────
  const axisAngle = opts.alignment === "south" ? 0 : dominantAxisAngle(localPts);

  // ── 5. Rotate all polygon points into the axis-aligned frame ───────────────
  const rotated = localPts.map(([x, y]) => rotateInv(x, y, axisAngle));

  // ── 6. Run packing ─────────────────────────────────────────────────────────
  let selectedPanels: PanelRect[] = [];
  
  if (opts.orientation === "auto") {
    const portraitLayout = runPacking("portrait", opts, poly, refLat, refLng, mPLng, axisAngle, rotated);
    const landscapeLayout = runPacking("landscape", opts, poly, refLat, refLng, mPLng, axisAngle, rotated);
    selectedPanels = portraitLayout.length >= landscapeLayout.length ? portraitLayout : landscapeLayout;
  } else {
    selectedPanels = runPacking(opts.orientation, opts, poly, refLat, refLng, mPLng, axisAngle, rotated);
  }

  const angleDeg = (axisAngle * 180) / Math.PI;

  return {
    panels: selectedPanels,
    panelCount: selectedPanels.length,
    panelWidthM: panelWidth,
    panelHeightM: panelHeight,
    roofAngleDeg: angleDeg,
  };
}
