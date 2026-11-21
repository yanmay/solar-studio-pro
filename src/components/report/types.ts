/**
 * ReportData — the data contract between the computation layer and the renderer.
 *
 * This interface is intentionally renderer-agnostic. If we move from
 * @react-pdf/renderer to Puppeteer on a microservice, the data layer stays unchanged;
 * only the renderer (PDFReport vs HTMLReport) swaps out.
 *
 * Total Report Length: 8 Pages
 * Page 1: Cover Page
 * Page 2: Executive Summary & Financial Prospectus
 * Page 3: Site & Rooftop Feasibility Analysis
 * Page 4: System Architecture & Technical Specifications
 * Page 5: Financial Visualizations & Sensitivity Analysis
 * Page 6: 25-Year Detailed Cashflow Schedule (Balance Sheet)
 * Page 7: Central & State Subsidy Regulatory Compliance
 * Page 8: Itemized EPC Quotation & Implementation Roadmap
 */

export interface ReportSiteData {
  address: string;
  lat: number;
  lng: number;
  rooftopAreaM2: number;
  usableAreaM2: number;
  peakSunHoursDaily: number;
  tiltDeg: number;
  azimuth: number;
  shadingLoss: number; // 0–1
  windZone?: string;
  // Phase 3b additions
  state: string; // single source of truth for jurisdiction/DISCOM
  orientationLabel: string; // e.g. "South-facing, 20° tilt"
  roofType: string; // e.g. "Reinforced Concrete (RCC) Flat Roof"
  structuralLoadKgM2: number; // e.g. 15 kg/m²
  monthlyShadingProfile: Array<{
    month: string;
    lossPct: number;
  }>;
  satelliteImageUrl?: string;
}

export interface ReportSystemData {
  installedKw: number;
  panelCount: number;
  panelType: "compact" | "premium";
  panelModel: string;
  inverterModel: string;
  warrantyStr: string;
  /**
   * annualKwhYear1 vs baseAnnualKwh:
   * - baseAnnualKwh: Un-degraded nominal STC design production (kWp × PSH × 365 × (1 - losses)).
   * - annualKwhYear1: Actual projected first-year yield taking into account initial stabilization
   *   and first-year degradation (~0.5%).
   */
  annualKwhYear1: number;
  baseAnnualKwh: number;
  co2AnnualKg: number;
  treesEquivalent: number;
  // Phase 3b additions
  panelWattage: number; // 450W or 550W
  inverterKw: number; // Matched inverter capacity in kW
  dcAcRatio: number; // DC to AC loading ratio (e.g. 1.08)
  stringConfig: {
    strings: number;
    panelsPerString: number;
    vOcTotal: number; // Total array Open-Circuit Voltage (V)
    iScTotal: number; // Total array Short-Circuit Current (A)
  };
  mountingType: string;
  bosComponents: string;
  derating: {
    temperaturePct: number;
    soilingPct: number;
    mismatchPct: number;
    inverterPct: number;
    wiringPct: number;
    totalSystemLossPct: number;
  };
}

export interface BalanceSheetRow {
  year: number; // 1..25
  generationKwh: number; // Generation with degradation applied
  grossSavingsInr: number; // Utility bill savings with tariff escalation
  degradationPct: number; // Cumulative degradation percentage (e.g. 0.5% in Y1, 12.5% in Y25)
  cumulativeDegradationPct: number; // Explicit alias for clarity
  omCostInr: number; // Operation & maintenance expenses (1% capex escalated at 4% annually)
  netCashflowInr: number; // Net cashflow for the year (Savings - O&M)
  cumulativeInr: number; // Cumulative net cash position (-netCapex + running net cash flows)
}

export interface CostBreakdown {
  panelsInr: number; // ~52% of gross capex
  inverterInr: number; // ~18% of gross capex
  mountingBosInr: number; // ~14% of gross capex
  laborInstallInr: number; // ~8% of gross capex
  gstInr: number; // ~8% composite concessional GST
  totalInr: number;
}

export interface ReportFinancialData {
  grossCapexInr: number;
  subsidyInr: number;
  netCapexInr: number;
  year1SavingInr: number;
  paybackPeriod: number; // simple payback in years
  breakEvenYear: number;
  npv: number;
  irr: number; // percent
  lcoe: number; // ₹/kWh
  roi25yrPercent: number;
  savings25yrInr: number;
  tariff: number; // ₹/kWh current tariff
  escalationPct: number;
  discountRatePct: number; // Cost of capital / discount rate (e.g. 8.5%)
  cashFlows: number[]; // 26 elements: [-capex, yr1..yr25]
  cumulativeCashFlow: number[]; // 26 elements
  yearlySavings: number[]; // 25 elements
  // Phase 3b additions
  discountedPaybackYears: number;
  costBreakdown: CostBreakdown;
  cashFlowRows: BalanceSheetRow[]; // Full 25-year schedule for Page 6
}

