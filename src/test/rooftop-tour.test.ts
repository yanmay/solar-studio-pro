import { describe, expect, it } from "vitest";
import {
  ROOFTOP_TOUR_AUTOPLAY_DELAY,
  ROOFTOP_TOUR_DURATION,
  getRooftopTourAdvanceDelay,
  getRooftopTourPhase,
  getRooftopTourSteps,
} from "@/lib/rooftop-tour";

describe("rooftop editor tour", () => {
  it("uses the requested slow transition duration", () => {
    expect(ROOFTOP_TOUR_DURATION).toBe(1200);
    expect(ROOFTOP_TOUR_AUTOPLAY_DELAY).toBeGreaterThanOrEqual(6500);
  });

  it("keeps narrated steps on screen long enough to read", () => {
    expect(getRooftopTourAdvanceDelay("intro", 0)).toBeGreaterThanOrEqual(7000);
    expect(getRooftopTourAdvanceDelay("drawing", 0)).toBeGreaterThanOrEqual(8000);
    expect(getRooftopTourAdvanceDelay("configuration", 2)).toBeGreaterThanOrEqual(7000);
  });

  it("moves through the editor phases without targeting hidden controls", () => {
    expect(getRooftopTourPhase({ hasSearched: false, drawState: "IDLE" })).toBe("intro");
    expect(getRooftopTourPhase({ hasSearched: true, drawState: "IDLE" })).toBe("drawing");
    expect(getRooftopTourPhase({ hasSearched: true, drawState: "DRAWING" })).toBe("drawing");
    expect(getRooftopTourPhase({ hasSearched: true, drawState: "COMPLETE" })).toBe("configuration");
  });

  it("guides search, detailed drawing, surface, panels, and tariff", () => {
    expect(getRooftopTourSteps("intro").map((step) => step.element)).toEqual([
      "[data-tour='orbital-globe']",
      "[data-tour='3d-rotation']",
      "[data-tour='location-search']",
      "[data-tour='zoom-controls']",
      "[data-tour='workspace-toggle']",
    ]);
    expect(getRooftopTourSteps("drawing").map((step) => step.element)).toContain("[data-tour='map-canvas']");
    expect(getRooftopTourSteps("drawing").map((step) => step.element)).toContain("[data-tour='zoom-controls']");
    expect(getRooftopTourSteps("configuration").map((step) => step.element)).toEqual([
      "[data-tour='surface-config']",
      "[data-tour='panel-config']",
      "[data-tour='tariff-config']",
    ]);
  });
});
