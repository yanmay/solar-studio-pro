import type { DriveStep } from "driver.js";

export const ROOFTOP_TOUR_DURATION = 1200;
export const ROOFTOP_TOUR_AUTOPLAY_DELAY = 7500;

export type RooftopTourPhase = "intro" | "drawing" | "configuration";

export function getRooftopTourAdvanceDelay(phase: RooftopTourPhase, index: number): number {
  if (phase === "drawing") return index === 0 ? 9000 : 8000;
  if (phase === "configuration") return index === 2 ? 8000 : 7500;
  return index === 0 ? 8000 : ROOFTOP_TOUR_AUTOPLAY_DELAY;
}

export function getRooftopTourPhase({
  hasSearched,
  drawState,
}: {
  hasSearched: boolean;
  drawState: string;
}): RooftopTourPhase {
  if (!hasSearched) return "intro";
  if (drawState !== "COMPLETE") return "drawing";
  return "configuration";
}

export function getRooftopTourSteps(phase: RooftopTourPhase): DriveStep[] {
  if (phase === "intro") {
    return [
      {
        element: "[data-tour='orbital-globe']",
        popover: {
          title: "Explore the live 3D map",
          description: "The map starts over India and rotates automatically. Drag the view directly, or use the angle controls in the top-right for an exact heading.",
        },
      },
      {
        element: "[data-tour='3d-rotation']",
        popover: {
          title: "Set an exact viewing angle",
          description: "Pause automatic rotation before choosing a fixed angle. The left and right controls move exactly 45°, while reset returns the view to 0° north.",
        },
      },
      {
        element: "[data-tour='location-search']",
        popover: {
          title: "Search for the property",
          description: "Enter an address, city, landmark, or pincode and select a result. The editor moves from the national view to the exact rooftop.",
        },
      },
      {
        element: "[data-tour='zoom-controls']",
        popover: {
          title: "Frame the complete rooftop",
          description: "Zoom until every outside corner is visible. Keep a small margin around the building so boundary points are easier to place accurately.",
        },
      },
      {
        element: "[data-tour='workspace-toggle']",
        popover: {
          title: "Open the project workspace",
          description: "This panel contains the complete workflow: draw the roof, configure its surface, arrange panels, set the tariff, and run the final calculation.",
        },
      },
    ];
  }

  if (phase === "drawing") {
    return [
      {
        element: "[data-tour='map-canvas']",
        popover: {
          title: "Trace the roof boundary",
          description: "Click each outside corner of the roof. Use the satellite imagery as your guide, then close the shape by clicking the first point or double-clicking.",
        },
      },
      {
        element: "[data-tour='zoom-controls']",
        popover: {
          title: "Zoom in for cleaner points",
          description: "Use these controls or your trackpad wheel to move closer. The editor supports detailed close-range marking so corners and obstacles are easier to place.",
        },
      },
      {
        element: "[data-tour='drawing-workspace']",
        popover: {
          title: "Keep an eye on the outline",
          description: "This panel confirms how many sections you have mapped and explains the next action while you draw.",
        },
      },
    ];
  }

  return [
    {
      element: "[data-tour='surface-config']",
      popover: {
        title: "Surface: model the roof",
        description: "Set tilt, safe boundary setback, maintenance walkways, shading, and roof pitch. Each info icon explains what the value changes.",
      },
    },
    {
      element: "[data-tour='panel-config']",
      popover: {
        title: "Panels: shape the array",
        description: "Choose panel wattage, alignment, orientation, azimuth, and battery backup. The preview updates as the layout changes.",
      },
    },
    {
      element: "[data-tour='tariff-config']",
      popover: {
        title: "Tariff: make savings personal",
        description: "Tune the electricity rate or use the detected utility schedule. This is what turns production into savings and payback estimates.",
      },
    },
  ];
}