export interface ComplianceCheckItem {
  item: string;
  authority: string;
  status: "Eligible" | "Required" | "Exempt" | "Pending";
  reference: string;
}

export interface ReportSubsidyData {
  eligible: boolean;
  amount: number;
  cap10kWpApplied: boolean; // Retained for backward-compat; true if system >10kWp
  ineligibleAbove10kW: boolean; // Semantic alias: PM Surya Ghar residential ceiling is 10 kWp
  systemSizeKw: number;
  // Phase 3b additions
  tier1Amount: number; // Up to 2 kW @ ₹30,000/kW (max ₹60,000)
  tier2Amount: number; // 3rd kW @ ₹18,000/kW (max ₹18,000)
  stateSubsidyInr: number; // State-specific booster (if applicable)
  discomName: string; // Operating electricity distribution company
  interconnectionVoltage: string; // "230V Single Phase" or "415V Three Phase"
  complianceList: ComplianceCheckItem[];
}

export interface QuoteLineItem {
  category: string;
  item: string;
  qty: string;
  rateInr: number;
  amountInr: number;
}

export interface PaymentMilestone {
  stage: string;
  percentage: number;
  amountInr: number;
  trigger: string;
}

export interface ReportQuotationData {
  lineItems: QuoteLineItem[];
  grossTotalInr: number;
  subsidyDeductionInr: number;
  netPayableInr: number;
  milestones: PaymentMilestone[];
  warranties: Array<{
    item: string;
    duration: string;
    coverage: string;
  }>;
  nextSteps: Array<{
    stepNumber: string;
    title: string;
    duration: string;
    description: string;
  }>;
  installerInfo: {
    name: string;
    certifications: string;
    contactPhone: string;
    contactEmail: string;
    isPlaceholder: boolean;
  };
}

export interface ReportData {
  generatedAt: string;
  reportId: string;
  site: ReportSiteData;
  system: ReportSystemData;
  financial: ReportFinancialData;
  subsidy: ReportSubsidyData;
  quotation: ReportQuotationData;
}

/** State to DISCOM mapping helper */
function inferStateAndDiscom(address: string): { state: string; discom: string } {
  const addr = address.toLowerCase();
  if (addr.includes("maharashtra") || addr.includes("mumbai") || addr.includes("pune") || addr.includes("nagpur") || addr.includes("thane")) {
    return { state: "Maharashtra", discom: "MSEDCL / Tata Power / Adani Electricity" };
  }
  if (addr.includes("delhi") || addr.includes("ncr") || addr.includes("new delhi")) {
    return { state: "Delhi", discom: "BSES Rajdhani / BSES Yamuna / TPDDL" };
  }
  if (addr.includes("gujarat") || addr.includes("ahmedabad") || addr.includes("surat") || addr.includes("vadodara")) {
    return { state: "Gujarat", discom: "DGVCL / MGVCL / PGVCL / Torrent Power" };
  }
  if (addr.includes("karnataka") || addr.includes("bengaluru") || addr.includes("bangalore") || addr.includes("mysore")) {
    return { state: "Karnataka", discom: "BESCOM / HESCOM / MESCOM" };
  }
  if (addr.includes("tamil nadu") || addr.includes("chennai") || addr.includes("coimbatore")) {
    return { state: "Tamil Nadu", discom: "TANGEDCO" };
  }
  if (addr.includes("rajasthan") || addr.includes("jaipur") || addr.includes("jodhpur")) {
    return { state: "Rajasthan", discom: "JVVNL / AVVNL / JdVVNL" };
  }
  if (addr.includes("telangana") || addr.includes("hyderabad")) {
    return { state: "Telangana", discom: "TSSPDCL / TSNPDCL" };
  }
  if (addr.includes("uttar pradesh") || addr.includes("lucknow") || addr.includes("noida")) {
    return { state: "Uttar Pradesh", discom: "UPPCL / PVVNL / DVVNL" };
  }
  return { state: "National (India)", discom: "Regional State DISCOM" };
}

