import { describe, it, expect } from "vitest";
import { filterRoutes, PALETTE_ROUTES } from "../lib/nav-registry";
import { encodeScanToUrl, decodeScanFromUrl } from "../lib/scan-url";
import type { ScanInput, PanelConfig, TariffConfig } from "@/types/scan";

// ─────────────────────────────────────────────────────────────────────────
// Pure helpers behind the global command palette. The palette drives its own
// filtering (shouldFilter={false}) so `filterRoutes` must be exact; and every
// "Your reports" item opens a scan via encodeScanToUrl → decodeScanFromUrl, so
// that round-trip must be lossless for the shapes the palette produces.
// ─────────────────────────────────────────────────────────────────────────

describe("filterRoutes", () => {
  it("returns the full list for an empty or whitespace query", () => {
    expect(filterRoutes(PALETTE_ROUTES, "")).toHaveLength(PALETTE_ROUTES.length);
    expect(filterRoutes(PALETTE_ROUTES, "   ")).toHaveLength(PALETTE_ROUTES.length);
  });

  it("matches on the visible title, case-insensitively", () => {
    const result = filterRoutes(PALETTE_ROUTES, "MARKET");
    expect(result.map((r) => r.path)).toContain("/market-insights");
  });

  it("matches on keywords that are not in the title", () => {
    // "analyzer" is only a keyword of the Map route, never its title.
    const result = filterRoutes(PALETTE_ROUTES, "analyzer");
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe("/map");
  });

  it("matches multi-word keyword phrases", () => {
    const result = filterRoutes(PALETTE_ROUTES, "pm surya");
    expect(result.map((r) => r.path)).toContain("/policy-tracker");
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterRoutes(PALETTE_ROUTES, "zzz-no-such-route")).toEqual([]);
  });

  it("does not mutate the source array", () => {
    const before = [...PALETTE_ROUTES];
    filterRoutes(PALETTE_ROUTES, "map");
    expect(PALETTE_ROUTES).toEqual(before);
  });
});

describe("scan URL round-trip (palette 'Your reports' → /results?scan=)", () => {
  const scanInput: ScanInput = {
    address: "New Delhi, India",
    lat: 28.61,
    lng: 77.22,
    roofAreaM2: 120,
    roofPolygon: [{ type: "Polygon", coordinates: [[[77.22, 28.61], [77.23, 28.61], [77.23, 28.62]]] }],
  } as ScanInput;

  const panelConfig: PanelConfig = {
    tiltAngle: 15,
    setbackM: 0.5,
    walkwayM: 0.5,
    panelWattage: 550,
    orientation: "portrait",
    rowAlignment: "geographical_south",
    panelCount: 18,
    systemKwp: 9.9,
    shading: "none",
  } as PanelConfig;

  const tariff: TariffConfig = { tariffPerKwh: 7.5 } as TariffConfig;

  it("encodes to a URL-safe token and decodes back to equivalent data", () => {
    const token = encodeScanToUrl(scanInput, panelConfig, tariff);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);

    const decoded = decodeScanFromUrl(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.scanInput.address).toBe("New Delhi, India");
    expect(decoded!.scanInput.lat).toBe(28.61);
    expect(decoded!.panelConfig.systemKwp).toBe(9.9);
    expect(decoded!.tariff.tariffPerKwh).toBe(7.5);
  });

  it("returns null for a malformed token instead of throwing", () => {
    expect(decodeScanFromUrl("not-valid-base64-@@@")).toBeNull();
  });
});
