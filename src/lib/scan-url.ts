import type { ScanInput, PanelConfig, TariffConfig } from "@/types/scan";

export function encodeScanToUrl(
  scanInput: ScanInput,
  panelConfig: PanelConfig,
  tariff: TariffConfig
): string {
  const data = { si: scanInput, pc: panelConfig, t: tariff };
  const json = JSON.stringify(data);
  // Safe base64 encoding for unicode strings
  return btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, p1) => {
    return String.fromCharCode(parseInt(p1, 16));
  }));
}

export function decodeScanFromUrl(
  encoded: string
): { scanInput: ScanInput; panelConfig: PanelConfig; tariff: TariffConfig } | null {
  try {
    const json = decodeURIComponent(
      atob(encoded)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const parsed = JSON.parse(json);
    if (parsed && parsed.si && parsed.pc && parsed.t) {
      return {
        scanInput: parsed.si,
        panelConfig: parsed.pc,
        tariff: parsed.t,
      };
    }
    // Support legacy or direct query payloads: { polygon: [{lat, lng}, ...], areaM2, address, ... }
    if (parsed && Array.isArray(parsed.polygon) && parsed.polygon.length >= 3) {
      const ring = parsed.polygon.map((p: { lat: number; lng: number }) => [p.lng, p.lat] as [number, number]);
      if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
        ring.push(ring[0]);
      }
      const area = parsed.areaM2 || parsed.roofAreaM2 || 100;
      const pWatt = (parsed.panelWattage === 550 ? 550 : 450) as 450 | 550;
      const panelCount = parsed.panelCount || Math.max(4, Math.floor((area * 0.7) / 2.2));
      const kwp = Math.round((panelCount * pWatt / 1000) * 10) / 10;
      return {
        scanInput: {
          address: parsed.address || "Rooftop Structure",
          lat: parsed.polygon[0].lat,
          lng: parsed.polygon[0].lng,
          roofPolygon: [{ type: "Polygon" as const, coordinates: [ring] }],
          roofAreaM2: area,
          pitchDegrees: parsed.pitchDegrees ?? 0,
        },
        panelConfig: {
          tiltAngle: parsed.tiltAngle ?? 15,
          setbackM: parsed.setbackM ?? 0.5,
          walkwayM: parsed.walkwayM ?? 0,
          panelWattage: pWatt,
          orientation: parsed.orientation || "portrait",
          rowAlignment: (parsed.rowAlignment === "roof_perimeter" ? "roof_perimeter" : "geographical_south"),
          panelCount,
          systemKwp: kwp,
          shading: parsed.shading || "auto",
        },
        tariff: {
          tariffPerKwh: parsed.tariffPerKwh || (parsed.monthlyBill && area ? 8.0 : 7.5),
        },
      };
    }
    return null;
  } catch (error) {
    console.error("Failed to decode scan from URL:", error);
    return null;
  }
}