/** Helper: Calculate discounted payback period in years from net capex and annual cash flows */
function calcDiscountedPayback(netCapex: number, annualRows: Array<{ netCashflowInr: number }>, discountRatePct: number): number {
  if (netCapex <= 0) return 0;
  const r = (discountRatePct > 0 ? discountRatePct : 8.5) / 100;
  let cumDiscounted = 0;
  for (let t = 1; t <= annualRows.length; t++) {
    const netCf = annualRows[t - 1]?.netCashflowInr ?? 0;
    const discountedCf = netCf / Math.pow(1 + r, t);
    const prevCum = cumDiscounted;
    cumDiscounted += discountedCf;
    if (cumDiscounted >= netCapex) {
      const needed = netCapex - prevCum;
      return Number((t - 1 + (discountedCf > 0 ? needed / discountedCf : 0)).toFixed(1));
    }
  }
  return 25.0;
}

/** Build ReportData from the data + model objects available in ResultsPage */
export function buildReportData(
  data: {
    location?: { label?: string; lat?: number; lng?: number };
    rooftop: { drawnAreaM2: number; usableAreaM2: number };
    energy: { peakSunHoursDaily: number; annualKwh: number };
    investment: {
      systemCostInr: number;
      subsidyInr: number;
      netCostInr: number;
      paybackYears: number;
      npv?: number;
      irr: number;
      lcoe?: number;
    };
    financials: { savings25yrInr: number; electricityRateInr: number };
    environmental: { co2AnnualKg: number; treesEquivalent: number };
    roof?: { tilt?: number; azimuth?: number; type?: string };
    tempDerate?: { percent?: number };
    satelliteImageUrl?: string;
  },
  model: {
    installedKw: number;
    panelCount?: number;
    pType?: "compact" | "premium";
    baseAnnualKwh: number;
    subsidyInr: number;
    grossCost: number;
    netCostInr: number;
    paybackPeriod: number;
    breakEvenYr: number;
    npv: number;
    irr: number;
    lcoe: number;
    yearlySavings: number[];
    cashFlows: number[];
    cumulativeCashFlow: number[];
  },
  pCount: number,
  pType: "compact" | "premium",
  tariff: number,
  escalation: number,
  discountRate: number,
  brandConfig?: { installerName?: string; phone?: string; email?: string },
): ReportData {
  const panelModel = pType === "premium"
    ? "Longi Hi-MO 6 LR5-72HTH-550M"
    : "Waaree WS-450 HalfCell";

  const panelWattage = pType === "premium" ? 550 : 450;

  const inverterKw = Math.max(1, Math.round(
    model.installedKw <= 3 ? 3 :
    model.installedKw <= 5 ? 5 :
    model.installedKw <= 8 ? 8 :
    model.installedKw <= 10 ? 10 :
    Math.ceil(model.installedKw)
  ));

  const inverterModel = model.installedKw <= 5
    ? `Solis S6-GR1P${inverterKw}K (Single Phase LT)`
    : `Solis S6-GR3P${inverterKw}K (Three Phase LT)`;

  const address = data.location?.label ?? "India";
  const { state: siteState, discom } = inferStateAndDiscom(address);

  // Roof geometry derivation
  const tiltDeg = data.roof?.tilt ?? 20;
  const azimuth = data.roof?.azimuth ?? 180;
  const cardinal = azimuth >= 135 && azimuth <= 225 ? "South"
    : azimuth > 45 && azimuth < 135 ? "East"
    : azimuth > 225 && azimuth < 315 ? "West"
    : "North";
  const orientationLabel = `${cardinal}-facing, ${tiltDeg}° tilt`;

  // Shading profile (monthly seasonal distribution scaled to overall loss)
  const baseShadingLoss = 0.04;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlyMultipliers = [1.1, 0.9, 0.8, 0.7, 0.7, 1.2, 1.4, 1.3, 1.0, 0.8, 0.9, 1.2];
  const monthlyShadingProfile = monthNames.map((m, idx) => ({
    month: m,
    lossPct: Number((baseShadingLoss * monthlyMultipliers[idx] * 100).toFixed(1)),
  }));

  // Electrical stringing calculations
  const strings = model.installedKw > 6 ? 2 : 1;
  const panelsPerString = Math.ceil(pCount / strings);
  const vocPerPanel = pType === "premium" ? 49.8 : 41.5;
  const iscPerPanel = pType === "premium" ? 13.9 : 11.2;
  const vOcTotal = Math.round(panelsPerString * vocPerPanel);
  const iScTotal = Number((iscPerPanel * strings).toFixed(1));
  const dcAcRatio = Number((model.installedKw / inverterKw).toFixed(2));

  // Derating factors
  const tempDeratePct = Number((data.tempDerate?.percent ?? 4.2).toFixed(1));
  const derating = {
    temperaturePct: tempDeratePct,
    soilingPct: 3.0,
    mismatchPct: 2.0,
    inverterPct: 3.0,
    wiringPct: 1.8,
    totalSystemLossPct: Number((tempDeratePct + 3.0 + 2.0 + 3.0 + 1.8).toFixed(1)),
  };

  // Capital expenditure breakdown: 13.8% composite GST (70% goods @ 12% + 30% services @ 18%)
  // All-inclusive retail pricing: preGstBase = grossCost / 1.138
  const preGstBase = Math.round(model.grossCost / 1.138);
  const panelsInr = Math.round(preGstBase * 0.58);
  const inverterInr = Math.round(preGstBase * 0.20);
  const mountingBosInr = Math.round(preGstBase * 0.13);
  const laborInstallInr = preGstBase - (panelsInr + inverterInr + mountingBosInr);
  const gstInr = model.grossCost - preGstBase; // Exactly 13.8% composite on preGstBase, absorbs gross rounding
  const costBreakdown: CostBreakdown = {
    panelsInr,
    inverterInr,
    mountingBosInr,
    laborInstallInr,
    gstInr,
    totalInr: model.grossCost,
  };

  const annualKwhYear1 = Math.round(model.baseAnnualKwh * 0.995);

  // PM Surya Ghar breakdown: residential ceiling is 10 kWp
  const ineligibleAbove10kW = model.installedKw > 10;
  const tier1Amount = ineligibleAbove10kW ? 0 : Math.round(Math.min(model.installedKw, 2) * 30000);
  const tier2Amount = ineligibleAbove10kW ? 0 : Math.round(Math.min(Math.max(model.installedKw - 2, 0), 1) * 18000);
  const totalSubsidy = ineligibleAbove10kW ? 0 : Math.min(tier1Amount + tier2Amount, 78000);
  const finalSubsidy = ineligibleAbove10kW ? 0 : (model.subsidyInr ?? totalSubsidy);
  const netCapex = model.grossCost - finalSubsidy;

  // 25-Year Balance Sheet Rows (Page 6)
  // cumulativeInr starts at -netCapex and accumulates operational net cash flows, crossing zero at payback.
  // Conservative O&M assumption: ~1% of gross capex with 4% annual inflation escalation.
  const cashFlowRows: BalanceSheetRow[] = [];
  let runningCum = -netCapex;
  for (let y = 1; y <= 25; y++) {
    const degradationPct = Number((y * 0.5).toFixed(1));
    const gen = y === 1 ? annualKwhYear1 : Math.round(model.baseAnnualKwh * (1 - (y * 0.005)));
    const savings = model.yearlySavings[y - 1] ?? Math.round(gen * tariff * Math.pow(1 + escalation / 100, y - 1));
    const nominalOm = Math.round((model.grossCost * 0.01) * Math.pow(1 + 0.04, y - 1));
    const net = model.cashFlows?.[y] !== undefined ? model.cashFlows[y] : (savings - nominalOm);
    // Guarantee 100% internal arithmetic consistency: netCashflowInr === grossSavingsInr - omCostInr
    const om = savings - net;
    runningCum += net;
    cashFlowRows.push({
      year: y,
      generationKwh: gen,
      grossSavingsInr: savings,
      degradationPct,
      cumulativeDegradationPct: degradationPct,
      omCostInr: om,
      netCashflowInr: net,
      cumulativeInr: runningCum,
    });
  }

  const discountedPaybackYears = calcDiscountedPayback(netCapex, cashFlowRows, discountRate);

  const complianceList: ComplianceCheckItem[] = [
    {
      item: "PM Surya Ghar National Portal Registration",
      authority: "Ministry of New and Renewable Energy (MNRE)",
      status: finalSubsidy > 0 ? "Eligible" : ineligibleAbove10kW ? "Exempt" : "Pending",
      reference: "MNRE/PMSG/2024-V2",
    },
    {
      item: "DISCOM Technical Feasibility Approval (TFA)",
      authority: discom,
      status: "Required",
      reference: "State Grid Code Sec 8.4",
    },
    {
      item: "Structural Stability Certification",
      authority: "Chartered Structural Engineer / Municipal Body",
      status: model.installedKw > 10 ? "Required" : "Exempt",
      reference: "NBC 2016 Part 6",
    },
    {
      item: "Bi-directional Net-Meter Inspection & Synchronization",
      authority: "Chief Electrical Inspectorate (CEI) / DISCOM",
      status: "Required",
      reference: "CEA Grid Standards 2013",
    },
  ];

  // Quotation Line Items & Milestones (Page 8)
  const lineItems: QuoteLineItem[] = [
    {
      category: "PV Modules",
      item: `${pCount} × ${panelWattage}Wp ${panelModel}`,
      qty: `${pCount} Nos (${model.installedKw.toFixed(2)} kWp)`,
      rateInr: Math.round(costBreakdown.panelsInr / pCount),
      amountInr: costBreakdown.panelsInr,
    },
    {
      category: "Inverter",
      item: inverterModel,
      qty: "1 Set",
      rateInr: costBreakdown.inverterInr,
      amountInr: costBreakdown.inverterInr,
    },
    {
      category: "Mounting Structure",
      item: "Anodized Aluminum Elevated Rails (6063-T6, 15° Tilt, SS304 Fasteners)",
      qty: `${pCount} Modules`,
      rateInr: Math.round((costBreakdown.mountingBosInr * 0.45) / pCount),
      amountInr: Math.round(costBreakdown.mountingBosInr * 0.45),
    },
    {
      category: "Electrical BOS",
      item: "Polycab 4mm² Solar DC Cable, 32A DCDB with Type-II SPD, ACDB & Earthing",
      qty: "1 Lot",
      rateInr: Math.round(costBreakdown.mountingBosInr * 0.55),
      amountInr: Math.round(costBreakdown.mountingBosInr * 0.55),
    },
    {
      category: "EPC Services",
      item: "Site Assembly, DC/AC Wiring, Testing, DISCOM Net-Meter Liaison & Handover",
      qty: "1 Job",
      rateInr: costBreakdown.laborInstallInr,
      amountInr: costBreakdown.laborInstallInr,
    },
    {
      category: "Taxes",
      item: "GST (Composite Solar Rate @ 13.8% on 70:30 Goods:Services ratio)",
      qty: "13.8%",
      rateInr: costBreakdown.gstInr,
      amountInr: costBreakdown.gstInr,
    },
  ];

  const milestones: PaymentMilestone[] = [
    {
      stage: "Milestone 1 — Advance on Design Freeze",
      percentage: 30,
      amountInr: Math.round(model.netCostInr * 0.30),
      trigger: "Site design approval & DISCOM portal application submission",
    },
    {
      stage: "Milestone 2 — Equipment Delivery to Site",
      percentage: 60,
      amountInr: Math.round(model.netCostInr * 0.60),
      trigger: "Physical delivery & verification of PV modules, inverter & structures",
    },
    {
      stage: "Milestone 3 — Grid Synchronization & Commissioning",
      percentage: 10,
      amountInr: Math.round(model.netCostInr * 0.10),
      trigger: "Bi-directional net-meter installation, testing & official handover",
    },
  ];

  const nextSteps = [
    {
      stepNumber: "01",
      title: "Detailed Site Survey & Structural Audit",
      duration: "Days 1–3",
      description: "Physical inspection of roof rafters, electrical panel capacity, cable routing, and shadow casting.",
    },
    {
      stepNumber: "02",
      title: "DISCOM Interconnection Application & Sanction",
      duration: "Days 4–10",
      description: "Submission of technical drawings and load sanction request on the National PM Surya Ghar portal.",
    },
    {
      stepNumber: "03",
      title: "Equipment Delivery, Mounting & String Wiring",
      duration: "Days 11–18",
      description: "Installation of elevated mounting rails, panel array alignment, inverter mounting, and earthing pits.",
    },
    {
      stepNumber: "04",
      title: "Net-Meter Inspection & Official Commissioning",
      duration: "Days 19–25",
      description: "Joint inspection by DISCOM engineer, installation of bi-directional meter, and subsidy credit release.",
    },
  ];

  const warranties = [
    {
      item: "Solar PV Modules",
      duration: "25 Years Performance",
      coverage: "Linear degradation guarantee: ≥91.2% at Year 10, ≥84.8% at Year 25 (12-yr product warranty)",
    },
    {
      item: "Solar Inverter",
      duration: "5 Years Manufacturer",
      coverage: "Comprehensive replacement warranty including WiFi/GPRS monitoring card (extendable to 10-yr)",
    },
    {
      item: "Mounting Structures",
      duration: "10 Years Structural",
      coverage: "Guaranteed against wind forces up to 150 km/h and galvanic corrosion of aluminum/SS fasteners",
    },
    {
      item: "Workmanship & BOS",
      duration: "5 Years EPC Guarantee",
      coverage: "Covers cable connections, DCDB/ACDB switchgear, earthing grid, and rooftop water tightness",
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    reportId: data.location?.label?.replace(/\s+/g, "-").toLowerCase().substring(0, 20) ?? "scan",
    site: {
      address,
      lat: data.location?.lat ?? 0,
      lng: data.location?.lng ?? 0,
      rooftopAreaM2: data.rooftop.drawnAreaM2,
      usableAreaM2: data.rooftop.usableAreaM2,
      peakSunHoursDaily: data.energy.peakSunHoursDaily,
      tiltDeg,
      azimuth,
      shadingLoss: baseShadingLoss,
      windZone: data.roof?.type ?? "Zone III (Medium)",
      state: siteState,
      orientationLabel,
      roofType: data.roof?.type ?? "Reinforced Concrete (RCC) Flat Roof",
      structuralLoadKgM2: 15.0,
      monthlyShadingProfile,
      satelliteImageUrl: data.satelliteImageUrl,
    },
    system: {
      installedKw: model.installedKw,
      panelCount: pCount,
      panelType: pType,
      panelModel,
      inverterModel,
      warrantyStr: `${pType === "premium" ? "30" : "25"}-yr product, 25-yr performance`,
      annualKwhYear1: Math.round(model.yearlySavings.length > 0 ? model.baseAnnualKwh * 0.995 : model.baseAnnualKwh),
      baseAnnualKwh: model.baseAnnualKwh,
      co2AnnualKg: data.environmental.co2AnnualKg,
      treesEquivalent: data.environmental.treesEquivalent,
      panelWattage,
      inverterKw,
      dcAcRatio,
      stringConfig: {
        strings,
        panelsPerString,
        vOcTotal,
        iScTotal,
      },
      mountingType: "Elevated Anodized Aluminum Rails (6063-T6) / GI Ballasted, 15° Tilt",
      bosComponents: "Polycab 4mm² UV Solar DC Cable, MC4 Connectors, 32A DCDB (Type II SPD), ACDB with Schneider MCB",
      derating,
    },
    financial: {
      grossCapexInr: model.grossCost,
      subsidyInr: finalSubsidy,
      netCapexInr: model.grossCost - finalSubsidy,
      year1SavingInr: model.yearlySavings[0] ?? 0,
      paybackPeriod: model.paybackPeriod,
      breakEvenYear: cashFlowRows.find(r => r.cumulativeInr >= 0)?.year ?? model.breakEvenYr,
      npv: model.npv,
      irr: model.irr,
      lcoe: model.lcoe,
      roi25yrPercent: model.npv > 0 ? (model.npv / (model.grossCost - finalSubsidy)) * 100 : 0,
      savings25yrInr: data.financials.savings25yrInr,
      tariff,
      escalationPct: escalation,
      discountRatePct: discountRate,
      cashFlows: model.cashFlows,
      cumulativeCashFlow: model.cumulativeCashFlow,
      yearlySavings: model.yearlySavings,
      discountedPaybackYears,
      costBreakdown,
      cashFlowRows,
    },
    subsidy: {
      eligible: finalSubsidy > 0,
      amount: finalSubsidy,
      cap10kWpApplied: ineligibleAbove10kW,
      ineligibleAbove10kW,
      systemSizeKw: model.installedKw,
      tier1Amount,
      tier2Amount,
      stateSubsidyInr: 0,
      discomName: discom,
      interconnectionVoltage: model.installedKw <= 5 ? "230V Single Phase 50Hz LT Interconnection" : "415V Three Phase 50Hz LT Interconnection",
      complianceList,
    },
    quotation: {
      lineItems,
      grossTotalInr: model.grossCost,
      subsidyDeductionInr: finalSubsidy,
      netPayableInr: netCapex,
      milestones,
      warranties,
      nextSteps,
      installerInfo: {
        name: brandConfig?.installerName ?? "SolarScan Certified EPC Network",
        certifications: "MNRE Channel Partner · ISO 9001:2015 · BIS Certified Equipment",
        contactPhone: brandConfig?.phone ?? "+91 1800-202-7652",
        contactEmail: brandConfig?.email ?? "support@solarscan.ai",
        isPlaceholder: !brandConfig?.installerName,
      },
    },
  };
}
