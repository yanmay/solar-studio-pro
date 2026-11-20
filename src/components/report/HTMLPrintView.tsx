/**
 * HTMLPrintView — HTML QA surface for the Solar Feasibility Report.
 * Triggered via ?print=1 in the browser.
 *
 * Mirrors the exact structure and layout of the PDF pages using HTML/Tailwind,
 * serving as an eyeball QA surface and printable document.
 */
import React from "react";
import type { ReportData } from "./types";
import { inrFmt, inrLakhs, formatReportFooter } from "./tokens";

interface HTMLPrintViewProps {
  report: ReportData;
}

export function HTMLPrintView({ report }: HTMLPrintViewProps) {
  const { site, system, financial, subsidy, quotation } = report;
  const dateStr = new Date(report.generatedAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 p-4 sm:p-8 print:p-0 print:bg-white print:text-black">
      {/* Top QA Banner (hidden when printing) */}
      <div className="max-w-[794px] mx-auto mb-6 p-4 rounded-xl bg-neutral-800 border border-neutral-700 flex justify-between items-center print:hidden">
        <div>
          <span className="inline-block px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-[#FF6600]/20 text-[#FF6600]">
            QA Print Preview (?print=1)
          </span>
          <p className="text-xs text-neutral-400 mt-1">
            Visual inspection surface for Phase 3b (8-page investment-grade prospectus). Layout mirrors @react-pdf/renderer output.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-[#FF6600] text-black text-xs font-bold rounded-lg hover:bg-[#FF7A1A] cursor-pointer transition-colors"
        >
          Print / Save PDF
        </button>
      </div>

      {/* ── PAGE 1: COVER PAGE (A4: 210mm x 297mm or 794px x 1123px at 96 DPI) ── */}
      <div className="max-w-[794px] min-h-[1123px] mx-auto bg-[#0A0A0A] text-white flex flex-col justify-between p-12 mb-8 shadow-2xl relative overflow-hidden print:shadow-none print:m-0 print:break-after-page">
        {/* Top Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#FF6600]" />

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#FF6600] flex items-center justify-center font-bold text-black text-lg">
            S
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">SolarScan AI</h1>
            <p className="text-[10px] tracking-widest text-neutral-400 uppercase">Rooftop Solar Intelligence</p>
          </div>
        </div>

        {/* Hero Section */}
        <div className="my-auto py-12">
          <div className="inline-block px-3 py-1 rounded-full bg-[#FF6600]/15 text-[#FF6600] text-[10px] font-bold tracking-widest uppercase mb-4">
            Solar Feasibility Report
          </div>
          <div className="w-12 h-1 bg-[#2BD4A0] rounded mb-6" />

          <h2 className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight max-w-xl text-white mb-4">
            Your roof can save{" "}
            <span className="text-[#FF6600]">{inrLakhs(financial.year1SavingInr)}</span>
            {" "}every year.
          </h2>
          <p className="text-neutral-400 text-sm max-w-lg mb-10">{site.address}</p>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[#141414] border border-neutral-800 rounded-xl p-4">
              <span className="block text-[10px] text-neutral-400 font-bold uppercase tracking-wider mb-1">System Size</span>
              <span className="text-2xl font-bold text-white">{system.installedKw.toFixed(1)}</span>
              <span className="block text-xs text-[#2BD4A0] mt-0.5">kWp installed</span>
            </div>
            <div className="bg-[#141414] border border-neutral-800 rounded-xl p-4">
              <span className="block text-[10px] text-neutral-400 font-bold uppercase tracking-wider mb-1">Payback</span>
              <span className="text-2xl font-bold text-white">{financial.paybackPeriod.toFixed(1)}</span>
              <span className="block text-xs text-[#2BD4A0] mt-0.5">years to break-even</span>
            </div>
            <div className="bg-[#141414] border border-neutral-800 rounded-xl p-4">
              <span className="block text-[10px] text-neutral-400 font-bold uppercase tracking-wider mb-1">Govt Subsidy</span>
              <span className="text-2xl font-bold text-white">
                {financial.subsidyInr > 0 ? inrLakhs(financial.subsidyInr) : "N/A"}
              </span>
              <span className="block text-xs text-[#2BD4A0] mt-0.5">PM Surya Ghar</span>
            </div>
            <div className="bg-[#141414] border border-neutral-800 rounded-xl p-4">
              <span className="block text-[10px] text-neutral-400 font-bold uppercase tracking-wider mb-1">25-Yr Savings</span>
              <span className="text-2xl font-bold text-white">{inrLakhs(financial.savings25yrInr)}</span>
              <span className="block text-xs text-[#2BD4A0] mt-0.5">cumulative</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-800 pt-6 flex justify-between items-center text-xs text-neutral-500 font-mono">
          <span>{formatReportFooter(report.reportId, report.generatedAt, 1)}</span>
        </div>
      </div>

      {/* ── PAGE 2: EXECUTIVE SUMMARY (A4) ── */}
      <div className="max-w-[794px] min-h-[1123px] mx-auto bg-white text-neutral-900 flex flex-col justify-between p-12 shadow-2xl relative overflow-hidden print:shadow-none print:m-0 print:break-after-page">
        {/* Top Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#FF6600]" />

        <div>
          {/* Header */}
          <div className="border-b border-neutral-200 pb-4 mb-6 flex justify-between items-end">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">Executive Summary & Financial Prospectus</h2>
              <p className="text-xs text-neutral-500 font-mono mt-0.5">{site.address}</p>
            </div>
            <span className="text-xs font-mono text-neutral-400">REF: {report.reportId.toUpperCase()}</span>
          </div>

          {/* Feasibility Metrics */}
          <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-800 mb-3">Key Feasibility Metrics</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3">
              <span className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">Capacity</span>
              <span className="text-lg font-bold text-neutral-900">{system.installedKw.toFixed(2)} kWp</span>
              <span className="block text-[10px] text-neutral-500 mt-0.5">{system.panelCount} panels</span>
            </div>
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3">
              <span className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">Annual Yield</span>
              <span className="text-lg font-bold text-neutral-900">{inrFmt(system.annualKwhYear1)} kWh</span>
              <span className="block text-[10px] text-neutral-500 mt-0.5">Year 1 generation</span>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <span className="block text-[10px] font-bold uppercase text-orange-600 mb-1">Year 1 Savings</span>
              <span className="text-lg font-bold text-[#FF6600]">₹{inrFmt(financial.year1SavingInr)}</span>
              <span className="block text-[10px] text-neutral-500 mt-0.5">₹{financial.tariff.toFixed(1)}/kWh tariff</span>
            </div>
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3">
              <span className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">Payback Period</span>
              <span className="text-lg font-bold text-neutral-900">{financial.paybackPeriod.toFixed(1)} Years</span>
              <span className="block text-[10px] text-neutral-500 mt-0.5">Breakeven Y{financial.breakEvenYear}</span>
            </div>
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3">
              <span className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">25-Yr NPV</span>
              <span className="text-lg font-bold text-neutral-900">{inrLakhs(financial.npv)}</span>
              <span className="block text-[10px] text-neutral-500 mt-0.5">{financial.discountRatePct}% discount</span>
            </div>
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3">
              <span className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">Project IRR</span>
              <span className="text-lg font-bold text-neutral-900">{financial.irr.toFixed(1)}%</span>
              <span className="block text-[10px] text-neutral-500 mt-0.5">Hurdle ~12%</span>
            </div>
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3">
              <span className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">Central Subsidy</span>
              <span className="text-lg font-bold text-neutral-900">
                {financial.subsidyInr > 0 ? inrLakhs(financial.subsidyInr) : "₹0"}
              </span>
              <span className="block text-[10px] text-neutral-500 mt-0.5">PM Surya Ghar</span>
            </div>
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3">
              <span className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">Net Capex</span>
              <span className="text-lg font-bold text-neutral-900">{inrLakhs(financial.netCapexInr)}</span>
              <span className="block text-[10px] text-neutral-500 mt-0.5">Gross: {inrLakhs(financial.grossCapexInr)}</span>
            </div>
          </div>

          {/* Subsidy Note */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6 flex justify-between items-center">
            <div>
              <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wide">PM Surya Ghar: Muft Bijli Yojana Status</h4>
              <p className="text-xs text-emerald-700 mt-1 max-w-xl">
                {subsidy.eligible
                  ? `Eligible for direct subsidy of ${inrLakhs(subsidy.amount)} for a ${system.installedKw.toFixed(1)} kWp system under MNRE guidelines.`
                  : system.installedKw > 10
                    ? `System size (${system.installedKw.toFixed(1)} kWp) exceeds the 10 kWp PM Surya Ghar residential ceiling. Subsidy is ₹0.`
                    : "Non-residential or unassisted installation category."}
              </p>
            </div>
            <span className="px-3 py-1 bg-emerald-700 text-white text-[10px] font-bold rounded uppercase">
              {subsidy.eligible ? "Eligible" : subsidy.cap10kWpApplied ? "Exceeds Cap" : "Standard"}
            </span>
          </div>

          {/* 25-Year Cumulative Cashflow Summary */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wide">25-Year Financial Trajectory</h4>
                <p className="text-[11px] text-neutral-500">
                  Includes 0.5%/yr degradation, {financial.escalationPct}%/yr tariff inflation, and routine O&M costs.
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-600">
                Net 25-Yr Return: {inrLakhs(financial.savings25yrInr)}
              </span>
            </div>

            {/* Quick Balance Preview Table (5-year intervals) */}
            <div className="grid grid-cols-6 gap-2 text-center text-xs">
              {[0, 5, 10, 15, 20, 25].map((yr) => {
                const val = financial.cumulativeCashFlow?.[yr] ?? 0;
                return (
                  <div key={yr} className="bg-white border border-neutral-200 rounded p-2">
                    <span className="block text-[10px] text-neutral-400 font-mono">Year {yr}</span>
                    <span className={`font-bold ${val >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {inrLakhs(val)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-200 pt-4 flex justify-between items-center text-xs text-neutral-400 font-mono">
          <span>{formatReportFooter(report.reportId, report.generatedAt, 2)}</span>
        </div>
      </div>

      {/* ── PAGE 3: SITE & ROOFTOP FEASIBILITY ANALYSIS ── */}
      <div className="max-w-[794px] min-h-[1123px] mx-auto bg-white text-neutral-900 flex flex-col justify-between p-12 mb-8 shadow-2xl relative overflow-hidden print:shadow-none print:m-0 print:break-after-page">
        {/* Top Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-[#FF6600]" />

        <div>
          {/* Header */}
          <div className="flex justify-between items-center border-b border-neutral-200 pb-3 mb-6">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">Site & Rooftop Feasibility Analysis</h2>
              <p className="text-xs text-neutral-500 font-mono">Geospatial Boundary · Solar Climatology · Shading Profile</p>
            </div>
            <span className="text-xs font-mono text-neutral-400">PAGE 3</span>
          </div>

          {/* Section 1: Satellite Imagery & Geometry */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Left: Imagery Panel */}
            <div>
              <div className="h-44 bg-[#111113] rounded-lg border border-neutral-200 overflow-hidden relative flex items-center justify-center">
                {site.satelliteImageUrl ? (
                  <img src={site.satelliteImageUrl} alt="Satellite Rooftop" className="w-full h-full object-cover" />
                ) : (
                  <svg width="220" height="130" viewBox="0 0 220 130" className="opacity-80">
                    <rect x="10" y="10" width="200" height="110" fill="#18181B" stroke="#27272A" strokeWidth="1" rx="4" />
                    <polygon points="30,25 180,25 195,95 45,105" fill="#242428" stroke="#FF6600" strokeWidth="1.5" />
                    <line x1="45" y1="45" x2="180" y2="45" stroke="#3F3F46" strokeWidth="0.75" strokeDasharray="3 2" />
                    <line x1="45" y1="65" x2="185" y2="65" stroke="#3F3F46" strokeWidth="0.75" strokeDasharray="3 2" />
                    <line x1="45" y1="85" x2="190" y2="85" stroke="#3F3F46" strokeWidth="0.75" strokeDasharray="3 2" />
                  </svg>
                )}
                <div className="absolute bottom-2 left-2 right-2 flex justify-between text-[9px] font-mono">
                  <span className="bg-black/70 text-white px-2 py-0.5 rounded">GPS: {site.lat.toFixed(4)}°N, {site.lng.toFixed(4)}°E</span>
                  <span className="bg-black/70 text-[#2BD4A0] px-2 py-0.5 rounded font-bold">
                    {site.rooftopAreaM2 > 0 ? ((site.usableAreaM2 / site.rooftopAreaM2) * 100).toFixed(0) : "75"}% USABLE FOOTPRINT
                  </span>
                </div>
              </div>
              <p className="text-[10px] font-mono text-neutral-400 mt-1">HD Geospatial Satellite Imagery & Traced Boundary</p>
            </div>

            {/* Right: Geometry Summary */}
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3.5 flex flex-col justify-between text-xs">
              <h3 className="font-bold text-neutral-900 mb-2">Roof Geometry & Solar Exposure</h3>
              <div className="space-y-1.5 divide-y divide-neutral-200">
                <div className="flex justify-between items-center pt-1">
                  <span className="text-neutral-500">Total Traced Area</span>
                  <span className="font-bold font-mono text-neutral-800">{site.rooftopAreaM2} m² ({Math.round(site.rooftopAreaM2 * 10.764)} sq.ft)</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-neutral-500">Usable Solar Surface</span>
                  <span className="font-bold font-mono text-[#FF6600]">{site.usableAreaM2} m² ({Math.round(site.usableAreaM2 * 10.764)} sq.ft)</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-neutral-500">Plane-of-Array Tilt</span>
                  <span className="font-bold font-mono text-neutral-800">{site.tiltDeg}° (Optimized for Latitude)</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-neutral-500">Azimuth Orientation</span>
                  <span className="font-bold font-mono text-neutral-800">{site.orientationLabel} ({site.azimuth}°)</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-neutral-500">Grid Jurisdiction / DISCOM</span>
                  <span className="font-bold font-mono text-neutral-800">{site.state ? `${site.state} (${subsidy.discomName})` : "National Standard"}</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-neutral-500">Peak Sun Hours (PSH)</span>
                  <span className="font-bold font-mono text-neutral-800">{site.peakSunHoursDaily.toFixed(2)} kWh/m²/day</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Shading Breakdown Profile */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="font-bold text-xs text-neutral-900 uppercase tracking-wide">Monthly Shading & Near-Obstacle Loss Profile</h3>
                <p className="text-[11px] text-neutral-500">Simulated horizon, parapet, and seasonal sun-path raytracing derating</p>
              </div>
              <span className="text-xs font-bold text-[#FF6600]">
                Avg Shading Loss: {(site.shadingLoss * 100).toFixed(1)}%
              </span>
            </div>

            {/* Monthly Bar Chart */}
            <div className="grid grid-cols-12 gap-1.5 pt-2 items-end h-24">
              {(site.monthlyShadingProfile || []).map((m) => {
                const maxLoss = 10;
                const heightPct = Math.min(100, Math.max(12, (m.lossPct / maxLoss) * 100));
                const isHigh = m.lossPct > 4.5;
                return (
                  <div key={m.month} className="flex flex-col items-center gap-1 h-full justify-end">
                    <span className="text-[9px] font-mono text-neutral-500">{m.lossPct.toFixed(1)}%</span>
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t transition-all ${isHigh ? "bg-red-400" : "bg-[#FF6600]"}`}
                    />
                    <span className="text-[9px] font-mono font-medium text-neutral-600">{m.month}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Structural Integrity & Wind Loading */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 mb-4">
            <h3 className="font-bold text-xs text-neutral-900 uppercase tracking-wide mb-2.5">
              Structural Integrity & Wind Loading Specifications
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="block text-[10px] text-neutral-500">Roof Construction</span>
                <span className="font-bold text-neutral-800">{site.roofType}</span>
              </div>
              <div>
                <span className="block text-[10px] text-neutral-500">Array Dead Load</span>
                <span className="font-bold text-neutral-800">{site.structuralLoadKgM2.toFixed(1)} kg/m² (Permissible)</span>
              </div>
              <div>
                <span className="block text-[10px] text-neutral-500">Wind Zone Spec</span>
                <span className="font-bold text-neutral-800">{site.windZone ?? "IS 875 Part 3: Zone III"}</span>
              </div>
              <div>
                <span className="block text-[10px] text-neutral-500">Mounting Approach</span>
                <span className="font-bold text-neutral-800">Ballasted Non-Penetrating</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-200 pt-4 flex justify-between items-center text-xs text-neutral-400 font-mono">
          <span>{formatReportFooter(report.reportId, report.generatedAt, 3)}</span>
        </div>
      </div>

      {/* ── PAGE 4: SYSTEM ARCHITECTURE & TECHNICAL SPECIFICATIONS ── */}
      <div className="max-w-[794px] min-h-[1123px] mx-auto bg-white text-neutral-900 flex flex-col justify-between p-12 mb-8 shadow-2xl relative overflow-hidden print:shadow-none print:m-0 print:break-after-page">
        {/* Top Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-[#FF6600]" />

        <div>
          {/* Header */}
          <div className="flex justify-between items-center border-b border-neutral-200 pb-3 mb-6">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">System Architecture & Technical Specifications</h2>
              <p className="text-xs text-neutral-500 font-mono">CAD Array Layout · Electrical Stringing · Equipment BOM</p>
            </div>
            <span className="text-xs font-mono text-neutral-400">PAGE 4</span>
          </div>

          {/* Section 1: Array Layout Diagram (SVG) */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="font-bold text-xs text-neutral-900 uppercase tracking-wide">Array Geometric Placement & String Routing</h3>
                <p className="text-[11px] text-neutral-500">
                  {system.panelCount} × {system.panelWattage}Wp High-Efficiency Half-Cut Solar Modules ({system.installedKw.toFixed(2)} kWp Array)
                </p>
              </div>
              <span className="text-xs font-mono text-[#2BD4A0]">Orientation: {site.orientationLabel}</span>
            </div>

            {/* SVG Array Grid */}
            <div className="bg-[#0D0D11] rounded-lg p-4 flex items-center justify-center border border-[#1E1E24]">
              {(() => {
                const totalPanels = system.panelCount;
                const columns = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(totalPanels * 1.5))));
                const rows = Math.ceil(totalPanels / columns);
                const panelW = 38;
                const panelH = 20;
                const gapX = 4;
                const gapY = 4;
                const svgW = columns * (panelW + gapX) + 20;
                const svgH = rows * (panelH + gapY) + 20;
                return (
                  <svg width={svgW} height={svgH} className="max-w-full">
                    <rect x="2" y="2" width={svgW - 4} height={svgH - 4} fill="#121216" stroke="#27272F" strokeWidth="1" rx="4" />
                    {Array.from({ length: totalPanels }).map((_, idx) => {
                      const r = Math.floor(idx / columns);
                      const c = idx % columns;
                      const x = 10 + c * (panelW + gapX);
                      const y = 10 + r * (panelH + gapY);
                      const stringNum = (idx % system.stringConfig.strings) + 1;
                      const strokeCol = stringNum === 1 ? "#FF6600" : "#2BD4A0";
                      return (
                        <g key={idx}>
                          <rect x={x} y={y} width={panelW} height={panelH} fill="#1C2028" stroke={strokeCol} strokeWidth="0.8" rx="1" />
                          <line x1={x + panelW * 0.33} y1={y + 1} x2={x + panelW * 0.33} y2={y + panelH - 1} stroke="#2B3240" strokeWidth="0.5" />
                          <line x1={x + panelW * 0.66} y1={y + 1} x2={x + panelW * 0.66} y2={y + panelH - 1} stroke="#2B3240" strokeWidth="0.5" />
                        </g>
                      );
                    })}
                  </svg>
                );
              })()}
            </div>
          </div>

          {/* Section 2: Electrical Configuration & Derating Budget */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Left: Electrical Configuration Table */}
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3.5 text-xs">
              <h3 className="font-bold text-neutral-900 mb-2">Electrical String Configuration</h3>
              <div className="space-y-1.5 divide-y divide-neutral-200">
                <div className="flex justify-between items-center pt-1">
                  <span className="text-neutral-500">Array Configuration</span>
                  <span className="font-bold font-mono text-neutral-800">{system.stringConfig.strings} MPPT String{system.stringConfig.strings > 1 ? "s" : ""}</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-neutral-500">Panels Per String</span>
                  <span className="font-bold font-mono text-neutral-800">{system.stringConfig.panelsPerString} Modules in Series</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-neutral-500">Array Open-Circuit Voltage (Voc)</span>
                  <span className="font-bold font-mono text-neutral-800">{system.stringConfig.vOcTotal} V DC (STC)</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-neutral-500">Short-Circuit Current (Isc)</span>
                  <span className="font-bold font-mono text-neutral-800">{system.stringConfig.iScTotal} A DC</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-neutral-500">DC to AC Loading Ratio</span>
                  <span className="font-bold font-mono text-[#FF6600]">{system.dcAcRatio.toFixed(2)} : 1</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-neutral-500">Grid Voltage Level</span>
                  <span className="font-bold font-mono text-neutral-800">{system.inverterModel.includes("Three") ? "415V Three Phase" : "230V Single Phase"}</span>
                </div>
              </div>
            </div>

            {/* Right: Loss Derate Budget */}
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3.5 text-xs">
              <h3 className="font-bold text-neutral-900 mb-2">System Performance Derating Budget</h3>
              <div className="space-y-1.5 divide-y divide-neutral-200">
                <div className="flex justify-between items-center pt-1">
                  <span className="text-neutral-500">Cell Operating Temperature</span>
                  <span className="font-bold font-mono text-neutral-800">-{system.derating.temperaturePct.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-neutral-500">Soiling & Dust Accumulation</span>
                  <span className="font-bold font-mono text-neutral-800">-{system.derating.soilingPct.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-neutral-500">Module Manufacturing Mismatch</span>
                  <span className="font-bold font-mono text-neutral-800">-{system.derating.mismatchPct.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-neutral-500">Inverter Conversion Loss</span>
                  <span className="font-bold font-mono text-neutral-800">-{system.derating.inverterPct.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-neutral-500">DC / AC Ohmic Wiring Losses</span>
                  <span className="font-bold font-mono text-neutral-800">-{system.derating.wiringPct.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center pt-1 font-bold">
                  <span className="text-neutral-900">Total System Derate (PR ~86%)</span>
                  <span className="font-mono text-[#FF6600]">-{system.derating.totalSystemLossPct.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Equipment Bill of Materials */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 mb-4">
            <h3 className="font-bold text-xs text-neutral-900 uppercase tracking-wide mb-2.5">
              Tier-1 Equipment Specifications & BOS Architecture
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="block text-[10px] text-neutral-500 uppercase tracking-wider">Photovoltaic Modules</span>
                <span className="font-bold text-neutral-800">{system.panelModel} ({system.panelWattage}Wp Monocrystalline PERC)</span>
                <span className="block text-[10px] text-neutral-500 uppercase tracking-wider mt-2">Mounting Structure & Hardware</span>
                <span className="font-bold text-neutral-800">{system.mountingType}</span>
              </div>
              <div>
                <span className="block text-[10px] text-neutral-500 uppercase tracking-wider">Power Conditioning Unit (Inverter)</span>
                <span className="font-bold text-neutral-800">{system.inverterModel}</span>
                <span className="block text-[10px] text-neutral-500 uppercase tracking-wider mt-2">Balance of System & Switchgear</span>
                <span className="font-bold text-neutral-800">{system.bosComponents}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-200 pt-4 flex justify-between items-center text-xs text-neutral-400 font-mono">
          <span>{formatReportFooter(report.reportId, report.generatedAt, 4)}</span>
        </div>
      </div>

      {/* ── PAGE 5: FINANCIAL VISUALIZATIONS & SENSITIVITY ANALYSIS ── */}
      <div className="max-w-[794px] min-h-[1123px] mx-auto bg-white text-neutral-900 flex flex-col justify-between p-12 mb-8 shadow-2xl relative overflow-hidden print:shadow-none print:m-0 print:break-after-page">
        {/* Top Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-[#FF6600]" />

        <div>
          {/* Header */}
          <div className="flex justify-between items-center border-b border-neutral-200 pb-3 mb-6">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">Financial Visualizations & Sensitivity Analysis</h2>
              <p className="text-xs text-neutral-500 font-mono">Institutional Cashflow Modeling · Capex Allocations · IRR Sensitivity</p>
            </div>
            <span className="text-xs font-mono text-neutral-400">PAGE 5</span>
          </div>

          {/* Section 1: KPI Summary Strip (4 Metrics) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-center">
              <span className="block text-[10px] text-neutral-500 font-mono uppercase">Internal Rate of Return</span>
              <span className="text-xl font-bold text-[#2BD4A0]">{financial.irr.toFixed(1)}%</span>
              <span className="block text-[10px] text-neutral-400 mt-0.5">Pre-tax Equity IRR</span>
            </div>
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-center">
              <span className="block text-[10px] text-neutral-500 font-mono uppercase">Net Present Value (NPV)</span>
              <span className="text-xl font-bold text-neutral-900">{inrLakhs(financial.npv)}</span>
              <span className="block text-[10px] text-neutral-400 mt-0.5">@ {financial.discountRatePct}% Discount</span>
            </div>
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-center">
              <span className="block text-[10px] text-neutral-500 font-mono uppercase">Simple Payback</span>
              <span className="text-xl font-bold text-[#FF6600]">{financial.paybackPeriod.toFixed(1)} Yrs</span>
              <span className="block text-[10px] text-neutral-400 mt-0.5">Break-even Horizon</span>
            </div>
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-center">
              <span className="block text-[10px] text-neutral-500 font-mono uppercase">Discounted Payback</span>
              <span className="text-xl font-bold text-neutral-900">{financial.discountedPaybackYears.toFixed(1)} Yrs</span>
              <span className="block text-[10px] text-neutral-400 mt-0.5">Cost of Capital Adjusted</span>
            </div>
          </div>

          {/* Section 2: 2x2 Chart Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Chart 1: Annual Savings */}
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3.5">
              <h3 className="font-bold text-xs text-neutral-900 mb-1">Annual Electricity Bill Savings (Y1–Y25)</h3>
              <p className="text-[10px] text-neutral-500 mb-2">Escalating at {financial.escalationPct}%/yr with 0.5% module degradation</p>
              <div className="grid grid-cols-6 gap-1 h-28 items-end pt-2">
                {[0, 4, 9, 14, 19, 24].map((idx) => {
                  const val = financial.yearlySavings?.[idx] ?? 0;
                  const maxVal = financial.yearlySavings?.[24] ?? 1;
                  const h = Math.min(100, Math.max(15, (val / maxVal) * 100));
                  return (
                    <div key={idx} className="flex flex-col items-center gap-1 h-full justify-end">
                      <span className="text-[8px] font-mono text-neutral-500">{inrFmt(val)}</span>
                      <div style={{ height: `${h}%` }} className="w-full bg-[#FF6600] rounded-t" />
                      <span className="text-[9px] font-mono font-medium text-neutral-600">Y{idx + 1}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chart 2: Cumulative Cashflow */}
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3.5">
              <h3 className="font-bold text-xs text-neutral-900 mb-1">Cumulative Net Cashflow Position</h3>
              <p className="text-[10px] text-neutral-500 mb-2">Recovery of net capital outlay crossing break-even at Year ~{financial.paybackPeriod.toFixed(0)}</p>
              <div className="grid grid-cols-6 gap-1 h-28 items-end pt-2">
                {[0, 5, 10, 15, 20, 25].map((idx) => {
                  const val = financial.cumulativeCashFlow?.[idx] ?? 0;
                  const maxVal = Math.max(1, financial.cumulativeCashFlow?.[25] ?? 1000000);
                  const isPos = val >= 0;
                  const h = Math.min(100, Math.max(15, Math.abs(val) / maxVal * 100));
                  return (
                    <div key={idx} className="flex flex-col items-center gap-1 h-full justify-end">
                      <span className="text-[8px] font-mono text-neutral-500">{inrLakhs(val)}</span>
                      <div style={{ height: `${h}%` }} className={`w-full rounded-t ${isPos ? "bg-[#2BD4A0]" : "bg-red-400"}`} />
                      <span className="text-[9px] font-mono font-medium text-neutral-600">Y{idx}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chart 3: Capex Waterfall */}
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3.5">
              <h3 className="font-bold text-xs text-neutral-900 mb-1">Capital Outlay Waterfall</h3>
              <p className="text-[10px] text-neutral-500 mb-2">Gross Turn-Key Capex to Net Homeowner Outlay</p>
              <div className="space-y-1.5 pt-1 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-neutral-600">Gross Turnkey Capex</span>
                  <span className="font-bold font-mono text-neutral-900">{inrFmt(financial.grossCapexInr)}</span>
                </div>
                <div className="flex justify-between items-center text-[#2BD4A0]">
                  <span>(-) PM Surya Ghar Subsidy</span>
                  <span className="font-bold font-mono">-{inrFmt(financial.subsidyInr)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-neutral-200 pt-1 font-bold">
                  <span className="text-neutral-900">(=) Net Capital Outlay</span>
                  <span className="font-mono text-[#FF6600]">{inrFmt(financial.netCapexInr)}</span>
                </div>
                <div className="flex justify-between items-center text-emerald-600 pt-0.5">
                  <span>(+) Year 1 Net Savings</span>
                  <span className="font-bold font-mono">+{inrFmt(financial.year1SavingInr)}</span>
                </div>
              </div>
            </div>

            {/* Chart 4: Cost Breakdown */}
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3.5">
              <h3 className="font-bold text-xs text-neutral-900 mb-1">Capital Expenditure Allocation</h3>
              <p className="text-[10px] text-neutral-500 mb-2">13.8% composite concessional GST on pre-GST base</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-neutral-600">PV Modules (Tier-1 Monocrystalline)</span>
                  <span className="font-mono font-bold text-neutral-800">{inrFmt(financial.costBreakdown.panelsInr)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-600">Grid Inverter & Monitoring</span>
                  <span className="font-mono font-bold text-neutral-800">{inrFmt(financial.costBreakdown.inverterInr)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-600">Mounting Hardware & Electrical BOS</span>
                  <span className="font-mono font-bold text-neutral-800">{inrFmt(financial.costBreakdown.mountingBosInr)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-600">Installation, Civil & Commissioning</span>
                  <span className="font-mono font-bold text-neutral-800">{inrFmt(financial.costBreakdown.laborInstallInr)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-neutral-200 pt-1 text-neutral-500">
                  <span>Concessional GST (13.8% Composite)</span>
                  <span className="font-mono font-bold text-neutral-800">{inrFmt(financial.costBreakdown.gstInr)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-200 pt-4 flex justify-between items-center text-xs text-neutral-400 font-mono">
          <span>{formatReportFooter(report.reportId, report.generatedAt, 5)}</span>
        </div>
      </div>

      {/* ── PAGE 6: 25-YEAR DETAILED CASHFLOW SCHEDULE ── */}
      <div className="max-w-[794px] min-h-[1123px] mx-auto bg-white text-neutral-900 flex flex-col justify-between p-12 mb-8 shadow-2xl relative overflow-hidden print:shadow-none print:m-0 print:break-after-page">
        {/* Top Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-[#FF6600]" />

        <div>
          {/* Header */}
          <div className="flex justify-between items-center border-b border-neutral-200 pb-3 mb-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">25-Year Detailed Cashflow Schedule</h2>
              <p className="text-xs text-neutral-500 font-mono">Annual Generation, Utility Avoidance, Degradation & O&M Provisions</p>
            </div>
            <span className="text-xs font-mono text-neutral-400">PAGE 6</span>
          </div>

          {/* 25-Row Table */}
          <div className="border border-neutral-200 rounded-lg overflow-hidden text-[10px]">
            <table className="w-full text-left divide-y divide-neutral-200">
              <thead className="bg-neutral-100 font-bold text-neutral-700">
                <tr>
                  <th className="py-1 px-2">Yr</th>
                  <th className="py-1 px-2 text-right">Generation</th>
                  <th className="py-1 px-2 text-right">Gross Saving</th>
                  <th className="py-1 px-2 text-right">Degradation</th>
                  <th className="py-1 px-2 text-right">O&M Cost</th>
                  <th className="py-1 px-2 text-right">Net Cashflow</th>
                  <th className="py-1 px-2 text-right">Cumulative Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 font-mono">
                {(financial.cashFlowRows || []).map((row) => {
                  const isBreakEven = row.year === financial.breakEvenYear;
                  return (
                    <tr key={row.year} className={isBreakEven ? "bg-amber-50 font-bold" : "hover:bg-neutral-50"}>
                      <td className="py-0.5 px-2 text-neutral-900">{row.year} {isBreakEven && "★"}</td>
                      <td className="py-0.5 px-2 text-right text-neutral-700">{row.generationKwh.toLocaleString()} kWh</td>
                      <td className="py-0.5 px-2 text-right text-neutral-700">{inrFmt(row.grossSavingsInr)}</td>
                      <td className="py-0.5 px-2 text-right text-neutral-500">-{row.degradationPct.toFixed(1)}%</td>
                      <td className="py-0.5 px-2 text-right text-red-600">-{inrFmt(row.omCostInr)}</td>
                      <td className="py-0.5 px-2 text-right text-emerald-700 font-bold">+{inrFmt(row.netCashflowInr)}</td>
                      <td className={`py-0.5 px-2 text-right font-bold ${row.cumulativeInr >= 0 ? "text-emerald-700" : "text-neutral-500"}`}>
                        {inrFmt(row.cumulativeInr)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary Audit Footer Note */}
          <div className="mt-3 p-3 bg-neutral-50 border border-neutral-200 rounded-lg flex justify-between items-center text-xs">
            <div>
              <span className="font-bold text-neutral-800">25-Year Cumulative Position:</span>{" "}
              <span className="text-emerald-700 font-bold font-mono">{inrLakhs(financial.savings25yrInr)}</span>
            </div>
            <div className="text-[11px] text-neutral-500">
              Break-Even achieved at Year {financial.breakEvenYear} · IRR: {financial.irr}% · LCOE: ₹{financial.lcoe}/kWh
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-200 pt-4 flex justify-between items-center text-xs text-neutral-400 font-mono">
          <span>{formatReportFooter(report.reportId, report.generatedAt, 6)}</span>
        </div>
      </div>

      {/* ── PAGE 7: SUBSIDY & REGULATORY COMPLIANCE ── */}
      <div className="max-w-[794px] min-h-[1123px] mx-auto bg-white text-neutral-900 flex flex-col justify-between p-12 mb-8 shadow-2xl relative overflow-hidden print:shadow-none print:m-0 print:break-after-page">
        {/* Top Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-[#FF6600]" />

        <div>
          {/* Header */}
          <div className="flex justify-between items-center border-b border-neutral-200 pb-3 mb-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">PM Surya Ghar Muft Bijli Yojana — Subsidy & Compliance</h2>
              <p className="text-xs text-neutral-500 font-mono">Institutional Feasibility, Interconnection Norms & Statutory Clearances</p>
            </div>
            <span className="text-xs font-mono text-neutral-400">PAGE 7</span>
          </div>

          {/* Section 1: PM Surya Ghar Subsidy Breakdown */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 mb-1">
              PM Surya Ghar: Muft Bijli Yojana (Central Financial Assistance)
            </h3>
            <p className="text-[11px] text-neutral-500 mb-3">
              Direct Benefit Transfer (DBT) disbursed into beneficiary bank account following DISCOM net-meter inspection.
            </p>

            {subsidy.ineligibleAbove10kW && (
              <div className="bg-red-50 border border-red-300 rounded p-2.5 mb-3 text-red-700 text-xs font-bold">
                Not eligible — residential scheme capped at 10 kWp
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div className="bg-white border border-neutral-200 rounded p-2.5">
                <span className="block text-[9px] font-bold uppercase text-neutral-400">Tier 1 (First 2 kWp)</span>
                <span className="text-base font-bold text-neutral-900">{inrLakhs(subsidy.tier1Amount)}</span>
                <span className="block text-[9px] text-neutral-500 mt-0.5">₹30,000 per kW up to 2 kW</span>
              </div>
              <div className="bg-white border border-neutral-200 rounded p-2.5">
                <span className="block text-[9px] font-bold uppercase text-neutral-400">Tier 2 (3rd kWp)</span>
                <span className="text-base font-bold text-neutral-900">{inrLakhs(subsidy.tier2Amount)}</span>
                <span className="block text-[9px] text-neutral-500 mt-0.5">₹18,000 for 2 kW to 3 kW</span>
              </div>
              <div className="bg-white border border-neutral-200 rounded p-2.5">
                <span className="block text-[9px] font-bold uppercase text-neutral-400">Capacity Above 3 kW</span>
                <span className="text-base font-bold text-neutral-900">₹0 Added</span>
                <span className="block text-[9px] text-neutral-500 mt-0.5">Capped at ₹78,000 Maximum</span>
              </div>
              <div className="bg-white border border-neutral-200 rounded p-2.5">
                <span className="block text-[9px] font-bold uppercase text-neutral-400">Residential Ceiling</span>
                <span className={`text-base font-bold ${subsidy.ineligibleAbove10kW ? "text-red-600" : "text-emerald-700"}`}>
                  {subsidy.ineligibleAbove10kW ? "EXCEEDED" : "ELIGIBLE"}
                </span>
                <span className="block text-[9px] text-neutral-500 mt-0.5">Capped at ₹78,000 for systems up to 10 kWp</span>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded p-3 flex justify-between items-center">
              <div>
                <span className="text-xs font-bold text-emerald-900">Approved Direct Central Subsidy Credit</span>
                <p className="text-[10px] text-emerald-700">
                  Applicable for {system.installedKw.toFixed(2)} kWp grid-connected residential installation in {site.state}
                </p>
              </div>
              <span className="text-lg font-bold font-mono text-emerald-800">₹{inrFmt(subsidy.amount)}</span>
            </div>
          </div>

          {/* Section 2: DISCOM Interconnection & State Policy */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 mb-2">DISCOM Technical Interconnection</h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between border-b border-neutral-200 pb-1">
                  <span className="text-neutral-500">Jurisdictional State</span>
                  <span className="font-bold text-neutral-900">{site.state}</span>
                </div>
                <div className="flex justify-between border-b border-neutral-200 pb-1">
                  <span className="text-neutral-500">Designated Utility</span>
                  <span className="font-bold text-neutral-900">{subsidy.discomName}</span>
                </div>
                <div className="flex justify-between border-b border-neutral-200 pb-1">
                  <span className="text-neutral-500">Voltage Level</span>
                  <span className="font-bold text-neutral-900">{subsidy.interconnectionVoltage}</span>
                </div>
                <div className="flex justify-between pt-0.5">
                  <span className="text-neutral-500">Net Metering</span>
                  <span className="font-bold text-neutral-900">Application required post-installation</span>
                </div>
              </div>
            </div>

            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 mb-2">State Renewable Policy Incentives</h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between border-b border-neutral-200 pb-1">
                  <span className="text-neutral-500">State Subsidy Scheme</span>
                  <span className="font-bold text-neutral-900 text-right">State subsidy: ₹0 (Phase 4 — state-specific schemes not yet modeled)</span>
                </div>
                <div className="flex justify-between border-b border-neutral-200 pb-1">
                  <span className="text-neutral-500">Electricity Duty Waiver</span>
                  <span className="font-bold text-neutral-900">100% Exemption (10 Years)</span>
                </div>
                <div className="flex justify-between border-b border-neutral-200 pb-1">
                  <span className="text-neutral-500">Banking Settlement</span>
                  <span className="font-bold text-neutral-900">Annual Net Energy Banking</span>
                </div>
                <div className="flex justify-between pt-0.5">
                  <span className="text-neutral-500">Anti-Islanding Protection</span>
                  <span className="font-bold text-neutral-900">IEEE 1547 / IEC 62116 Compliant</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Statutory Approvals Checklist */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3.5 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 mb-2">Statutory Approvals & Compliance Checklist</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-100 text-[10px] uppercase font-bold text-neutral-500">
                  <tr>
                    <th className="py-1.5 px-2">Item</th>
                    <th className="py-1.5 px-2">Authority</th>
                    <th className="py-1.5 px-2 text-center">Status</th>
                    <th className="py-1.5 px-2 text-right">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {(subsidy.complianceList || []).map((item, idx) => {
                    const isEligible = item.status === "Eligible";
                    const isRequired = item.status === "Required";
                    const isExempt = item.status === "Exempt";

                    const badgeClass = isEligible
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                      : isRequired
                      ? "bg-amber-50 text-amber-700 border-amber-300"
                      : isExempt
                      ? "bg-neutral-100 text-neutral-600 border-neutral-300"
                      : "bg-blue-50 text-blue-700 border-blue-300";

                    return (
                      <tr key={idx} className="hover:bg-white">
                        <td className="py-1.5 px-2 font-bold text-neutral-900">{item.item}</td>
                        <td className="py-1.5 px-2 text-neutral-600">{item.authority}</td>
                        <td className="py-1.5 px-2 text-center">
                          <span className={`inline-block px-2 py-0.5 border rounded text-[10px] font-bold uppercase ${badgeClass}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono text-[10px] text-neutral-500">{item.reference}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: National Standards Banner */}
          <div className="bg-neutral-100 border border-neutral-200 rounded-lg p-3 flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase text-neutral-800 tracking-wider">BIS & CEA MANDATE</span>
            <p className="text-[10px] text-neutral-600">
              All photovoltaic modules supplied comply with IS 14286 / IEC 61215 and ALMM list specifications. Inverters conform to CEA Technical Standards for Connectivity (2019 Amendments) and IEC 61683.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-200 pt-4 flex justify-between items-center text-xs text-neutral-400 font-mono">
          <span>{formatReportFooter(report.reportId, report.generatedAt, 7)}</span>
        </div>
      </div>

      {/* ── PAGE 8: ITEMIZED QUOTATION & IMPLEMENTATION ROADMAP ── */}
      <div className="max-w-[794px] min-h-[1123px] mx-auto bg-white text-neutral-900 flex flex-col justify-between p-12 shadow-2xl relative overflow-hidden print:shadow-none print:m-0 print:break-after-page">
        {/* Top Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-[#FF6600]" />

        <div>
          {/* Header */}
          <div className="flex justify-between items-center border-b border-neutral-200 pb-3 mb-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">Itemized Quotation & Implementation Roadmap</h2>
              <p className="text-xs text-neutral-500 font-mono">EPC Commercial Estimate, Milestone Schedule & Warranty Provisions</p>
            </div>
            <span className="text-xs font-mono text-neutral-400">PAGE 8</span>
          </div>

          {/* Conditional Placeholder Banner */}
          {quotation.installerInfo.isPlaceholder && (
            <div className="bg-amber-50 border border-amber-300 rounded p-2 mb-3 text-center">
              <span className="text-xs font-bold text-amber-800 tracking-wider uppercase">
                SAMPLE QUOTATION — Replace with your installer's quote before signing
              </span>
            </div>
          )}

          {/* Section 1: Itemized Quote Table */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3.5 mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 mb-2">
              Bill of Materials & Concessional Composite Pricing
            </h3>
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-100 text-[10px] uppercase font-bold text-neutral-500">
                <tr>
                  <th className="py-1 px-2">Category</th>
                  <th className="py-1 px-2">Description</th>
                  <th className="py-1 px-2">Qty</th>
                  <th className="py-1 px-2 text-right">Rate (₹)</th>
                  <th className="py-1 px-2 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {(quotation.lineItems || []).map((item, idx) => (
                  <tr key={idx} className="hover:bg-white">
                    <td className="py-1 px-2 font-bold text-neutral-900">{item.category}</td>
                    <td className="py-1 px-2 text-neutral-700">{item.item}</td>
                    <td className="py-1 px-2 text-neutral-500">{item.qty}</td>
                    <td className="py-1 px-2 text-right font-mono text-neutral-600">{inrFmt(item.rateInr)}</td>
                    <td className="py-1 px-2 text-right font-mono font-bold text-neutral-900">{inrFmt(item.amountInr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="mt-2.5 pt-2 border-t border-neutral-200 space-y-1 text-xs">
              <div className="flex justify-between items-center text-neutral-600">
                <span>Gross Turn-Key Capex (All-inclusive)</span>
                <span className="font-mono font-bold text-neutral-900">₹{inrFmt(quotation.grossTotalInr)}</span>
              </div>
              <div className="flex justify-between items-center text-emerald-700">
                <span>Less: PM Surya Ghar Central Financial Assistance</span>
                <span className="font-mono font-bold">-₹{inrFmt(quotation.subsidyDeductionInr)}</span>
              </div>
              <div className="flex justify-between items-center bg-emerald-50 border border-emerald-200 p-2 rounded font-bold text-emerald-900">
                <span>Net Customer Outlay (Payable)</span>
                <span className="font-mono text-base">₹{inrFmt(quotation.netPayableInr)}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Milestones & Warranties */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 mb-1.5">Project Payment Milestones</h3>
              <div className="space-y-1.5 text-xs">
                {(quotation.milestones || []).map((ms, idx) => (
                  <div key={idx} className="border-b border-neutral-200 pb-1 last:border-0">
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-neutral-900 text-[11px]">{ms.stage}</span>
                      <span className="text-[#FF6600] font-mono">{ms.percentage}% · ₹{inrFmt(ms.amountInr)}</span>
                    </div>
                    <p className="text-[10px] text-neutral-500 mt-0.5">{ms.trigger}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 mb-1.5">Equipment Warranties</h3>
              <div className="space-y-1.5 text-xs">
                {(quotation.warranties || []).map((war, idx) => (
                  <div key={idx} className="border-b border-neutral-200 pb-1 last:border-0">
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-neutral-900 text-[11px]">{war.item}</span>
                      <span className="text-emerald-700 text-[10px]">{war.duration}</span>
                    </div>
                    <p className="text-[10px] text-neutral-500 mt-0.5">{war.coverage}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Next Steps Timeline */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 mb-2">
              Implementation Roadmap (Turn-Key Timeline)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(quotation.nextSteps || []).map((step, idx) => (
                <div key={idx} className="bg-white border border-neutral-200 rounded p-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="px-1.5 py-0.5 bg-orange-100 text-[#FF6600] rounded text-[9px] font-mono font-bold">
                      {step.stepNumber}
                    </span>
                    <span className="text-[9px] font-mono text-neutral-400">{step.duration}</span>
                  </div>
                  <h4 className="text-[10px] font-bold text-neutral-900 mb-0.5">{step.title}</h4>
                  <p className="text-[9px] text-neutral-500 leading-tight">{step.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Installer Contact Block */}
          <div className="bg-neutral-100 border border-neutral-200 rounded-lg p-3 flex justify-between items-center text-xs">
            <div>
              <span className="font-bold text-neutral-900 block">{quotation.installerInfo.name}</span>
              {quotation.installerInfo.isPlaceholder && (
                <span className="text-[10px] font-bold text-[#FF6600] block">SolarScan Partner Network (sample)</span>
              )}
              <span className="text-[10px] text-neutral-500">{quotation.installerInfo.certifications}</span>
            </div>
            <div className="text-right font-mono text-[11px] text-neutral-700 space-y-0.5">
              <div>Ph: {quotation.installerInfo.contactPhone}</div>
              <div>Email: {quotation.installerInfo.contactEmail}</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-200 pt-4 flex justify-between items-center text-xs text-neutral-400 font-mono">
          <span>{formatReportFooter(report.reportId, report.generatedAt, 8)}</span>
        </div>
      </div>
    </div>
  );
}

export default HTMLPrintView;
