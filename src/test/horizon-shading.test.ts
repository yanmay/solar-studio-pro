import { describe, it, expect } from "vitest";
import { calcHorizonShadingLoss } from "../lib/horizon-shading";
import type { OsmBuildingResult } from "../lib/osm-buildings";

describe("horizon-shading", () => {
  it("should return 0.0 shading loss if there are no neighbours", () => {
    const loss = calcHorizonShadingLoss(19.076, 72.877, [], 180);
    expect(loss).toBe(0.0);
  });

  it("should calculate shading loss correctly for matching neighbours", () => {
    // 1 neighbour: 12 meters height (4 floors), 10 meters distance, azimuth 180 (directly south)
    // elevation angle: atan2(12, 10) * 180 / PI = 50.19°
    // 50.19° > 12° threshold: exceeds by 38.19°
    // contribution: 38.19 / 100 = 0.3819 (clamped to 0.30 max total)
    const neighbour: OsmBuildingResult = {
      polygon: [
        { lat: 19.0759, lng: 72.8770 },
        { lat: 19.0759, lng: 72.8771 },
        { lat: 19.0758, lng: 72.8771 },
        { lat: 19.0759, lng: 72.8770 },
      ],
      source: "osm",
      buildingTags: {},
      approxLevels: 4,
    };

    const loss = calcHorizonShadingLoss(19.076, 72.877, [neighbour], 180);
    expect(loss).toBe(0.271);
  });

  it("should return 0.0 shading loss if neighbour is outside range or azimuth quadrant", () => {
    // Neighbour directly north (azimuth 0)
    const neighbour: OsmBuildingResult = {
      polygon: [
        { lat: 19.0765, lng: 72.8770 },
        { lat: 19.0765, lng: 72.8771 },
        { lat: 19.0764, lng: 72.8771 },
        { lat: 19.0765, lng: 72.8770 },
      ],
      source: "osm",
      buildingTags: {},
      approxLevels: 4,
    };

    const loss = calcHorizonShadingLoss(19.076, 72.877, [neighbour], 180);
    expect(loss).toBe(0.0);
  });

  it("should respect the south arc boundary (110° - 250°)", () => {
    // Neighbour at azimuth ~100° (outside south arc)
    const outsideNeighbour: OsmBuildingResult = {
      polygon: [
        { lat: 19.0760, lng: 72.8773 }, // East-northeast
        { lat: 19.0760, lng: 72.8774 },
        { lat: 19.0759, lng: 72.8774 },
        { lat: 19.0760, lng: 72.8773 },
      ],
      source: "osm",
      buildingTags: {},
      approxLevels: 5,
    };
    
    // Neighbour at azimuth ~135° (inside south arc, distance ~23m)
    const insideNeighbour: OsmBuildingResult = {
      polygon: [
        { lat: 19.07585, lng: 72.87715 }, // Southeast
        { lat: 19.07585, lng: 72.87716 },
        { lat: 19.07584, lng: 72.87716 },
        { lat: 19.07585, lng: 72.87715 },
      ],
      source: "osm",
      buildingTags: {},
      approxLevels: 5,
    };

    const outsideLoss = calcHorizonShadingLoss(19.076, 72.877, [outsideNeighbour], 180);
    expect(outsideLoss).toBe(0.0);

    const insideLoss = calcHorizonShadingLoss(19.076, 72.877, [insideNeighbour], 180);
    expect(insideLoss).toBeGreaterThan(0.0);
  });
});
