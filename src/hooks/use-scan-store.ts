import { create } from "zustand";
import type { ScanInput, PanelConfig, TariffConfig, ScanResults } from "@/types/scan";
import type { SolarAnalysis } from "@/lib/solar-calc";

interface ScanStore {
  // State slices
  scanInput: ScanInput | null;
  panelConfig: PanelConfig | null;
  tariff: TariffConfig | null;
  results: ScanResults | null;
  fullAnalysis: (SolarAnalysis & { location?: { lat: number; lng: number; label: string }; panelCount?: number; unlocked?: boolean }) | null;
  isPaid: boolean;
  paymentId: string | null;

  // Actions
  setScanInput: (input: ScanInput) => void;
  setPanelConfig: (config: PanelConfig) => void;
  setTariff: (tariff: TariffConfig) => void;
  setResults: (results: ScanResults) => void;
  setFullAnalysis: (analysis: ScanStore["fullAnalysis"]) => void;
  setIsPaid: (paid: boolean, paymentId?: string) => void;
  reset: () => void;
}

const initialState = {
  scanInput: null,
  panelConfig: null,
  tariff: null,
  results: null,
  fullAnalysis: null,
  isPaid: false,
  paymentId: null,
};

export const useScanStore = create<ScanStore>((set) => ({
  ...initialState,

  setScanInput: (input) => set({ scanInput: input }),
  setPanelConfig: (config) => set({ panelConfig: config }),
  setTariff: (tariff) => set({ tariff }),
  setResults: (results) => set({ results }),
  setFullAnalysis: (analysis) => set({ fullAnalysis: analysis }),
  setIsPaid: (paid, paymentId) => set({ isPaid: paid, paymentId: paymentId || null }),
  reset: () => set(initialState),
}));
