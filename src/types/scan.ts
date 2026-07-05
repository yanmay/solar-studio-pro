export interface RoofPolygon {
  type: 'Polygon';
  coordinates: [number, number][][];
}

export interface ScanInput {
  address: string;
  lat: number;
  lng: number;
  roofPolygon: RoofPolygon[];
  roofAreaM2: number;
}

export interface PanelConfig {
  tiltAngle: number;
  setbackM: number;
  walkwayM: number;
  panelWattage: 450 | 550;
  orientation: 'portrait' | 'landscape';
  rowAlignment: 'roof_perimeter' | 'geographical_south';
  panelCount: number;
  systemKwp: number;
  shading?: 'none' | 'partial' | 'heavy';
}

export interface MonthlyValue {
  month: string;
  value: number;
}

export interface ScanResults {
  annualYieldKwh: number;
  monthlyYields: MonthlyValue[];
  cashflow: { year: number; cumulative: number }[];
  roiPercent: number;
  paybackYears: number;
  grossCostInr: number;
  subsidyAmountInr: number;
  netCostInr: number;
  emiInr: number;
  annualCo2KgSaved: number;
  treesEquivalent: number;
}

export interface TariffConfig {
  tariffPerKwh: number;
}
