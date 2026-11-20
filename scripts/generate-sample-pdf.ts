import React from "react";
import ReactPDF from "@react-pdf/renderer";
import { resolve } from "path";
import { PDFReport } from "../src/components/report/PDFReport";
import { buildReportData } from "../src/components/report/types";

// Realistic compounding financial inputs requested for Phase 3c
const baseAnnualKwh = 8500;
const tariff = 8.0; // ₹8.00/kWh
const escalation = 0.045; // 4.5%/yr
const degradation = 0.005; // 0.5%/yr
const grossCost = 350000; // ₹3.50 Lakhs
const subsidyInr = 78000; // PM Surya Ghar cap for 5.4 kWp
const netCostInr = grossCost - subsidyInr; // ₹2.72 Lakhs

const yearlySavings: number[] = [];
const cashFlows: number[] = [-netCostInr];
const cumulativeCashFlow: number[] = [-netCostInr];
let runningCum = -netCostInr;

for (let y = 1; y <= 25; y++) {
  const gen = y === 1 ? Math.round(baseAnnualKwh * 0.995) : Math.round(baseAnnualKwh * (1 - y * degradation));
  const t = tariff * Math.pow(1 + escalation, y - 1);
  const sav = Math.round(gen * t);
  const om = Math.round((grossCost * 0.01) * Math.pow(1 + 0.04, y - 1));
  const net = sav - om;
  runningCum += net;
  yearlySavings.push(sav);
  cashFlows.push(net);
  cumulativeCashFlow.push(runningCum);
}

// Calculate true NPV at 8.5% discount rate
const discountRate = 0.085;
let npv = -netCostInr;
for (let y = 1; y <= 25; y++) {
  npv += (cashFlows[y] ?? 0) / Math.pow(1 + discountRate, y);
}

// Calculate IRR
let irr = 0.15;
for (let iter = 0; iter < 100; iter++) {
  let f = 0;
  let df = 0;
  for (let t = 0; t <= 25; t++) {
    f += cashFlows[t] / Math.pow(1 + irr, t);
    if (t > 0) df -= (t * cashFlows[t]) / Math.pow(1 + irr, t + 1);
  }
  const next = irr - f / df;
  if (Math.abs(next - irr) < 1e-6) {
    irr = next;
    break;
  }
  irr = next;
}

const mockSolarData = {
  location: { label: "Bandra West, Mumbai, Maharashtra", lat: 19.0596, lng: 72.8295 },
  rooftop: { drawnAreaM2: 80, usableAreaM2: 60 },
  energy: { peakSunHoursDaily: 5.2, annualKwh: 8500 },
  investment: {
    systemCostInr: grossCost,
    subsidyInr,
    netCostInr,
    paybackYears: 4.0,
    npv: Math.round(npv),
    irr: Number((irr * 100).toFixed(1)),
    lcoe: 2.8,
  },
  financials: {
    savings25yrInr: cumulativeCashFlow[25],
    electricityRateInr: tariff,
  },
  environmental: { co2AnnualKg: 6800, treesEquivalent: 310 },
  roof: { tilt: 19, azimuth: 180, type: "Reinforced Concrete (RCC) Flat Roof" },
  tempDerate: { percent: 4.2 },
};

const mockModel = {
  installedKw: 5.4,
  panelCount: 12,
  pType: "compact" as const,
  baseAnnualKwh,
  subsidyInr,
  grossCost,
  netCostInr,
  paybackPeriod: 4.0,
  breakEvenYr: 4,
  npv: Math.round(npv),
  irr: Number((irr * 100).toFixed(1)),
  lcoe: 2.8,
  yearlySavings,
  cashFlows,
  cumulativeCashFlow,
};

async function main() {
  const report = buildReportData(mockSolarData, mockModel, 12, "compact", tariff, 4.5, 8.5);
  // Fixed realistic baseline sample date (Nov 2025)
  report.generatedAt = "2025-11-21T00:00:00.000Z";
  
  console.log("=== REALISTIC COMPOUNDING VERIFICATION ===");
  console.log("Year 1 Net Cashflow:", report.financial.cashFlowRows[0].netCashflowInr);
  console.log("Year 10 Net Cashflow:", report.financial.cashFlowRows[9].netCashflowInr);
  console.log("Year 25 Net Cashflow:", report.financial.cashFlowRows[24].netCashflowInr);
  console.log("Year 3 Cumulative:", report.financial.cashFlowRows[2].cumulativeInr);
  console.log("Year 4 Cumulative:", report.financial.cashFlowRows[3].cumulativeInr);
  console.log("Year 5 Cumulative:", report.financial.cashFlowRows[4].cumulativeInr);
  console.log("Year 25 Cumulative:", report.financial.cashFlowRows[24].cumulativeInr);
  console.log("Year 1 Net * 25:", report.financial.cashFlowRows[0].netCashflowInr * 25);
  console.log("BreakEven Year:", report.financial.breakEvenYear);
  console.log("Simple Payback KPI:", report.financial.paybackPeriod.toFixed(1) + " Yrs");

  const outPath = resolve(process.cwd(), "SolarScan-Feasibility-Report-Phase3b.pdf");
  await ReactPDF.renderToFile(React.createElement(PDFReport, { report }), outPath);
  console.log("PDF successfully generated at:", outPath);
}

main().catch(console.error);
