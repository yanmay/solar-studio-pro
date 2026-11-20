import { describe, expect, it } from "vitest";
import {
  canPlacePanel,
  defaultHeightForClass,
  panelOverlapsObstruction,
  validateRoofPolygon,
  type ObstructionDetection,
} from "@/lib/obstruction-geometry";

const waterTank: ObstructionDetection = {
  id: "tank-1",
  className: "water_tank",
  confidence: 0.91,
  heightM: 1.2,
  source: "segmentation_model",
  footprint: [
    { lat: 19.0001, lng: 72.0001 },
    { lat: 19.0001, lng: 72.0002 },
    { lat: 19.0002, lng: 72.0002 },
    { lat: 19.0002, lng: 72.0001 },
  ],
};

describe("obstruction geometry", () => {
  it("rejects malformed roof polygons before paid APIs are called", () => {
    expect(validateRoofPolygon([{ lat: 19, lng: 72 }, { lat: 19, lng: 72 }])).toEqual({
      valid: false,
      reason: "Roof polygon must contain between 3 and 100 vertices.",
    });
    expect(validateRoofPolygon([{ lat: 19, lng: 72 }, { lat: 19.1, lng: 72 }, { lat: 91, lng: 72.1 }]).valid).toBe(false);
  });

  it("documents the class-based water-tank height assumption", () => {
    expect(defaultHeightForClass("water_tank")).toBe(1.2);
  });

  it("rejects a panel placed on a detected water tank", () => {
    const panel = { corners: [
      { lat: 19.00012, lng: 72.00012 },
      { lat: 19.00012, lng: 72.00018 },
      { lat: 19.00018, lng: 72.00018 },
      { lat: 19.00018, lng: 72.00012 },
    ] };
    expect(panelOverlapsObstruction(panel, waterTank)).toBe(true);
    expect(canPlacePanel(panel, [waterTank])).toBe(false);
  });

  it("allows a panel outside all detected obstruction footprints", () => {
    const panel = { corners: [
      { lat: 19.0003, lng: 72.0003 },
      { lat: 19.0003, lng: 72.0004 },
      { lat: 19.0004, lng: 72.0004 },
      { lat: 19.0004, lng: 72.0003 },
    ] };
    expect(canPlacePanel(panel, [waterTank])).toBe(true);
  });
});
