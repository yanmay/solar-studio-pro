import type { ScanInput, PanelConfig, TariffConfig } from "@/types/scan";

export function encodeScanToUrl(
  scanInput: ScanInput,
  panelConfig: PanelConfig,
  tariff: TariffConfig
): string {
  // Never encode unlock/payment state into shareable URLs — unlock state is
  // server-authoritative (see use-unlock-status.ts). Strip any legacy flag.
  const { unlocked: _legacyUnlocked, ...safeScanInput } = scanInput as ScanInput & {
    unlocked?: boolean;
  };
  const data = { si: safeScanInput, pc: panelConfig, t: tariff };
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
      // Ignore any legacy client-supplied unlock flag — a tampered URL must
      // never influence paywall state.
      delete parsed.si.unlocked;
      return {
        scanInput: parsed.si,
        panelConfig: parsed.pc,
        tariff: parsed.t,
      };
    }
    return null;
  } catch (error) {
    console.error("Failed to decode scan from URL:", error);
    return null;
  }
}
