import { describe, it, expect } from "vitest";
import { encodeScanToUrl, decodeScanFromUrl } from "../lib/scan-url";
import type { ScanInput, PanelConfig, TariffConfig } from "../types/scan";

describe("scan-url utilities", () => {
  it("should encode and decode a scan configuration correctly", () => {
    const scanInput: ScanInput = {
      address: "Bengaluru, Karnataka, India",
      lat: 12.9716,
      lng: 77.5946,
      roofPolygon: [
        {
          type: "Polygon",
          coordinates: [
            [
              [77.5940, 12.9710],
              [77.5950, 12.9710],
              [77.5950, 12.9720],
              [77.5940, 12.9710]
            ]
          ]
        }
      ],
      roofAreaM2: 120.5,
    };

    const panelConfig: PanelConfig = {
      tiltAngle: 15,
      setbackM: 0.5,
      walkwayM: 0.8,
      panelWattage: 450,
      orientation: "portrait",
      rowAlignment: "roof_perimeter",
      panelCount: 42,
      systemKwp: 18.9,
    };

    const tariff: TariffConfig = {
      tariffPerKwh: 7.0,
    };

    const encoded = encodeScanToUrl(scanInput, panelConfig, tariff);
    expect(typeof encoded).toBe("string");

    const decoded = decodeScanFromUrl(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.scanInput).toEqual(scanInput);
    expect(decoded!.panelConfig).toEqual(panelConfig);
    expect(decoded!.tariff).toEqual(tariff);
  });

  it("should encode and decode multiple polygons correctly", () => {
    const scanInput: ScanInput = {
      address: "New Delhi, Delhi, India",
      lat: 28.6139,
      lng: 77.2090,
      roofPolygon: [
        {
          type: "Polygon",
          coordinates: [
            [
              [77.2080, 28.6130],
              [77.2090, 28.6130],
              [77.2090, 28.6140],
              [77.2080, 28.6130]
            ]
          ]
        },
        {
          type: "Polygon",
          coordinates: [
            [
              [77.2100, 28.6150],
              [77.2110, 28.6150],
              [77.2110, 28.6160],
              [77.2100, 28.6150]
            ]
          ]
        }
      ],
      roofAreaM2: 240.2,
    };

    const panelConfig: PanelConfig = {
      tiltAngle: 10,
      setbackM: 0.6,
      walkwayM: 0,
      panelWattage: 550,
      orientation: "landscape",
      rowAlignment: "geographical_south",
      panelCount: 88,
      systemKwp: 48.4,
    };

    const tariff: TariffConfig = {
      tariffPerKwh: 8.0,
    };

    const encoded = encodeScanToUrl(scanInput, panelConfig, tariff);
    const decoded = decodeScanFromUrl(encoded);

    expect(decoded).not.toBeNull();
    expect(decoded!.scanInput.roofPolygon.length).toBe(2);
    expect(decoded!.scanInput).toEqual(scanInput);
  });

  it("should return null for invalid base64 encoding", () => {
    const decoded = decodeScanFromUrl("invalid-base64-string!!");
    expect(decoded).toBeNull();
  });
});
