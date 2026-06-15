import { describe, it, expect } from "vitest";
import { computePanelLayout } from "../lib/panel-layout";

describe("panel-layout", () => {
  it("should place panels inside a simple square polygon", () => {
    const vertices = [
      { lat: 28.6139, lng: 77.2090 },
      { lat: 28.6139, lng: 77.2095 },
      { lat: 28.6134, lng: 77.2095 },
      { lat: 28.6134, lng: 77.2090 },
    ];

    const result = computePanelLayout(vertices, {
      panelType: "compact",
      alignment: "roof",
      tiltDeg: 15,
      orientation: "portrait",
      walkways: true,
      setbackM: 0.5,
    });

    console.log("Large Polygon - Panel Count:", result.panelCount);
    expect(result.panelCount).toBeGreaterThan(0);
  });

  it("should place panels inside a small 50m2 square polygon", () => {
    // 7.07m x 7.07m square
    const dLat = 7.07 / 111320;
    const dLng = 7.07 / (111320 * Math.cos(28.6139 * Math.PI / 180));

    const vertices = [
      { lat: 28.6139, lng: 77.2090 },
      { lat: 28.6139 + dLat, lng: 77.2090 },
      { lat: 28.6139 + dLat, lng: 77.2090 + dLng },
      { lat: 28.6139, lng: 77.2090 + dLng },
    ];

    const result = computePanelLayout(vertices, {
      panelType: "compact",
      alignment: "roof",
      tiltDeg: 15,
      orientation: "portrait",
      walkways: true,
      setbackM: 0.5,
    });

    console.log("Small Polygon - Panel Count:", result.panelCount);
  });
});
