import { create } from "zustand";
import type { ScanInput, PanelConfig, TariffConfig, ScanResults, LatLng } from "@/types/scan";
import type { SolarAnalysis } from "@/lib/solar-calc";
import { supabase } from "@/lib/supabase";

interface ScanStore {
  // State slices
  scanInput: ScanInput | null;
  panelConfig: PanelConfig | null;
  tariff: TariffConfig | null;
  results: ScanResults | null;
  fullAnalysis: (SolarAnalysis & { location?: { lat: number; lng: number; label: string }; panelCount?: number; unlocked?: boolean }) | null;
  isPaid: boolean;
  paymentId: string | null;
  pitchDegrees: number;
  exclusionZones: LatLng[][];
  exclusionAreaM2: number;
  computedShadingLoss: number | null;
  nearbyStructuresCount: number;
  viewMode: '2d' | '3d';
  shadingSource: 'auto' | 'manual';
  shadingLoss: number;

  // Actions
  setViewMode: (mode: '2d' | '3d') => void;
  setScanInput: (input: ScanInput) => void;
  setPanelConfig: (config: PanelConfig) => void;
  setTariff: (tariff: TariffConfig) => void;
  setResults: (results: ScanResults) => void;
  setFullAnalysis: (analysis: ScanStore["fullAnalysis"]) => void;
  setIsPaid: (paid: boolean, paymentId?: string) => void;
  setPitchDegrees: (pitch: number) => void;
  setExclusionZones: (zones: LatLng[][]) => void;
  setExclusionAreaM2: (area: number) => void;
  setComputedShadingLoss: (loss: number | null) => void;
  setNearbyStructuresCount: (count: number) => void;
  setShadingSource: (source: 'auto' | 'manual') => void;
  setShadingLoss: (loss: number) => void;
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
  pitchDegrees: 0,
  exclusionZones: [],
  exclusionAreaM2: 0,
  computedShadingLoss: null,
  nearbyStructuresCount: 0,
  viewMode: (typeof window !== 'undefined' ? localStorage.getItem('solarsan-view-mode') as '2d' | '3d' : '2d') || '2d',
  shadingSource: 'auto' as const,
  shadingLoss: 0,
};

export const useScanStore = create<ScanStore>((set) => ({
  ...initialState,

  setViewMode: (mode) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('solarsan-view-mode', mode);
    }
    set({ viewMode: mode });
  },
  setScanInput: (input) => set({ scanInput: input }),
  setPanelConfig: (config) => set({ panelConfig: config }),
  setTariff: (tariff) => set({ tariff }),
  setResults: (results) => set({ results }),
  setFullAnalysis: (analysis) => {
    set({ fullAnalysis: analysis });
    if (analysis) {
      const address = analysis.location?.label || "Unknown Address";
      const lat = analysis.location?.lat || 0;
      const lng = analysis.location?.lng || 0;
      const rooftop_area_m2 = analysis.rooftop?.drawnAreaM2 || 0;
      const installed_kw = analysis.energy?.installedCapacityKw || 0;
      const annual_kwh = analysis.energy?.annualKwh || 0;
      const system_cost_inr = analysis.investment?.systemCostInr || 0;
      const payback_years = analysis.investment?.paybackYears || 0;
      const created_at = analysis.generatedAt || new Date().toISOString();

      if (supabase) {
        supabase
          .from("analysis_sessions")
          .insert({
            address,
            lat,
            lng,
            rooftop_area_m2,
            installed_kw,
            annual_kwh,
            system_cost_inr,
            payback_years,
            created_at,
          })
          .then(() => {})
          .catch((e) => console.error('Scan persist failed:', e));
      }
    }
  },
  setIsPaid: (paid, paymentId) => set({ isPaid: paid, paymentId: paymentId || null }),
  setPitchDegrees: (pitch) => set({ pitchDegrees: pitch }),
  setExclusionZones: (zones) => set({ exclusionZones: zones }),
  setExclusionAreaM2: (area) => set({ exclusionAreaM2: area }),
  setComputedShadingLoss: (loss) => set({ computedShadingLoss: loss }),
  setNearbyStructuresCount: (count) => set({ nearbyStructuresCount: count }),
  setShadingSource: (source) => set({ shadingSource: source }),
  setShadingLoss: (loss) => set({ shadingLoss: loss }),
  reset: () => set(initialState),
}));
