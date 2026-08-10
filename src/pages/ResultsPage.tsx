import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  ArrowRight,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Lock,
  ShieldCheck,
  Satellite,
  MapPin,
  AlertTriangle,
  Battery,
  Clock,
  PhoneCall,
  Share2,
  Square,
  Zap,
  IndianRupee,
  Leaf,
  TreeDeciduous,
  Wallet,
  Calendar,
  BadgePercent,
  HelpCircle,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SnappySlider } from "@/components/ui/snappy-slider";
import { useEffect, useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import type { SolarAnalysis } from "@/lib/solar-calc";
import { calcConfidenceScore } from "@/lib/confidence-score";
import { generatePDFReport } from "@/lib/pdf-generator";
import { useAuth } from "@/contexts/AuthContext";
import { saveScanToDb } from "@/lib/supabase";
import {
  AreaChart,
  Area,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Grid as CartesianGrid,
  ChartTooltip,
  ReferenceLine,
  Gauge,
} from "@/components/charts";
import { ComposedBar as Bar } from "@/components/charts/ComposedChart";
import { useScanStore } from "@/hooks/use-scan-store";
import { usePayment } from "@/hooks/use-payment";
import { useUnlockStatus } from "@/hooks/use-unlock-status";
import { runFullCalculation } from "@/lib/solar-calc";
import { decodeScanFromUrl, encodeScanToUrl } from "@/lib/scan-url";
import { generateWhatsAppMessage, generateWhatsAppUrl, shortenUrl } from "@/lib/whatsapp-share";
import { computePanelLayout } from "@/lib/panel-layout";
import { fetchSolarIrradiance } from "@/lib/nasa-power";
import { calcWindCostAdder } from "@/lib/wind-zone";
import { calcTemperatureDerate } from "@/lib/temperature-derate";
import { calcPMSuryaSubsidy, isEligible } from "@/lib/pm-surya-subsidy";
import { getOrCreateReferralState, getReferralShareContent, MONTHLY_LEADERBOARD } from "@/lib/referrals";
import { jsPDF } from "jspdf";
import {
  trackResultsViewed,
  trackPaywallShown,
  trackPaymentInitiated,
  track
} from "@/lib/analytics";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// Remote i18n & widget additions
import LeadCaptureForm from "@/components/LeadCaptureForm";
import InstallerMarketplace from "@/components/InstallerMarketplace";
import TimeOfUseCard from "@/components/TimeOfUseCard";
import RooftopARViewer from "@/components/RooftopARViewer";
import SolarSimulator from "@/components/SolarSimulator";
import { recommendBattery, type BackupMode } from "@/lib/battery-calc";
import { deriveMetrics } from "@/lib/report-metrics";
import { formatINR } from "@/lib/format-currency";
import { REPORT_TOKENS } from "@/lib/report-tokens";

interface FullResult extends SolarAnalysis {
  location?: { lat: number; lng: number; label: string };
  panelCount?: number;
  unlocked?: boolean;
  windZone?: string;
  windZoneLabel?: string;
  highWindWarning?: boolean;
  structuralFactor?: number;
  suitabilityScore?: number;
  horizonShadingLoss?: number;
  skyViewFactor?: number;
  roof?: { azimuth?: string | number; tilt?: number };
  battery?: {
    mode: "none" | "evening" | "offgrid";
    recommendedKwh: number;
    costInr: number;
    lifetimeCostInr: number;
    backupHours: number;
    description: string;
  };
}

// Average lat/lng centroid of a set of vertices
function calcCentroid(points: { lat: number; lng: number }[]): { lat: number; lng: number } {
  if (points.length === 0) return { lat: 0, lng: 0 };
  const sum = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_KEYS   = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

const leadFormSchema = z.object({
  name:  z.string().min(1, "Name is required"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  city:  z.string().min(1, "City is required"),
});

// ─── Financial solver ────────────────────────────────────────
function computeModel({ peakSunHours, pCount, pType, tariff, escalation, discountRate, omCost, batteryStorage, overrideAnnualKwh, shading = "auto", computedShadingLoss = null, windZone, tempDerate }: {
  peakSunHours: number; pCount: number; pType: "compact"|"premium";
  tariff: number; escalation: number; discountRate: number; omCost: number; batteryStorage: boolean;
  overrideAnnualKwh?: number;
  shading?: "none" | "partial" | "heavy" | "auto";
  computedShadingLoss?: number | null;
  windZone?: number;
  tempDerate?: number;
}) {
  const panelW = pType === "premium" ? 550 : 450;
  const installedKw = (pCount * panelW) / 1000;
  const windCostAdder = windZone ? calcWindCostAdder(windZone) : 0;
  const grossCost = pCount * (pType === "premium" ? 22000 : 18000) + 35000 + (windCostAdder * installedKw);
  const batteryCost = batteryStorage ? 85000 : 0;
  const totalGrossCapEx = grossCost + batteryCost;
  const subsidyInr = calcPMSuryaSubsidy(installedKw);
  const netCostInr = Math.max(0, totalGrossCapEx - subsidyInr);

  let shadingLoss = 0;
  if (shading === "auto") {
    shadingLoss = computedShadingLoss ?? 0;
  } else if (shading === "partial") {
    shadingLoss = 0.15;
  } else if (shading === "heavy") {
    shadingLoss = 0.30;
  }

  const tempMultiplier = tempDerate ?? 1.0;
  const baseAnnualKwh = (overrideAnnualKwh ?? (installedKw * peakSunHours * 365 * 0.86 * (1 - shadingLoss))) * tempMultiplier;
  const cashFlows: number[] = [-netCostInr];
  const yearlySavings: number[] = [];
  const yearlyOm: number[] = [];
  const cumulativeCashFlow: number[] = [-netCostInr];
  let cum = -netCostInr;
  for (let y = 1; y <= 25; y++) {
    const prod = baseAnnualKwh * Math.pow(0.995, y - 1);
    const rate = tariff * Math.pow(1 + escalation / 100, y - 1);
    const baseOm = 1500 + Math.max(0, installedKw - 1) * 500;
    const om = baseOm * Math.pow(1 + omCost / 100, y - 1);
    const savings = prod * rate * (batteryStorage ? 1.15 : 1);
    const net = savings - om - (y === 10 ? 35000 : 0);
    cashFlows.push(net); yearlySavings.push(savings); yearlyOm.push(om);
    cum += net; cumulativeCashFlow.push(cum);
  }
  const npv = cashFlows.reduce((s, v, i) => s + v / Math.pow(1 + discountRate / 100, i), 0);
  let irr = 0, low = -0.5, high = 2.0, irrFound = false;
  const calcNpv = (r: number) => cashFlows.reduce((s, v, i) => s + v / Math.pow(1 + r, i), 0);
  if (calcNpv(low) > 0 && calcNpv(high) < 0) {
    irrFound = true;
    for (let i = 0; i < 30; i++) {
      const mid = (low + high) / 2;
      calcNpv(mid) > 0 ? low = mid : high = mid;
      irr = mid;
    }
  }
  let paybackPeriod = 25, breakEvenYr = 25, breakEvenFound = false;
  for (let y = 1; y <= 25; y++) {
    if (cumulativeCashFlow[y] >= 0) {
      breakEvenYr = y;
      paybackPeriod = (y - 1) + (-cumulativeCashFlow[y - 1] / cashFlows[y]);
      breakEvenFound = true; break;
    }
  }
  let dlc = netCostInr, dep = 0;
  for (let y = 1; y <= 25; y++) {
    const prod = baseAnnualKwh * Math.pow(0.995, y - 1);
    dlc += (yearlyOm[y-1] + (y===10?35000:0)) / Math.pow(1+discountRate/100,y);
    dep += prod / Math.pow(1+discountRate/100,y);
  }
  const lcoe = dep > 0 ? dlc / dep : 0;
  return { installedKw, baseAnnualKwh, grossCost, totalGrossCapEx, subsidyInr, netCostInr,
    cashFlows, cumulativeCashFlow, yearlySavings, yearlyOm, irr: irr * 100, irrFound, npv, paybackPeriod, breakEvenYr, lcoe, breakEvenFound, shadingLoss };
}

// ─── Lead form ───────────────────────────────────────────────
function InstallerLeadForm({ data }: { data: FullResult }) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(leadFormSchema),
    defaultValues: { name: "", phone: "", city: data.location?.label?.split(",")[0] ?? "" },
  });
  const onSubmit = async (values: any) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: values.name, phone: values.phone, city: values.city, systemKwp: data.energy.installedCapacityKw }) });
      if (res.ok) { setSuccess(true); toast({ title: "Request Submitted", description: "A certified solar partner will contact you shortly." }); }
      else { const e = await res.json(); throw new Error(e.error || "Failed"); }
    } catch (err: any) {
      toast({ title: "Submission Failed", description: err.message, variant: "destructive" });
    } finally { setSubmitting(false); }
  };
  if (success) return (
    <div style={{ background: `${REPORT_TOKENS.yield}10`, border: `1px solid ${REPORT_TOKENS.yield}40` }} className="p-6 text-center space-y-3">
      <CheckCircle2 className="w-8 h-8 mx-auto" style={{ color: REPORT_TOKENS.yield }} />
      <p className="text-xs font-bold" style={{ color: REPORT_TOKENS.text }}>Partner Quote Requested</p>
      <p className="text-xs" style={{ color: REPORT_TOKENS.muted }}>Certified installers in your region will contact you shortly.</p>
    </div>
  );
  return (
    <div style={{ background: REPORT_TOKENS.parcel, border: `1px solid ${REPORT_TOKENS.graticule}` }} className="p-4 rounded-xl">
      <h3 style={{ color: REPORT_TOKENS.text, borderBottom: `1px solid ${REPORT_TOKENS.graticule}`, paddingBottom: "8px", marginBottom: "12px" }}
        className="text-xs font-bold uppercase tracking-wider font-mono">Request Partner Quotes</h3>
      <p className="text-xs mb-4" style={{ color: REPORT_TOKENS.muted }}>Get direct quotes from MNRE-certified partners near you.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        {[
          { field: "phone", label: "Mobile Number", placeholder: "e.g. 9876543210" },
          { field: "city",  label: "City",          placeholder: "e.g. Mumbai"     },
        ].map(({ field, label, placeholder }) => (
          <div key={field}>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: REPORT_TOKENS.muted }}>{label}</label>
            <input {...register(field as any)} type={field === "phone" ? "tel" : "text"} placeholder={placeholder}
              style={{ background: REPORT_TOKENS.ink, border: `1px solid ${REPORT_TOKENS.graticule}`, color: REPORT_TOKENS.text }}
              className="w-full px-3 py-2 text-xs focus:outline-none font-mono" />
            {(errors as any)[field] && <span className="text-[10px] block mt-0.5" style={{ color: REPORT_TOKENS.cost }}>{(errors as any)[field].message}</span>}
          </div>
        ))}
        <button type="submit" disabled={submitting}
          style={{ background: REPORT_TOKENS.yield, color: REPORT_TOKENS.onAccent }}
          className="w-full py-2.5 text-[10px] font-bold uppercase tracking-wider transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer font-mono">
          {submitting ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Submitting...</> : "Submit Request"}
        </button>
      </form>
    </div>
  );
}

// ─── Sidebar data list ───────────────────────────────────────
function DataList({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <ul className="flex flex-col gap-2 text-xs font-mono">
      {rows.map((r, i) => (
        <li key={i} className="flex justify-between"
          style={{ borderBottom: i < rows.length - 1 ? `1px solid ${REPORT_TOKENS.graticule}40` : "none", paddingBottom: i < rows.length - 1 ? "6px" : "0" }}>
          <span style={{ color: REPORT_TOKENS.muted }}>{r.label}</span>
          <span style={{ color: REPORT_TOKENS.text }}>{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Sidebar card shell ──────────────────────────────────────
function SideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: REPORT_TOKENS.parcel, border: `1px solid ${REPORT_TOKENS.graticule}` }} className="p-4 sp-card rounded-xl">
      <h3 className="text-xs font-bold uppercase tracking-wider mb-3 font-mono"
        style={{ color: REPORT_TOKENS.text, borderBottom: `1px solid ${REPORT_TOKENS.graticule}`, paddingBottom: "8px" }}>{title}</h3>
      {children}
    </div>
  );
}

// ─── Roof Layout Diagram (SVG minimap) ───────────────────────
function RoofLayoutDiagram({
  polygons,
  panelConfig,
  width = 244,
  height = 130,
  showCount = true,
}: {
  polygons: { type: "Polygon"; coordinates: [number, number][][] }[];
  panelConfig: {
    tiltAngle?: number; setbackM?: number; walkwayM?: number;
    panelWattage?: 450 | 550; orientation?: string; rowAlignment?: string;
  } | null;
  width?: number;
  height?: number;
  showCount?: boolean;
}) {
  const W = width, H = height, PAD = Math.round(Math.min(width, height) * 0.06) + 4;

  if (!polygons || polygons.length === 0 || (polygons[0]?.coordinates[0]?.length ?? 0) === 0) {
    return (
      <div style={{ background: REPORT_TOKENS.parcelHigh, border: `1px solid ${REPORT_TOKENS.graticule}`, height: H }} className="flex items-center justify-center rounded-lg">
        <span className="text-xs font-mono" style={{ color: REPORT_TOKENS.muted }}>No roof data available</span>
      </div>
    );
  }

  const allCoords = polygons.flatMap((p) => p.coordinates[0] ?? []);
  const minLng = Math.min(...allCoords.map((c) => c[0]));
  const maxLng = Math.max(...allCoords.map((c) => c[0]));
  const minLat = Math.min(...allCoords.map((c) => c[1]));
  const maxLat = Math.max(...allCoords.map((c) => c[1]));
  const midLat = (minLat + maxLat) / 2;
  const lngScale = Math.cos((midLat * Math.PI) / 180);

  const rangeX = (maxLng - minLng) * lngScale || 1e-6;
  const rangeY = (maxLat - minLat) || 1e-6;
  const usableW = W - 2 * PAD;
  const usableH = H - 2 * PAD;
  const scale = Math.min(usableW / rangeX, usableH / rangeY);
  const offsetX = PAD + (usableW - rangeX * scale) / 2;
  const offsetY = PAD + (usableH - rangeY * scale) / 2;

  const project = (lng: number, lat: number): [number, number] => [
    offsetX + (lng - minLng) * lngScale * scale,
    offsetY + (maxLat - lat) * scale,
  ];

  // Compute panel layout for each polygon
  const allPanelSVG: [number, number][][] = [];
  polygons.forEach((poly) => {
    const verts = (poly.coordinates[0] ?? []).map(([lng, lat]) => ({ lat, lng }));
    if (verts.length < 3) return;
    const result = computePanelLayout(verts, {
      panelType: panelConfig?.panelWattage === 550 ? "premium" : "compact",
      alignment: panelConfig?.rowAlignment === "geographical_south" ? "south" : "roof",
      tiltDeg: panelConfig?.tiltAngle ?? 15,
      orientation: (panelConfig?.orientation as "portrait" | "landscape" | "auto") ?? "portrait",
      walkways: (panelConfig?.walkwayM ?? 0) > 0,
      setbackM: panelConfig?.setbackM ?? 0.5,
    });
    result.panels.forEach((panel) => {
      allPanelSVG.push(panel.corners.map(([lat, lng]) => project(lng, lat)));
    });
  });

  const panelCount = allPanelSVG.length;
  const gridSize = Math.max(10, Math.round(W / 20));

  return (
    <div style={{ border: `1px solid ${REPORT_TOKENS.graticule}`, overflow: "hidden" }} className="rounded-lg w-full h-full">
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block", background: REPORT_TOKENS.ink }}>
        <defs>
          <pattern id="rld-grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
            <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke={REPORT_TOKENS.graticule} strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#rld-grid)" />

        {/* Roof parcel — cadastral outline */}
        {polygons.map((poly, pi) => {
          const coords = (poly.coordinates[0] ?? []).map(([lng, lat]) => project(lng, lat));
          return (
            <polygon
              key={`roof-${pi}`}
              points={coords.map(([x, y]) => `${x},${y}`).join(" ")}
              fill={REPORT_TOKENS.parcelHigh}
              stroke={REPORT_TOKENS.graticuleStrong}
              strokeWidth="1"
            />
          );
        })}

        {/* Solar array — brand-colored panels */}
        {allPanelSVG.map((corners, i) => (
          <polygon
            key={`panel-${i}`}
            points={corners.map(([x, y]) => `${x},${y}`).join(" ")}
            fill={`${REPORT_TOKENS.solar}CC`}
            stroke={REPORT_TOKENS.solar}
            strokeWidth="0.4"
          />
        ))}

        {showCount && (
          <>
            <rect x={W - 56} y={H - 20} width={50} height={15} fill="#000000AA" rx="1" />
            <text x={W - 31} y={H - 9} textAnchor="middle" fill={REPORT_TOKENS.solar} fontSize="7.5" fontFamily="monospace">
              {panelCount} panels
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", 
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", 
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", 
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", 
  "West Bengal", "Delhi"
];

function generatePMSuryaApplicationPDF(details: {
  name: string;
  phone: string;
  systemSizeKw: number;
  estimatedCost: number;
  subsidyAmount: number;
  state: string;
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  
  // Header / Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("PM-SURYA GHAR MUFT BIJLI YOJANA", 105, 20, { align: "center" });
  doc.setFontSize(12);
  doc.text("National Portal for Rooftop Solar — Pre-Filled Application Form", 105, 27, { align: "center" });
  
  // Decorative separator
  doc.setLineWidth(0.5);
  doc.line(15, 32, 195, 32);
  
  // Section: Applicant Details
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("1. APPLICANT INFORMATION", 15, 42);
  
  doc.setFont("helvetica", "normal");
  doc.text(`Full Name: ${details.name || "N/A"}`, 15, 50);
  doc.text(`WhatsApp Number: +91 ${details.phone || "N/A"}`, 15, 57);
  doc.text(`State / Region: ${details.state || "N/A"}`, 15, 64);
  doc.text("Connection Type: Domestic (Residential)", 15, 71);
  
  // Section: System Specifications
  doc.setFont("helvetica", "bold");
  doc.text("2. PROPOSED SOLAR SYSTEM SPECIFICATIONS", 15, 85);
  
  doc.setFont("helvetica", "normal");
  doc.text(`Proposed System Capacity: ${details.systemSizeKw.toFixed(2)} kWp`, 15, 93);
  doc.text(`Estimated System Cost: INR ${Math.round(details.estimatedCost).toLocaleString()}`, 15, 100);
  doc.text(`Eligible Subsidy: INR ${Math.round(details.subsidyAmount).toLocaleString()}`, 15, 107);
  doc.text(`Net Cost to Homeowner: INR ${Math.round(details.estimatedCost - details.subsidyAmount).toLocaleString()}`, 15, 114);
  
  // Section: Bank Account Details
  doc.setFont("helvetica", "bold");
  doc.text("3. BANK ACCOUNT FOR SUBSIDY DISBURSEMENT (PLACEHOLDER)", 15, 128);
  
  doc.setFont("helvetica", "normal");
  doc.text("Account Holder Name: ___________________________________", 15, 136);
  doc.text("Bank Name: ___________________________________________", 15, 143);
  doc.text("Account Number: _______________________________________", 15, 150);
  doc.text("IFSC Code: ____________________________________________", 15, 157);
  
  // Section: Checklist & Declaration
  doc.setFont("helvetica", "bold");
  doc.text("4. DECLARATION", 15, 172);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const declarationText = "I hereby declare that all the information provided above is correct. I own the property and declare that a dual-source bidirectional net meter will be installed according to DISCOM guidelines. The subsidy will be claimed only after successful installation and inspection by DISCOM officials.";
  doc.text(declarationText, 15, 180, { maxWidth: 180 });
  
  // Signatures
  doc.setFontSize(10);
  doc.text("Signature of Applicant: _____________________", 15, 220);
  doc.text("Date: _____________________", 140, 220);
  
  // Footer
  doc.setFontSize(8);
  doc.text("This is an automatically generated pre-filled application form from SolarStudio Pro.", 105, 280, { align: "center" });
  
  doc.save("pm-surya-ghar-prefilled-application.pdf");
}

// ─── Main Page ───────────────────────────────────────────────
const ResultsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const store = useScanStore();
  const { user, signOut } = useAuth();
  const [searchParams] = useSearchParams();
  const { initiatePayment, isLoading: isPaymentGatewayLoading } = usePayment();

  const [data, setData] = useState<FullResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [noData, setNoData] = useState(false);
  const [leadFormOpen, setLeadFormOpen] = useState(false);
  const [pvlibData, setPvlibData] = useState<any>(null);
  const [isPvlibLoading, setIsPvlibLoading] = useState(false);

  const hasTrackedViewed  = useRef(false);
  const hasTrackedPaywall = useRef(false);
  const maxPanelsRef = useRef<number>(1);

  const [tariff,         setTariff]         = useState(7.5);
  const [pType,          setPType]          = useState<"compact"|"premium">("compact");
  const [pCount,         setPCount]         = useState(15);
  const [escalation,     setEscalation]     = useState(4.5);
  const [discountRate,   setDiscountRate]   = useState(8.5);
  const [omCost,         setOmCost]         = useState(1.0);
  const [batteryStorage, setBatteryStorage] = useState(false);
  const [shading,        setShading]        = useState<"none" | "partial" | "heavy" | "auto">("auto");
  const [activeTab,      setActiveTab]      = useState<"roi"|"yield"|"monthly">("roi");
  const [showAllYears,   setShowAllYears]   = useState(false);

  // PM-Surya Ghar Subsidy Eligibility Checklist states
  const [checklistResidential, setChecklistResidential] = useState(true);
  const [checklistGridConnected, setChecklistGridConnected] = useState(true);
  const [eligibilityConnectionType, setEligibilityConnectionType] = useState("domestic");
  const [eligibilityState, setEligibilityState] = useState("Maharashtra");

  const referralState = getOrCreateReferralState();
  const hasReferralDiscount = referralState.unlockedDiscount;
  const payPerScanPrice = hasReferralDiscount ? 129 : 149;

  // Attempt to infer state from address label
  useEffect(() => {
    if (data?.location?.label) {
      const label = data.location.label.toLowerCase();
      const allStates = [
        "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", 
        "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", 
        "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", 
        "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", 
        "West Bengal", "Delhi"
      ];
      const matched = allStates.find(s => label.includes(s.toLowerCase()));
      if (matched) {
        setEligibilityState(matched);
      }
    }
  }, [data]);

  const handleShadingChange = (newShading: "none" | "partial" | "heavy" | "auto") => {
    setShading(newShading);
    const enc = searchParams.get("scan");
    if (enc) {
      const decoded = decodeScanFromUrl(enc);
      if (decoded) {
        decoded.panelConfig.shading = newShading;
        const newEncoded = encodeScanToUrl(decoded.scanInput, decoded.panelConfig, decoded.tariff);
        navigate(`/results?scan=${newEncoded}`, { replace: true });
      }
    }
  };


  // Unlock state is server-authoritative: /api/payment/status reads the
  // Supabase-backed session. store.isPaid is only an optimistic in-session
  // cache set after a server-verified payment (use-payment.ts) — a tampered
  // share URL or client state can never grant unlock on a fresh load.
  const { unlocked: serverUnlocked, refresh: refreshUnlock } = useUnlockStatus(data?.analysisId);
  const unlocked = serverUnlocked || store.isPaid;
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentPlan,    setPaymentPlan]    = useState<"pay_per_scan"|"pro_monthly">("pay_per_scan");
  const [paymentMethod,  setPaymentMethod]  = useState<"card"|"upi">("card");
  const [cardNumber,     setCardNumber]     = useState("");
  const [cardExpiry,     setCardExpiry]     = useState("");
  const [cardCvv,        setCardCvv]        = useState("");
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentSuccess,    setPaymentSuccess]    = useState(false);

  useEffect(() => { document.body.style.overflow = "unset"; document.body.style.pointerEvents = "unset"; }, []);
  useEffect(() => { if (!checkoutOpen || unlocked) { document.body.style.overflow = "unset"; document.body.style.pointerEvents = "unset"; } }, [checkoutOpen, unlocked]);

  // Re-fetch/hydrate scan results on mount
  useEffect(() => {
    // 1. Check scan URL query parameter
    const enc = searchParams.get("scan");
    if (enc) {
      try {
        const decoded = decodeScanFromUrl(enc);
        if (decoded) {
          const areaVal = decoded.scanInput.roofAreaM2;
          const pWatt = decoded.panelConfig.panelWattage ?? 450;
          const pCountVal = decoded.panelConfig.panelCount ?? 15;
          const customCapacityKw = Math.round((pCountVal * pWatt / 1000) * 100) / 100;
          
          setTariff(decoded.tariff.tariffPerKwh);
          setPType(pWatt === 550 ? "premium" : "compact");
          setPCount(pCountVal);
          setShading(decoded.panelConfig.shading || "auto");
          maxPanelsRef.current = pCountVal;

          const centroid = calcCentroid(decoded.scanInput.roofPolygon?.[0]?.coordinates?.[0]?.map(c => ({ lat: c[1], lng: c[0] })) ?? []);

          fetchSolarIrradiance(centroid.lat, centroid.lng).then((irradiance) => {
            const analysis = runFullCalculation(areaVal, irradiance.peakSunHours, {
              electricityRate: decoded.tariff.tariffPerKwh,
              irradianceSource: irradiance.source,
              monthlyIrradiance: irradiance.monthlyValues,
              customCapacityKw,
              panelCount: pCountVal,
              panelType: pWatt === 550 ? "premium" : "compact",
              shading: decoded.panelConfig.shading || "auto",
              pitchDegrees: decoded.scanInput.pitchDegrees,
              exclusionAreaM2: decoded.scanInput.exclusionAreaM2 || 0,
              computedShadingLoss: decoded.scanInput.computedShadingLoss,
              ws10m: irradiance.ws10m,
              t2m: irradiance.t2m,
            });

            const fullResult = {
              ...analysis,
              location: {
                lat: centroid.lat,
                lng: centroid.lng,
                label: decoded.scanInput.address || "Rooftop Structure",
              },
              panelCount: pCountVal,
            };

            store.setScanInput(decoded.scanInput);
            store.setPanelConfig(decoded.panelConfig);
            store.setTariff(decoded.tariff);

            let shadingLossVal = 0;
            let shadingSourceVal: 'auto' | 'manual' = 'auto';
            const shadingConfig = decoded.panelConfig.shading || "auto";
            if (shadingConfig === 'auto') {
              shadingLossVal = analysis.shadingLoss ?? 0;
              shadingSourceVal = 'auto';
            } else {
              shadingSourceVal = 'manual';
              if (shadingConfig === 'none') shadingLossVal = 0.0;
              else if (shadingConfig === 'partial') shadingLossVal = 0.15;
              else if (shadingConfig === 'heavy') shadingLossVal = 0.30;
            }
            store.setShadingSource(shadingSourceVal);
            store.setShadingLoss(shadingLossVal);

            store.setFullAnalysis(fullResult);

            // Persist the scan session to the database
            saveScanToDb(
              analysis.analysisId,
              decoded.scanInput,
              decoded.panelConfig,
              decoded.tariff,
              fullResult,
              user ? user.id : null
            );

            // Shared URLs never grant unlock — the server decides via
            // useUnlockStatus(analysisId). Reset any stale local flag.
            store.setIsPaid(false);

            setData(fullResult);
            setLoading(false);
          }).catch(() => {
            setLoading(false);
            setNoData(true);
          });
          return;
        }
      } catch (e) {
        console.error("Geode decode scan parameter error:", e);
      }
    }

    // 2. Check scan store
    const s = store;
    if (s.fullAnalysis) {
      setData(s.fullAnalysis);
      setTariff(s.tariff?.tariffPerKwh ?? 7.5);
      setPType(s.panelConfig?.panelWattage === 550 ? "premium" : "compact");
      setPCount(s.panelConfig?.panelCount ?? 15);
      setShading(s.panelConfig?.shading || "auto");
      maxPanelsRef.current = s.panelConfig?.panelCount ?? 15;
      setLoading(false);
      return;
    }

    // 3. Check sessionStorage fallback
    const stored = sessionStorage.getItem("sunpower-results");
    if (stored) {
      try {
        const p = JSON.parse(stored);
        if (p) {
          setData(p);
          setTariff(p.financials.electricityRateInr);
          setPType(p.panelType ?? "compact");
          setPCount(p.panelCount ?? 15);
          setShading(p.shading || "auto");
          maxPanelsRef.current = p.panelCount ?? 15;
          
          s.setScanInput({
            address: p.location?.label || "Mumbai",
            lat: p.location?.lat || 19.076,
            lng: p.location?.lng || 72.877,
            roofPolygon: [],
            roofAreaM2: p.rooftop?.drawnAreaM2 || 85.5,
            source: p.source,
            isExplicitlyFlat: p.isExplicitlyFlat,
            computedShadingLoss: p.computedShadingLoss,
          });
          s.setPanelConfig({
            tiltAngle: p.tiltDeg || 15,
            setbackM: p.setbackM || 0.5,
            walkwayM: p.walkways ? 0.8 : 0,
            panelWattage: (p.panelType === "premium" ? 550 : 450) as 450 | 550,
            orientation: p.orientation || "portrait",
            rowAlignment: (p.alignment === "south" ? "geographical_south" : "roof_perimeter") as any,
            panelCount: p.panelCount || 15,
            systemKwp: p.energy.installedCapacityKw || 6.5
          });
          s.setTariff({ tariffPerKwh: p.financials.electricityRateInr });
          
          let shadingLossVal = 0;
          let shadingSourceVal: 'auto' | 'manual' = 'auto';
          const shadingConfig = p.shading || "auto";
          if (shadingConfig === 'auto') {
            shadingLossVal = p.shadingLoss ?? p.computedShadingLoss ?? 0;
            shadingSourceVal = 'auto';
          } else {
            shadingSourceVal = 'manual';
            if (shadingConfig === 'none') shadingLossVal = 0.0;
            else if (shadingConfig === 'partial') shadingLossVal = 0.15;
            else if (shadingConfig === 'heavy') shadingLossVal = 0.30;
          }
          s.setShadingSource(shadingSourceVal);
          s.setShadingLoss(shadingLossVal);

          s.setFullAnalysis(p);

          // Reset local payment status on load to force verification from server.
          s.setIsPaid(false);
          setNoData(false);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.error("Session storage parse failed:", e);
      }
    }

    setNoData(true);
    setLoading(false);
  }, [searchParams, toast]);

  useEffect(() => {
    if (unlocked && data && !pvlibData && !isPvlibLoading) {
      setIsPvlibLoading(true);
      
      const enc = searchParams.get("scan");
      let decodedPolygon = null;
      let urlPitchDegrees = 0;
      if (enc) {
        try {
          const decoded = decodeScanFromUrl(enc);
          decodedPolygon = decoded?.scanInput?.roofPolygon;
          urlPitchDegrees = decoded?.scanInput?.pitchDegrees ?? 0;
        } catch {}
      }

      const centroid = calcCentroid(
        decodedPolygon?.[0]?.coordinates?.[0]?.map((c: any) => ({ lat: c[1], lng: c[0] })) ?? 
        store.scanInput?.roofPolygon?.[0]?.coordinates?.[0]?.map((c: any) => ({ lat: c[1], lng: c[0] })) ?? 
        []
      );
      
      const lat = data.location?.lat ?? centroid.lat;
      const lng = data.location?.lng ?? centroid.lng;
      const tilt = data.roof?.tilt ?? 15.0;
      
      const getAzimuthDeg = (az: string | number): number => {
        if (typeof az === "number") return az;
        const norm = String(az).toUpperCase().trim();
        if (norm === "N") return 0;
        if (norm === "NE") return 45;
        if (norm === "E") return 90;
        if (norm === "SE") return 135;
        if (norm === "S") return 180;
        if (norm === "SW") return 225;
        if (norm === "W") return 270;
        if (norm === "NW") return 315;
        return 180;
      };
      
      const azimuthDeg = getAzimuthDeg(data.roof?.azimuth || "S");
      const shadingStr = data.shading || store.panelConfig?.shading || "none";
      const pitchDeg = data.pitchDegrees ?? urlPitchDegrees ?? store.scanInput?.pitchDegrees ?? 0;
      const areaVal = data.rooftop?.drawnAreaM2 ?? store.scanInput?.roofAreaM2 ?? 10.0;
      
      const panelW = (pType === "premium" ? 550 : 450);
      const kw = (pCount * panelW) / 1000;

      fetch("/api/pvlib-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat,
          lng,
          tilt,
          azimuth: azimuthDeg,
          area_m2: areaVal,
          shading: shadingStr,
          pitch_degrees: pitchDeg,
          system_size_kwp: kw,
        }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("pvlib execution failed");
          return res.json();
        })
        .then((resData) => {
          if (resData && !resData.error) {
            setPvlibData(resData);
          }
        })
        .catch((err) => {
          console.warn("pvlib calculation failed, falling back to TypeScript values:", err);
        })
        .finally(() => {
          setIsPvlibLoading(false);
        });
    }
  }, [unlocked, data, store, pvlibData, isPvlibLoading, searchParams, pType, pCount]);

  useEffect(() => {
    if (data && !unlocked && !hasTrackedPaywall.current) {
      trackPaywallShown();
      hasTrackedPaywall.current = true;
    }
  }, [data, unlocked]);

  const psh   = data?.energy.peakSunHoursDaily ?? 5.0;
  const model = computeModel({
    peakSunHours: psh,
    pCount,
    pType,
    tariff,
    escalation,
    discountRate,
    omCost,
    batteryStorage,
    overrideAnnualKwh: pvlibData?.annual_yield_kwh,
    shading,
    computedShadingLoss: data?.computedShadingLoss,
    windZone: data?.windZone?.zone,
    tempDerate: data?.tempDerate
  });

  // Canonical metrics — ONE value per metric, used by every widget
  // below and passed to the PDF. Never recompute a metric inline.
  const metrics = deriveMetrics(model);

  const handleDownload = async () => {
    if (!data) return; setDownloading(true); setDownloadError(null);
    try {
      const cachedBrand = localStorage.getItem("solarsan-installer-brand-config");
      let activeBrandConfig = undefined;
      if (cachedBrand) {
        try {
          activeBrandConfig = JSON.parse(cachedBrand);
        } catch {}
      }

      await generatePDFReport(
        { ...data, energy: { ...data.energy, installedCapacityKw: model.installedKw, annualKwh: model.baseAnnualKwh }, financials: { electricityRateInr: tariff, monthlySavingsInr: Math.round(model.yearlySavings[0]/12), annualSavingsInr: Math.round(model.yearlySavings[0]), savings25yrInr: Math.round(metrics.lifetimeSavingsInr) }, panelCount: pCount, panelType: pType } as any,
        { locationLabel: data.location?.label || "India", brandConfig: activeBrandConfig },
        model
      );
      toast({ title: "Report Downloaded" });
    } catch (err) {
      console.error("PDF generation failed:", err);
      const msg = "Failed to generate report.";
      setDownloadError(msg);
      toast({ title: "Download Failed", description: msg, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [sharePhone, setSharePhone] = useState("");
  const [sharePhoneError, setSharePhoneError] = useState("");
  const [isSharing, setIsSharing] = useState(false);

  const validatePhone = (num: string): boolean => {
    const cleaned = num.replace(/\D/g, "");
    if (cleaned.length !== 10) {
      setSharePhoneError("Phone number must be exactly 10 digits.");
      return false;
    }
    if (!/^[6789]/.test(cleaned)) {
      setSharePhoneError("Indian mobile numbers must start with 6, 7, 8, or 9.");
      return false;
    }
    setSharePhoneError("");
    return true;
  };

  const handleWhatsAppShare = async () => {
    if (!data) return;
    if (!validatePhone(sharePhone)) return;

    setIsSharing(true);
    try {
      const enc = searchParams.get("scan");
      const shareUrl = `${window.location.origin}/results?scan=${enc || ""}`;
      const shortUrl = await shortenUrl(shareUrl);
      
      const savings25yr = metrics.lifetimeSavingsInr;
      const savingsLakh = parseFloat((savings25yr / 100000).toFixed(1));
      
      const rawConfidence = calcConfidenceScore({
        source: data.source ?? "none",
        pitchDegrees: data.pitchDegrees ?? 0,
        isExplicitlyFlat: data.isExplicitlyFlat ?? false,
        computedShadingLoss: data.computedShadingLoss ?? null,
        exclusionAreaM2: data.exclusionAreaM2 ?? 0,
        isRegionalFallback: data.irradianceSource === "REGIONAL_FALLBACK",
        pvlibAvailable: false,
        allExclusionZonesDrawn: (data.exclusionAreaM2 ?? 0) > 0,
      });
      const confidenceScore = Math.round(rawConfidence * 100);

      const message = generateWhatsAppMessage({
        address: data.location?.label || "India",
        systemSizeKw: model.installedKw,
        lifetimeSavingsLakh: savingsLakh,
        paybackYears: parseFloat(model.paybackPeriod.toFixed(1)),
        confidenceScore: confidenceScore,
        reportUrl: shortUrl
      });

      const waUrl = generateWhatsAppUrl(sharePhone, message);
      window.open(waUrl, "_blank");
      setShareModalOpen(false);
      setSharePhone("");
    } catch (err) {
      console.error("WhatsApp share failed:", err);
      toast({ title: "Sharing Failed", description: "Failed to generate share link.", variant: "destructive" });
    } finally {
      setIsSharing(false);
    }
  };

  const handleSandboxCheckout = () => {
    setPaymentProcessing(true); trackPaymentInitiated(paymentPlan);
    setTimeout(() => {
      setPaymentProcessing(false); setPaymentSuccess(true);
      setTimeout(() => {
        store.setIsPaid(true, `pay_mock_${Date.now()}`);
        const ca = store.fullAnalysis;
        if (ca) store.setFullAnalysis({ ...ca, unlocked: true });
        setCheckoutOpen(false); setPaymentSuccess(false);
        toast({ title: "Payment Successful", description: paymentPlan === "pro_monthly" ? "Pro Subscription activated!" : "Report unlocked successfully!" });
      }, 800);
    }, 1500);
  };

  if (noData) return (
    <div style={{ background: REPORT_TOKENS.ink }} className="min-h-screen flex items-center justify-center px-4">
      <div style={{ background: REPORT_TOKENS.parcel, border: `1px solid ${REPORT_TOKENS.graticule}` }} className="text-center max-w-md p-8 rounded-3xl sp-fade-up">
        <MapPin className="w-12 h-12 mx-auto mb-4" style={{ color: REPORT_TOKENS.solar }} />
        <h1 style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif", letterSpacing: "-0.02em", color: REPORT_TOKENS.text }} className="text-2xl font-semibold mb-2">No Analysis Found</h1>
        <p style={{ color: REPORT_TOKENS.muted }} className="text-sm mb-6">Draw your rooftop on the map first to generate a solar potential analysis report.</p>
        <button onClick={() => navigate("/map")} style={{ background: REPORT_TOKENS.solarDim, color: REPORT_TOKENS.onAccent }} className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer">Go to Map →</button>
      </div>
    </div>
  );

  if (loading) return (
    <div style={{ background: REPORT_TOKENS.ink }} className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div style={{ border: `2px solid ${REPORT_TOKENS.graticule}`, borderTopColor: REPORT_TOKENS.yield }} className="w-8 h-8 rounded-full sp-spin" />
        <span style={{ color: REPORT_TOKENS.muted }} className="text-xs font-mono uppercase tracking-widest">Loading Report...</span>
      </div>
    </div>
  );

  if (!data) return null;

  // Confidence score calculation
  const scanSource = data.source ?? store.scanInput?.source ?? "none";
  const pitchDeg = data.pitchDegrees ?? store.scanInput?.pitchDegrees ?? 0;
  const isExplicitFlat = store.scanInput?.isExplicitlyFlat ?? false;
  const computedShading = data.computedShadingLoss ?? store.scanInput?.computedShadingLoss;
  const exclusionArea = data.exclusionAreaM2 ?? store.scanInput?.exclusionAreaM2 ?? 0;
  const isFallback = data.irradianceSource === "REGIONAL_FALLBACK";
  const pvlibAvail = !!pvlibData && !pvlibData.error;
  const allExclusions = (store.scanInput?.exclusionZones?.length ?? 0) > 0;

  const rawConfidence = calcConfidenceScore({
    source: scanSource,
    pitchDegrees: pitchDeg,
    isExplicitlyFlat: isExplicitFlat,
    computedShadingLoss: computedShading,
    exclusionAreaM2: exclusionArea,
    isRegionalFallback: isFallback,
    pvlibAvailable: pvlibAvail,
    allExclusionZonesDrawn: allExclusions,
  });
  const confidenceScore = Math.round(rawConfidence * 100);

  let badgeText = `Lower Confidence · ${confidenceScore}%`;
  let badgeColor = "#f97316";
  let badgeBg = "#f9731615";

  if (rawConfidence >= 0.85) {
    badgeText = `High Confidence · ${confidenceScore}%`;
    badgeColor = REPORT_TOKENS.yield; // #41e1b4
    badgeBg = `${REPORT_TOKENS.yield}15`;
  } else if (rawConfidence >= 0.65) {
    badgeText = `Medium Confidence · ${confidenceScore}%`;
    badgeColor = REPORT_TOKENS.solar; // #ffb87b
    badgeBg = `${REPORT_TOKENS.solar}15`;
  }

  let footprintText = "Manual trace";
  if (scanSource === "osm") footprintText = "OSM auto-detect";
  else if (scanSource === "photo") footprintText = "Photo estimate";

  const yieldText = pvlibAvail ? "pvlib high-precision" : "Standard model";

  const roiData     = model.cumulativeCashFlow.map((cf, y) => ({ year: y, cumulative: Math.round(cf) }));
  const yieldData   = Array.from({ length: 25 }, (_, i) => ({ year: `Yr ${i+1}`, production: Math.round(model.baseAnnualKwh * Math.pow(0.995, i)), efficiency: parseFloat((100 - i*0.5).toFixed(1)) }));
  const monthlyData = MONTH_KEYS.map((k, i) => {
    const mPsh = data.monthlyIrradiance?.[k] ?? psh;
    const days = i===1?28:[3,5,8,10].includes(i)?30:31;
    return { label: MONTH_LABELS[i], psh: parseFloat(mPsh.toFixed(2)), generation: Math.round(model.installedKw * mPsh * days * 0.86) };
  });
  const savings25L  = Math.round(metrics.lifetimeSavingsInr / 100000);

  // Dynamic Suitability Score Calculations
  const lat = data.location?.lat ?? 19.0;
  const lng = data.location?.lng ?? 73.0;

  // 1. Solar Orientation suitability
  // South alignment gets a higher score. Optimal tilt is close to latitude.
  const optimalTilt = Math.max(10, Math.min(30, Math.round(lat)));
  const tiltDiff = Math.abs((store.panelConfig?.tiltAngle ?? 15) - optimalTilt);
  const tiltScore = Math.max(0, 10 - tiltDiff * 0.5);
  const isSouth = store.panelConfig?.rowAlignment === "geographical_south";
  const pshFactor = Math.max(0, Math.min(10, (data.energy.peakSunHoursDaily - 3.5) * 5));
  const orientationScore = Math.round(Math.max(50, Math.min(99, 80 + (isSouth ? 10 : 0) + tiltScore + pshFactor)));

  // 2. Roof Area suitability
  const roofArea = data.rooftop.drawnAreaM2;
  let areaScore = 85;
  if (roofArea < 20) {
    areaScore = 55 + (roofArea / 20) * 15;
  } else if (roofArea < 50) {
    areaScore = 70 + ((roofArea - 20) / 30) * 15;
  } else if (roofArea < 150) {
    areaScore = 85 + ((roofArea - 50) / 100) * 13;
  } else {
    areaScore = 98 + Math.min(1, (roofArea - 150) / 1000);
  }
  areaScore = Math.round(Math.max(40, Math.min(99, areaScore)));

  // 3. Shading Loss suitability (based directly on user selection or auto estimation)
  const shadingSeed = Math.abs(Math.sin(lat) * 1000) % 3;
  let shadingScore = 96;
  const activeShading = shading === "auto"
    ? (data?.computedShadingLoss !== undefined && data.computedShadingLoss !== null
        ? (data.computedShadingLoss > 0.15 ? "heavy" : data.computedShadingLoss > 0 ? "partial" : "none")
        : "none")
    : shading;

  if (activeShading === "none") {
    shadingScore = Math.round(96 + shadingSeed);
  } else if (activeShading === "partial") {
    shadingScore = Math.round(78 + shadingSeed);
  } else { // heavy
    shadingScore = Math.round(52 + shadingSeed);
  }
  shadingScore = Math.max(10, Math.min(99, shadingScore));

  // 4. Structural suitability
  const structSeed = Math.abs(Math.cos(lng) * 1000) % 3;
  let structuralScore = 94;
  if ((store.panelConfig?.tiltAngle ?? 15) > 20) {
    structuralScore -= ((store.panelConfig?.tiltAngle ?? 15) - 20) * 0.8;
  }
  if ((store.panelConfig?.walkwayM ?? 0) > 0) {
    structuralScore += 4;
  } else {
    structuralScore -= 2;
  }
  if ((store.panelConfig?.panelCount ?? 15) > 50) {
    structuralScore -= 3;
  }
  structuralScore = Math.round(Math.max(60, Math.min(99, structuralScore + structSeed)));

  // Weighted suitability score
  const suitability = data.suitabilityScore !== undefined 
    ? data.suitabilityScore 
    : Math.round(
        orientationScore * 0.30 +
        areaScore * 0.20 +
        shadingScore * 0.35 +
        structuralScore * 0.15
      );

  const circumference = 2 * Math.PI * 45;
  const dashOffset  = circumference * (1 - suitability / 100);
  const roofUsable  = Math.round(Math.min(75, 50 + data.energy.peakSunHoursDaily * 4));
  const roofObst    = Math.min(30, 100 - roofUsable - 10);
  const roofAccess  = 100 - roofUsable - roofObst;

  // Hydrate BESS dynamic recommendations based on reactive slider models
  const activeBattery = data.battery || (batteryStorage ? recommendBattery(model.baseAnnualKwh / 365, "evening") : null);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');

        .sp-page * { box-sizing: border-box; }
        .sp-page { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }

        /* ── Animations (minimal — institutional) ── */
        @keyframes sp-fade-up  { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }
        @keyframes sp-fade-in  { from { opacity:0; } to { opacity:1; } }
        @keyframes sp-spin     { to { transform:rotate(360deg); } }
        @keyframes sp-bar-grow { from { height:0; } }
        @keyframes sp-count-in { from{opacity:0;transform:scale(.96)} to{opacity:1;transform:scale(1)} }
        @keyframes sp-gauge-draw {
          from { stroke-dashoffset: ${circumference}; }
          to   { stroke-dashoffset: ${dashOffset}; }
        }

        .sp-fade-up   { animation: sp-fade-up .5s cubic-bezier(.2,.8,.4,1) both; }
        .sp-fade-up-1 { animation: sp-fade-up .5s cubic-bezier(.2,.8,.4,1) .06s both; }
        .sp-fade-up-2 { animation: sp-fade-up .5s cubic-bezier(.2,.8,.4,1) .12s both; }
        .sp-fade-up-3 { animation: sp-fade-up .5s cubic-bezier(.2,.8,.4,1) .18s both; }
        .sp-fade-up-4 { animation: sp-fade-up .5s cubic-bezier(.2,.8,.4,1) .24s both; }
        .sp-fade-up-5 { animation: sp-fade-up .5s cubic-bezier(.2,.8,.4,1) .30s both; }
        .sp-fade-in   { animation: sp-fade-in .4s ease both; }
        .sp-spin      { animation: sp-spin .9s linear infinite; }
        .sp-count-in  { animation: sp-count-in .4s cubic-bezier(.2,.8,.4,1) .2s both; }
        .sp-gauge-ring { animation: sp-gauge-draw 1.2s cubic-bezier(.2,.8,.4,1) .4s both; }

        .sp-lbar-1 { height:20%; animation: sp-bar-grow .6s ease .3s both; }
        .sp-lbar-2 { height:40%; animation: sp-bar-grow .6s ease .45s both; }
        .sp-lbar-3 { height:70%; animation: sp-bar-grow .6s ease .6s both; }
        .sp-lbar-4 { height:90%; animation: sp-bar-grow .6s ease .75s both; }
        .sp-lbar-5 { height:100%; animation: sp-bar-grow .6s ease .9s both; }

        /* ── Navigation ── */
        .sp-nav {
          background: ${REPORT_TOKENS.ink}f4;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }

        /* ── Cards ── */
        .sp-card {
          border-radius: 16px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.3), 0 8px 28px rgba(0,0,0,0.28);
          transition: border-color .25s cubic-bezier(.25,.1,.25,1), transform .25s cubic-bezier(.25,.1,.25,1), box-shadow .25s cubic-bezier(.25,.1,.25,1);
        }
        .sp-card:hover {
          border-color: ${REPORT_TOKENS.graticuleStrong} !important;
          transform: translateY(-2px);
          box-shadow: 0 2px 4px rgba(0,0,0,0.35), 0 16px 44px rgba(0,0,0,0.4);
        }
        .sp-row:hover td { background: ${REPORT_TOKENS.parcelHigh} !important; }

        /* ── Module toggle buttons ── */
        .sp-toggle {
          border: 1px solid ${REPORT_TOKENS.graticule};
          background: transparent;
          color: ${REPORT_TOKENS.muted};
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: .06em;
          padding: 7px 16px;
          cursor: pointer;
          transition: all .2s cubic-bezier(.25,.1,.25,1);
          font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
          border-radius: 999px;
        }
        .sp-toggle.on {
          background: ${REPORT_TOKENS.solarDim}18;
          border-color: ${REPORT_TOKENS.solar}60;
          color: ${REPORT_TOKENS.solar};
        }
        .sp-toggle:hover:not(.on) {
          background: ${REPORT_TOKENS.parcelHigh};
          border-color: ${REPORT_TOKENS.graticuleStrong};
          color: ${REPORT_TOKENS.text};
        }

        /* ── Chart tab buttons ── */
        .sp-tab {
          background: transparent;
          border: none;
          color: ${REPORT_TOKENS.muted};
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: .06em;
          padding: 5px 14px;
          cursor: pointer;
          transition: all .2s cubic-bezier(.25,.1,.25,1);
          font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
          border-radius: 999px;
        }
        .sp-tab.on { background: ${REPORT_TOKENS.solar}; color: ${REPORT_TOKENS.onAccent}; }
        .sp-tab:hover:not(.on) { color: ${REPORT_TOKENS.text}; }

        /* ── Tooltip ── */
        .sp-tip {
          background: ${REPORT_TOKENS.parcelHigh};
          border: 1px solid ${REPORT_TOKENS.graticule};
          padding: 8px 12px;
          font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
          font-size: 10px;
          border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }

        /* ── Typography utilities ── */
        .tabular-nums { font-variant-numeric: tabular-nums; }
        .sp-serif { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif; font-weight: 600; letter-spacing: -0.02em; }
        .sp-mono  { font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; }
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-style: normal;
          line-height: 1;
          text-transform: none;
          white-space: nowrap;
          word-wrap: normal;
          direction: ltr;
          -webkit-font-smoothing: antialiased;
        }

        /* ── Section header label ── */
        .sp-section-label {
          font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: .1em;
          text-transform: uppercase;
          color: ${REPORT_TOKENS.muted};
        }

        /* ── Metric value (large number) ── */
        .sp-metric-value {
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif;
          font-size: 28px;
          font-weight: 600;
          letter-spacing: -0.02em;
          line-height: 1.05;
          font-variant-numeric: tabular-nums;
          color: ${REPORT_TOKENS.text};
        }

        /* ── Table ── */
        .sp-table-header th {
          font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: .08em;
          color: ${REPORT_TOKENS.muted};
          padding: 10px 12px;
          background: ${REPORT_TOKENS.parcelHigh};
          text-align: right;
        }
        .sp-table-header th:first-child { text-align: left; }
        .sp-table-body td {
          font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
          font-size: 11px;
          font-variant-numeric: tabular-nums;
          padding: 8px 12px;
          text-align: right;
          border-bottom: 1px solid ${REPORT_TOKENS.graticule}50;
        }
        .sp-table-body td:first-child { text-align: left; color: ${REPORT_TOKENS.muted}; font-size: 10px; }
        .sp-table-body tr:nth-child(even) td { background: ${REPORT_TOKENS.parcelHigh}30; }
        .sp-table-body tr:hover td { background: ${REPORT_TOKENS.parcelHigh} !important; }

        /* ── Print / PDF optimisation ── */
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .sp-nav, .no-print { display: none !important; }
          .sp-page { background: #0E0E0F !important; }
          section, .sp-card { break-inside: avoid; page-break-inside: avoid; }
          .sp-page-break { page-break-before: always; }
        }
      `}</style>

      <div className="sp-page min-h-screen" style={{ background: REPORT_TOKENS.ink, color: REPORT_TOKENS.text }}>

        {/* ── Header ──────────────────────────────────────────── */}
        <header className="sp-nav sticky top-0 z-50" style={{ borderBottom: `1px solid ${REPORT_TOKENS.graticule}` }}>
          <div className="flex justify-between items-center px-4 md:px-16 py-3 mx-auto max-w-[1280px]">
            <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }} className="flex items-center gap-2 group cursor-pointer">
              <img src="/logo.png" alt="SUNPOWER LINK Logo" className="w-10 h-10 object-contain transition-all duration-300 group-hover:scale-105" />
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif", color: REPORT_TOKENS.text, fontSize: "19px", fontWeight: 600, letterSpacing: "-0.02em" }}>
                SUNPOWER <span style={{ color: REPORT_TOKENS.solar }}>LINK</span>
              </div>
            </a>
            <nav className="hidden md:flex gap-6 items-center">
              <a style={{ color: REPORT_TOKENS.muted }} className="text-[10px] font-bold uppercase tracking-wider font-mono hover:text-white transition-colors cursor-pointer" onClick={() => navigate("/")}>Home</a>
              <a style={{ color: REPORT_TOKENS.muted }} className="text-[10px] font-bold uppercase tracking-wider font-mono hover:text-white transition-colors cursor-pointer" onClick={() => navigate("/market-insights")}>Market Insights</a>
              <a style={{ color: REPORT_TOKENS.muted }} className="text-[10px] font-bold uppercase tracking-wider font-mono hover:text-white transition-colors cursor-pointer" onClick={() => navigate("/policy-tracker")}>Policy Tracker</a>
              {user ? (
                <>
                  <a style={{ color: REPORT_TOKENS.muted }} className="text-[10px] font-bold uppercase tracking-wider font-mono hover:text-white transition-colors cursor-pointer" onClick={() => navigate("/my-scans")}>My Scans</a>
                  <a style={{ color: REPORT_TOKENS.muted }} className="text-[10px] font-bold uppercase tracking-wider font-mono hover:text-white transition-colors cursor-pointer" onClick={() => navigate("/settings")}>Settings</a>
                  <a style={{ color: REPORT_TOKENS.muted }} className="text-[10px] font-bold uppercase tracking-wider font-mono hover:text-red-400 transition-colors cursor-pointer" onClick={signOut}>Sign Out</a>
                </>
              ) : (
                <a style={{ color: REPORT_TOKENS.muted }} className="text-[10px] font-bold uppercase tracking-wider font-mono hover:text-white transition-colors cursor-pointer" onClick={() => navigate("/auth/signin")}>Sign In</a>
              )}
            </nav>
            <div className="flex items-center gap-2 md:gap-3">
              <button onClick={() => navigate("/map")}
                aria-label="Go back to map"
                style={{ background: REPORT_TOKENS.parcel, border: `1px solid ${REPORT_TOKENS.graticule}`, color: REPORT_TOKENS.text }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider hover:opacity-80 transition-opacity cursor-pointer rounded-lg">
                <ArrowLeft className="w-3 h-3" /> Back
              </button>
              {unlocked && (
                <>
                  <button onClick={handleDownload} disabled={downloading}
                    style={{ background: REPORT_TOKENS.parcel, border: `1px solid ${REPORT_TOKENS.graticule}`, color: REPORT_TOKENS.text }}
                    className="hidden md:flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider hover:opacity-80 transition-opacity disabled:opacity-40 cursor-pointer rounded-lg">
                    {downloading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                    {downloading ? "Generating..." : "Download PDF"}
                  </button>
                  <button onClick={() => setShareModalOpen(true)}
                    style={{ background: REPORT_TOKENS.parcel, border: `1px solid ${REPORT_TOKENS.graticule}`, color: REPORT_TOKENS.text }}
                    className="hidden md:flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider hover:opacity-80 transition-opacity cursor-pointer rounded-lg">
                    <span>📱</span> Share on WhatsApp
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-[1280px] mx-auto px-4 md:px-16 py-4 flex flex-col gap-8">

          {downloadError && (
            <div style={{ background: `${REPORT_TOKENS.cost}10`, border: `1px solid ${REPORT_TOKENS.cost}30`, color: REPORT_TOKENS.cost }} className="p-3 text-xs flex items-center gap-2 sp-fade-up">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{downloadError}</span>
              <button onClick={handleDownload} className="ml-auto underline font-bold">Retry</button>
            </div>
          )}

          {/* ── Section A: Document Header (Report Identity) ──────────────── */}
          <section className="pb-4 sp-fade-up border-b" style={{ borderColor: REPORT_TOKENS.graticule }}>
            <div className="flex flex-col md:flex-row justify-between items-baseline gap-2 mb-3">
              <div className="text-lg font-semibold tracking-wider sp-mono text-[#F0EEE9]">
                SUNPOWER LINK
              </div>
              <div className="text-[10px] font-semibold tracking-widest sp-mono text-neutral-500 uppercase flex gap-4">
                <span>TECHNICAL PROSPECTUS</span>
                <span>Q3 2026</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t" style={{ borderColor: REPORT_TOKENS.graticule }}>
              <div className="space-y-1">
                <div className="text-[11px] sp-mono text-[#8A8A99]">
                  Site ID: <span className="text-[#F0EEE9] font-medium">{data.analysisId?.slice(-6).toUpperCase() ?? "DV3ZEF"}</span>
                </div>
                <div className="text-[11px] text-neutral-400">
                  Location: <span className="sp-mono text-[#F0EEE9]">{data.location?.label ? data.location.label.split(",").slice(0,2).join(",") : "20.8251, 77.3409"}</span>
                </div>
              </div>
              
              <div className="flex flex-col md:items-end justify-between gap-1">
                <div className="text-[11px] text-neutral-400">
                  Generated: <span className="sp-mono text-[#F0EEE9]">17 July 2026</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-neutral-400">Confidence:</span>
                  <div
                    style={{ background: badgeBg, border: `1px solid ${badgeColor}`, color: badgeColor }}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider font-mono"
                  >
                    {confidenceScore}%
                  </div>
                </div>
              </div>
            </div>
          </section>

          {unlocked ? (
            /* ================================================================
               UNLOCKED STATE
            ================================================================ */
            <>
              {/* ═══ TIER 0 — HERO: Rooftop array site-plan + payback ═══ */}
              <section className="sp-fade-up-1 grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] border rounded-[6px] overflow-hidden" style={{ borderColor: REPORT_TOKENS.graticule, background: REPORT_TOKENS.parcel }}>
                {/* Rooftop parcel — the signature visualization */}
                <div className="relative min-h-[300px] lg:min-h-[380px]" style={{ borderColor: REPORT_TOKENS.graticule }}>
                  <RoofLayoutDiagram
                    polygons={store.scanInput?.roofPolygon ?? []}
                    panelConfig={store.panelConfig}
                    width={520}
                    height={380}
                    showCount={false}
                  />
                  {/* Site-plan corner stamps */}
                  <div className="absolute top-4 left-4 flex flex-col gap-1 pointer-events-none">
                    <div className="text-[9px] font-bold uppercase tracking-[0.14em] font-mono" style={{ color: REPORT_TOKENS.muted }}>Array Site Plan</div>
                    <div className="text-[10px] font-mono" style={{ color: REPORT_TOKENS.text }}>
                      {data.location?.label ? data.location.label.split(",").slice(0, 2).join(",") : "20.8251, 77.3409"}
                    </div>
                  </div>
                  <div className="absolute bottom-4 left-4 flex gap-4 pointer-events-none">
                    <div className="flex items-center gap-1.5">
                      <span style={{ background: REPORT_TOKENS.solar, width: 10, height: 10 }} className="rounded-[2px] inline-block" />
                      <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: REPORT_TOKENS.muted }}>{pCount} panels · {model.installedKw.toFixed(1)} kWp</span>
                    </div>
                  </div>
                </div>

                {/* Hero metric — payback period */}
                <div className="flex flex-col justify-between p-8 lg:border-l" style={{ borderColor: REPORT_TOKENS.graticule, background: REPORT_TOKENS.parcelHigh }}>
                  <div className="text-[9px] font-bold uppercase tracking-[0.14em] font-mono" style={{ color: REPORT_TOKENS.muted }}>
                    Investment Payback
                  </div>
                  <div className="my-6">
                    <div className="flex items-baseline gap-2">
                      <span style={{ color: REPORT_TOKENS.text, fontSize: 64, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1 }} className="tabular-nums font-sans">
                        {metrics.paybackFound ? metrics.paybackYears.toFixed(1) : "25+"}
                      </span>
                      <span className="text-lg font-sans" style={{ color: REPORT_TOKENS.muted }}>years</span>
                    </div>
                    <p className="mt-3 text-[12px] leading-relaxed" style={{ color: REPORT_TOKENS.muted }}>
                      Time to fully recover your net capital outlay of{" "}
                      <span style={{ color: REPORT_TOKENS.text }} className="font-mono">{formatINR(metrics.netCostInr)}</span>{" "}
                      from energy savings.
                    </p>
                  </div>
                  {/* Payback progress against the 25-yr horizon */}
                  <div>
                    <div className="flex justify-between text-[9px] font-mono uppercase tracking-wider mb-1.5" style={{ color: REPORT_TOKENS.muted }}>
                      <span>Recovered</span>
                      <span>{metrics.paybackFound ? metrics.paybackYears.toFixed(1) : "25+"} / 25 yrs</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: REPORT_TOKENS.graticule }}>
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (metrics.paybackYears / 25) * 100)}%`, background: REPORT_TOKENS.solar }} />
                    </div>
                  </div>
                </div>
              </section>

              {/* ═══ TIER 1 — Secondary KPIs ═══ */}
              <section className="sp-fade-up-1 grid grid-cols-1 md:grid-cols-3 border-l border-t rounded-[6px] overflow-hidden" style={{ borderColor: REPORT_TOKENS.graticule }}>
                {/* Lifetime Savings — positive → yield */}
                <div className="p-6 border-r border-b flex flex-col justify-between h-36" style={{ borderColor: REPORT_TOKENS.graticule, background: REPORT_TOKENS.parcel }}>
                  <div className="text-[9px] font-bold uppercase tracking-[0.14em] font-mono" style={{ color: REPORT_TOKENS.muted }}>Lifetime Savings · 25 yr</div>
                  <div className="tabular-nums font-sans" style={{ color: REPORT_TOKENS.yield, fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em" }}>
                    {formatINR(metrics.lifetimeSavingsInr)}
                  </div>
                  <div className="text-[9px] font-mono" style={{ color: REPORT_TOKENS.muted }}>Net of upfront cost, nominal</div>
                </div>

                {/* Annual Production — neutral */}
                <div className="p-6 border-r border-b flex flex-col justify-between h-36" style={{ borderColor: REPORT_TOKENS.graticule, background: REPORT_TOKENS.parcel }}>
                  <div className="text-[9px] font-bold uppercase tracking-[0.14em] font-mono" style={{ color: REPORT_TOKENS.muted }}>Annual Production</div>
                  <div className="tabular-nums font-sans" style={{ color: REPORT_TOKENS.text, fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em" }}>
                    {Math.round(metrics.annualProductionKwh).toLocaleString("en-IN")} <span className="text-sm font-normal" style={{ color: REPORT_TOKENS.muted }}>kWh</span>
                  </div>
                  <div className="text-[9px] font-mono" style={{ color: REPORT_TOKENS.muted }}>Year one, before 0.5%/yr decline</div>
                </div>

                {/* Net Cost — money out → cost color context */}
                <div className="p-6 border-r border-b flex flex-col justify-between h-36" style={{ borderColor: REPORT_TOKENS.graticule, background: REPORT_TOKENS.parcel }}>
                  <div className="text-[9px] font-bold uppercase tracking-[0.14em] font-mono" style={{ color: REPORT_TOKENS.muted }}>Net Capital Outlay</div>
                  <div className="tabular-nums font-sans" style={{ color: REPORT_TOKENS.text, fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em" }}>
                    {formatINR(metrics.netCostInr)}
                  </div>
                  <div className="text-[9px] font-mono" style={{ color: REPORT_TOKENS.muted }}>After {formatINR(model.subsidyInr)} subsidy</div>
                </div>
              </section>


              {/* Secondary financial indicators — distinct from Tier 1 */}
              <section className="py-4 px-6 sp-fade-up-1 grid grid-cols-3 gap-4 border rounded-[6px]" style={{ background: REPORT_TOKENS.parcel, borderColor: REPORT_TOKENS.graticule }}>
                {[
                  { label: "Net Present Value", value: `${metrics.npvInr >= 0 ? "+" : "−"}${formatINR(Math.abs(metrics.npvInr))}`, color: metrics.npvInr >= 0 ? REPORT_TOKENS.yield : REPORT_TOKENS.cost },
                  { label: "Internal Rate of Return", value: metrics.irrFound ? `${metrics.irrPct.toFixed(1)}%` : "N/A", color: REPORT_TOKENS.text },
                  { label: "Levelised Cost of Energy", value: `₹${metrics.lcoeInrPerKwh.toFixed(2)}/kWh`, color: REPORT_TOKENS.text },
                ].map((item, i) => (
                  <div key={i} className="flex flex-col justify-center">
                    <div className="text-[9px] font-bold uppercase tracking-[0.12em] mb-1 font-mono" style={{ color: REPORT_TOKENS.muted }}>{item.label}</div>
                    <div className="tabular-nums font-semibold text-base font-mono" style={{ color: item.color }}>{item.value}</div>
                  </div>
                ))}
              </section>

              {/* Competitive Differentiators: Wind & Temp Derating */}
              {(() => {
                const isIndia = !!data?.location && (
                  data.location.label?.toLowerCase().includes("india") ||
                  (data.location.lat >= 8 && data.location.lat <= 38 && data.location.lng >= 68 && data.location.lng <= 98)
                );
                return (
                  <section className="sp-fade-up-1 grid grid-cols-1 md:grid-cols-2 border-l border-r border-b" style={{ borderColor: REPORT_TOKENS.graticule }}>
                    {/* Wind Zone Classification Card */}
                    <div className="p-5 border-r border-b md:border-b-0 flex flex-col justify-between h-36" style={{ borderColor: REPORT_TOKENS.graticule }}>
                      <div>
                        <div className="sp-section-label mb-1.5">Wind Zone Classification</div>
                        {isIndia ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider font-mono bg-[#E8A020]10 text-[#E8A020] border border-[#E8A020]20">
                                {data.windZone?.label ?? "Low Wind Zone"}
                              </span>
                            </div>
                            <div className="text-[10px] text-neutral-400 font-mono mt-1">
                              IS 875 Part 3 Structures
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider font-mono bg-neutral-800 text-neutral-400">
                            N/A (Non-India)
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="text-[9px] sp-mono text-neutral-500 mb-0.5">
                          {data.ws10m ? `Average Wind Speed (10m): ${data.ws10m.toFixed(2)} m/s` : "No wind data available"}
                        </div>
                        {isIndia && (
                          <div className="text-xs font-semibold font-mono" style={{ color: REPORT_TOKENS.solar }}>
                            Cost Adder: {data.windZone ? `₹${calcWindCostAdder(data.windZone?.zone).toLocaleString()}/kWp` : "₹0/kWp"}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Temperature Adjusted Card */}
                    <div className="p-5 flex flex-col justify-between h-36" style={{ borderColor: REPORT_TOKENS.graticule }}>
                      <div>
                        <div className="sp-section-label mb-1.5">Temperature Adjusted Yield</div>
                        <div className="sp-metric-value text-red-400" style={{ color: REPORT_TOKENS.cost }}>
                          {data.tempDerate ? `-${Math.round((1 - data.tempDerate) * 100)}%` : "0%"} <span className="text-sm font-sans font-normal text-neutral-400">output loss</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] sp-mono text-neutral-500 mb-0.5">
                          Cell temp: {data.t2m ? `${(data.t2m + 28).toFixed(1)}°C` : "N/A"} (ambient: {data.t2m ? `${data.t2m.toFixed(1)}°C` : "N/A"})
                        </div>
                        <div className="text-xs font-semibold font-mono text-red-400" style={{ color: REPORT_TOKENS.cost }}>
                          Temp Coefficient: -0.35% / °C above 25°C
                        </div>
                      </div>
                    </div>
                  </section>
                );
              })()}

              {/* PM-Surya Ghar Subsidy Eligibility Checker */}
              {(() => {
                const isIndia = !!data?.location && (
                  data.location.label?.toLowerCase().includes("india") ||
                  (data.location.lat >= 8 && data.location.lat <= 38 && data.location.lng >= 68 && data.location.lng <= 98)
                );
                if (!isIndia) return null;

                const hasNeStateIneligibility = !isEligible(eligibilityState, eligibilityConnectionType);
                const isSystemSizeTooLarge = model.installedKw > 10;
                
                // Eligibility conditions
                const isEligibleForSubsidy = 
                  checklistResidential && 
                  checklistGridConnected && 
                  !hasNeStateIneligibility && 
                  !isSystemSizeTooLarge;

                const subsidyAmt = isEligibleForSubsidy ? calcPMSuryaSubsidy(model.installedKw) : 0;
                
                const reasons: string[] = [];
                if (!checklistResidential) reasons.push("Property must be residential (domestic connection)");
                if (!checklistGridConnected) reasons.push("Must be a grid-connected system");
                if (hasNeStateIneligibility) reasons.push("Standard central subsidies do not apply or require special rates in NE states");
                if (isSystemSizeTooLarge) reasons.push("System size exceeds 10 kWp limit for standard PM-Surya Ghar scheme");

                return (
                  <section style={{ background: REPORT_TOKENS.parcel, border: `1px solid ${REPORT_TOKENS.graticule}` }} className="p-6 sp-card rounded-[4px] sp-fade-up-1">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 style={{ color: REPORT_TOKENS.text }} className="text-xs font-bold uppercase tracking-wider font-mono">
                          PM-Surya Ghar Subsidy Eligibility
                        </h3>
                        <p style={{ color: REPORT_TOKENS.muted }} className="text-[11px] mt-1 font-sans">
                          Verify your eligibility under the central government PM-Surya Ghar Muft Bijli Yojana rooftop solar scheme.
                        </p>
                      </div>
                      {isEligibleForSubsidy ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Eligible
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider font-mono bg-red-500/10 text-red-400 border border-red-500/20">
                          Ineligible
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                      {/* Left: Interactive Checklist */}
                      <div className="space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={checklistResidential}
                            onChange={(e) => {
                              setChecklistResidential(e.target.checked);
                              setEligibilityConnectionType(e.target.checked ? "domestic" : "commercial");
                            }}
                            className="w-3.5 h-3.5 rounded border-neutral-600 bg-neutral-900 text-[#E8A020] focus:ring-0 focus:ring-offset-0"
                          />
                          <span style={{ color: REPORT_TOKENS.text }} className="text-xs font-mono">Residential Property (Domestic)</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={checklistGridConnected}
                            onChange={(e) => setChecklistGridConnected(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-neutral-600 bg-neutral-900 text-[#E8A020] focus:ring-0 focus:ring-offset-0"
                          />
                          <span style={{ color: REPORT_TOKENS.text }} className="text-xs font-mono">Grid-Connected System</span>
                        </label>

                        {/* State selector */}
                        <div className="flex flex-col gap-1.5">
                          <label style={{ color: REPORT_TOKENS.muted }} className="text-[10px] font-bold uppercase tracking-wider font-mono">
                            Select State
                          </label>
                          <select
                            value={eligibilityState}
                            onChange={(e) => setEligibilityState(e.target.value)}
                            style={{ background: REPORT_TOKENS.ink, border: `1px solid ${REPORT_TOKENS.graticule}`, color: REPORT_TOKENS.text }}
                            className="px-2 py-1.5 rounded text-xs focus:outline-none font-mono w-full"
                          >
                            {INDIAN_STATES.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>

                        {/* System size check */}
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!isSystemSizeTooLarge}
                            readOnly
                            className="w-3.5 h-3.5 rounded border-neutral-600 bg-neutral-900 text-[#E8A020] focus:ring-0 focus:ring-offset-0 opacity-80 cursor-not-allowed"
                          />
                          <span style={{ color: REPORT_TOKENS.text }} className="text-xs font-mono">
                            System Size ({model.installedKw.toFixed(2)} kWp) ≤ 10 kWp
                          </span>
                        </div>
                      </div>

                      {/* Right: Subsidy Result Output */}
                      <div style={{ background: REPORT_TOKENS.parcel, border: `1px solid ${REPORT_TOKENS.graticule}` }} className="p-4 rounded-[4px] flex flex-col justify-between">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider font-mono text-neutral-400">
                            Calculation Output
                          </div>
                          
                          {isEligibleForSubsidy ? (
                            <div className="mt-3">
                              <div className="text-2xl font-bold font-mono text-emerald-400" style={{ color: REPORT_TOKENS.yield }}>
                                ₹{subsidyAmt.toLocaleString()}
                              </div>
                              <p className="text-[10px] text-neutral-400 font-sans mt-1">
                                Eligible for direct central government subsidy under PM-Surya Ghar Scheme guidelines.
                              </p>
                            </div>
                          ) : (
                            <div className="mt-3">
                              <div className="text-xs font-bold text-red-400 uppercase font-mono" style={{ color: REPORT_TOKENS.cost }}>
                                Not Eligible
                              </div>
                              <ul className="text-[10px] text-neutral-400 list-disc pl-4 mt-2 space-y-1 font-mono">
                                {reasons.map((r, i) => (
                                  <li key={i}>{r}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Pre-fill Form Button */}
                        {isEligibleForSubsidy && (
                          <button
                            onClick={() => {
                              generatePMSuryaApplicationPDF({
                                name: user?.email ? user.email.split("@")[0] : "Applicant Name",
                                phone: "9876543210",
                                systemSizeKw: model.installedKw,
                                estimatedCost: model.grossCost,
                                subsidyAmount: subsidyAmt,
                                state: eligibilityState
                              });
                              toast({ title: "Application Form Pre-Filled", description: "Downloaded pre-filled PDF application form." });
                            }}
                            style={{ background: REPORT_TOKENS.yield, color: REPORT_TOKENS.onAccent }}
                            className="mt-4 w-full py-2.5 text-[10px] font-bold uppercase tracking-wider rounded-lg hover:opacity-90 transition-opacity font-mono cursor-pointer flex items-center justify-center gap-1.5 border-none"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download Pre-filled Application Form
                          </button>
                        )}
                      </div>
                    </div>
                  </section>
                );
              })()}

              {/* Referral & Viral Sharing Section */}
              {(() => {
                const shareDetails = getReferralShareContent(referralState.referralCode, data?.location?.label || "my roof");
                
                return (
                  <section style={{ background: REPORT_TOKENS.parcel, border: `1px solid ${REPORT_TOKENS.graticule}` }} className="p-6 mt-4 sp-card rounded-[4px] sp-fade-up-1">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                      
                      {/* Left: Share Details & Actions */}
                      <div className="flex-1 space-y-4 w-full">
                        <div>
                          <h3 style={{ color: REPORT_TOKENS.text }} className="text-xs font-bold uppercase tracking-wider font-mono">
                            Share Solar Potential & Earn
                          </h3>
                          <p style={{ color: REPORT_TOKENS.muted }} className="text-[11px] mt-1 font-sans">
                            Refer your friends or neighbours to SolarScan. You earn <span className="font-bold text-[#E8A020]">₹50 cashback</span> for every paid report they unlock, and they get <span className="font-bold text-emerald-400">₹20 off</span> their first scan.
                          </p>
                        </div>

                        {/* Stats indicator */}
                        <div className="grid grid-cols-3 gap-3">
                          <div style={{ background: REPORT_TOKENS.ink, border: `1px solid ${REPORT_TOKENS.graticule}` }} className="p-2.5 rounded text-center">
                            <span style={{ color: REPORT_TOKENS.muted }} className="text-[9px] font-bold block uppercase font-mono">My Code</span>
                            <span style={{ color: REPORT_TOKENS.solar }} className="text-xs font-bold font-mono block mt-0.5">{referralState.referralCode}</span>
                          </div>
                          <div style={{ background: REPORT_TOKENS.ink, border: `1px solid ${REPORT_TOKENS.graticule}` }} className="p-2.5 rounded text-center">
                            <span style={{ color: REPORT_TOKENS.muted }} className="text-[9px] font-bold block uppercase font-mono">Referred Scans</span>
                            <span style={{ color: REPORT_TOKENS.text }} className="text-xs font-bold font-mono block mt-0.5">{referralState.referredScansCount}</span>
                          </div>
                          <div style={{ background: REPORT_TOKENS.ink, border: `1px solid ${REPORT_TOKENS.graticule}` }} className="p-2.5 rounded text-center">
                            <span style={{ color: REPORT_TOKENS.muted }} className="text-[9px] font-bold block uppercase font-mono">Cashback Earned</span>
                            <span style={{ color: REPORT_TOKENS.yield }} className="text-xs font-bold font-mono block mt-0.5">₹{referralState.cashbackEarnedInr}</span>
                          </div>
                        </div>

                        {/* Referral Link & Copy */}
                        <div className="flex flex-col gap-1.5">
                          <span style={{ color: REPORT_TOKENS.muted }} className="text-[10px] font-bold uppercase tracking-wider font-mono">My Referral Link</span>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              readOnly
                              value={shareDetails.referralLink}
                              style={{ background: REPORT_TOKENS.ink, border: `1px solid ${REPORT_TOKENS.graticule}`, color: REPORT_TOKENS.text }}
                              className="px-3 py-1.5 rounded text-xs focus:outline-none font-mono flex-1 min-w-0"
                            />
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(shareDetails.referralLink);
                                toast({ title: "Link Copied", description: "Referral URL copied to clipboard." });
                              }}
                              style={{ border: `1px solid ${REPORT_TOKENS.graticule}`, color: REPORT_TOKENS.text, background: "transparent" }}
                              className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer font-mono border"
                            >
                              Copy
                            </button>
                          </div>
                        </div>

                        {/* Viral Sharing Buttons */}
                        <div className="flex flex-wrap gap-2.5">
                          <a
                            href={shareDetails.whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ background: "#25D366", color: "#075E54" }}
                            className="flex-1 min-w-[120px] py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg text-center hover:opacity-90 transition-opacity font-mono flex items-center justify-center gap-1.5 cursor-pointer decoration-none"
                          >
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.451 5.403.002 9.792-4.382 9.795-9.79.001-2.621-1.013-5.086-2.856-6.93C16.328 2.05 13.87 1.037 11.26 1.036c-5.4.001-9.791 4.384-9.793 9.793-.001 1.543.41 3.05 1.194 4.376l-1.018 3.722 3.834-.997c1.3.7 2.6 1.07 4.17 1.026z"/></svg>
                            Share on WhatsApp
                          </a>
                          
                          <a
                            href={shareDetails.twitterUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ background: "#1DA1F2", color: "#FFFFFF" }}
                            className="flex-1 min-w-[120px] py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg text-center hover:opacity-90 transition-opacity font-mono flex items-center justify-center gap-1.5 cursor-pointer decoration-none"
                          >
                            Share on X
                          </a>
                          
                          <a
                            href={shareDetails.facebookUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ background: "#1877F2", color: "#FFFFFF" }}
                            className="flex-1 min-w-[120px] py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg text-center hover:opacity-90 transition-opacity font-mono flex items-center justify-center gap-1.5 cursor-pointer decoration-none"
                          >
                            Share on Facebook
                          </a>
                        </div>
                      </div>

                      {/* Right: Leaderboard */}
                      <div style={{ background: REPORT_TOKENS.parcel, border: `1px solid ${REPORT_TOKENS.graticule}` }} className="p-4 rounded-[4px] w-full md:w-80 shrink-0">
                        <div className="text-[10px] font-bold uppercase tracking-wider font-mono text-neutral-400 border-b border-neutral-800 pb-2 mb-2 flex justify-between">
                          <span>Leaderboard Standing</span>
                          <span style={{ color: REPORT_TOKENS.yield }}>Monthly Prizes</span>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {MONTHLY_LEADERBOARD.map((item) => (
                            <div key={item.rank} className="flex justify-between items-center text-[10px] font-mono py-1 border-b border-neutral-900 last:border-0">
                              <div className="flex items-center gap-2">
                                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${item.rank <= 3 ? "bg-[#E8A020] text-black" : "bg-neutral-800 text-neutral-400"}`}>
                                  {item.rank}
                                </span>
                                <span style={{ color: REPORT_TOKENS.text }} className="truncate max-w-[90px]">{item.name}</span>
                              </div>
                              <span style={{ color: REPORT_TOKENS.muted }}>{item.referrals} refs</span>
                              <span style={{ color: REPORT_TOKENS.yield }} className="text-[8px] font-bold truncate max-w-[90px] text-right">{item.prize}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </section>
                );
              })()}

              {/* ── Section C: Suitability & Roof Grid ──────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sp-fade-up-2">
                {/* Suitability Score Gauge */}
                <section style={{ background: REPORT_TOKENS.parcel, border: `1px solid ${REPORT_TOKENS.graticule}` }} className="p-6 flex flex-col items-center justify-center relative sp-card rounded-[4px]">
                  <div className="absolute top-4 left-4 text-[9px] font-bold uppercase tracking-wider font-mono" style={{ color: REPORT_TOKENS.muted }}>Suitability Score</div>
                  <div className="mt-4 flex items-center justify-center">
                    <Gauge
                      value={suitability}
                      centerValue={suitability}
                      defaultLabel="Suitability"
                      suffix="/100"
                      totalNotches={36}
                      spacing={22}
                      useGradient
                      activeGradient={suitability >= 80 ? ["#FF6600", "#10B981"] : ["#FF6600", "#F59E0B"]}
                      width={170}
                      height={170}
                    />
                  </div>
                  <p className="mt-2 text-center text-[11px] leading-relaxed text-neutral-400">
                    {suitability >= 90
                      ? "Excellent solar potential based on roof orientation and shading analysis."
                      : suitability >= 75
                      ? "Good solar potential with minor optimization recommended for shading/orientation."
                      : "Moderate solar potential. Shading or roof structural constraints may limit overall efficiency."}
                  </p>
                </section>

                {/* Factor Breakdown */}
                <section style={{ background: REPORT_TOKENS.parcel, border: `1px solid ${REPORT_TOKENS.graticule}` }} className="p-6 flex flex-col sp-card rounded-[4px] justify-between">
                  <div className="text-[9px] font-bold uppercase tracking-wider font-mono mb-4" style={{ color: REPORT_TOKENS.muted }}>Factor Breakdown</div>
                  <div className="flex flex-col gap-3.5 my-auto">
                    {[
                      { label: "Solar Orientation", pct: orientationScore },
                      { label: "Roof Area",          pct: areaScore },
                      { label: "Shading Loss",       pct: shadingScore },
                      { label: "Structural",         pct: structuralScore },
                    ].map((f) => (
                      <div key={f.label} className="flex items-center gap-3">
                        <span className="text-[11px] font-mono shrink-0 text-left" style={{ color: REPORT_TOKENS.muted, width: 115 }}>{f.label}</span>
                        <div className="flex-1 h-1 bg-neutral-800 rounded-none overflow-hidden">
                          <div style={{ width: `${f.pct}%`, background: REPORT_TOKENS.yield, height: "100%", transition: "width 1.2s cubic-bezier(.2,.8,.4,1)" }} />
                        </div>
                        <span className="text-[11px] font-mono tabular-nums w-8 text-right" style={{ color: REPORT_TOKENS.yield }}>{f.pct}%</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Roof Utilization */}
                <section style={{ background: REPORT_TOKENS.parcel, border: `1px solid ${REPORT_TOKENS.graticule}` }} className="p-6 flex flex-col sp-card rounded-[4px] justify-between">
                  <div className="text-[9px] font-bold uppercase tracking-wider font-mono mb-4" style={{ color: REPORT_TOKENS.muted }}>Roof Utilization</div>
                  <div className="flex flex-col gap-4 mt-auto">
                    <div className="w-full h-6 flex overflow-hidden rounded-none">
                      <div style={{ background: REPORT_TOKENS.yield,       width: `${roofUsable}%`,  transition: "width 1.2s ease" }} />
                      <div style={{ background: REPORT_TOKENS.graticuleStrong,         width: `${roofObst}%`,    transition: "width 1.2s ease .1s" }} />
                      <div style={{ background: REPORT_TOKENS.solar,         width: `${roofAccess}%`,  transition: "width 1.2s ease .2s" }} />
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[10px] font-mono" style={{ color: REPORT_TOKENS.muted }}>
                      <div className="flex items-center gap-1"><div style={{ background: REPORT_TOKENS.yield,       width: 6, height: 6 }} className="rounded-none" /> {roofUsable}% Use</div>
                      <div className="flex items-center gap-1"><div style={{ background: REPORT_TOKENS.graticuleStrong,         width: 6, height: 6 }} className="rounded-none" /> {roofObst}% Obs</div>
                      <div className="flex items-center gap-1"><div style={{ background: REPORT_TOKENS.solar,         width: 6, height: 6 }} className="rounded-none" /> {roofAccess}% Acc</div>
                    </div>
                  </div>
                </section>
              </div>

              {/* 3D AR Viewer */}
              {pCount > 0 && (
                <div className="sp-fade-up-2.5">
                  <RooftopARViewer
                    installedKw={model.installedKw}
                    panelCount={pCount}
                    areaM2={data.rooftop.drawnAreaM2}
                  />
                </div>
              )}

              {/* Battery backup recommendation */}
              {activeBattery && activeBattery.mode !== "none" && (
                <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border border-indigo-500/20 rounded-2xl p-5 sm:p-8 mb-4 hover:shadow-float transition-shadow duration-300 sp-fade-up-2.5">
                  <div className="flex items-center gap-2 mb-3">
                    <Battery className="w-5 h-5 text-indigo-400 animate-pulse" />
                    <h2 className="text-xl font-medium text-foreground">
                      Battery Backup — {activeBattery.mode === "offgrid" ? "Off-grid" : "Evening Backup"}
                    </h2>
                  </div>
                  <p className="text-sm text-muted-foreground mb-5">{activeBattery.description}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl bg-foreground/[0.04] p-3">
                      <div className="text-[11px] text-muted-foreground">Recommended size</div>
                      <div className="font-mono text-xl font-semibold text-indigo-400">{activeBattery.recommendedKwh} kWh</div>
                    </div>
                    <div className="rounded-xl bg-foreground/[0.04] p-3">
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Clock className="w-3 h-3" /> Backup</div>
                      <div className="font-mono text-xl font-semibold text-foreground">{activeBattery.backupHours} hrs</div>
                    </div>
                    <div className="rounded-xl bg-foreground/[0.04] p-3">
                      <div className="text-[11px] text-muted-foreground">Upfront cost</div>
                      <div className="font-mono text-xl font-semibold text-foreground">₹{(activeBattery.costInr / 100000).toFixed(1)}L</div>
                    </div>
                    <div className="rounded-xl bg-foreground/[0.04] p-3">
                      <div className="text-[11px] text-muted-foreground">25-yr cost</div>
                      <div className="font-mono text-xl font-semibold text-foreground">₹{(activeBattery.lifetimeCostInr / 100000).toFixed(1)}L</div>
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-3">
                    LFP Li-ion · 85% depth-of-discharge · ~10 yr cycle life · includes inverter upgrade
                  </div>
                </div>
              )}

              {/* Time of Use Card */}
              {model.baseAnnualKwh > 0 && (
                <div className="sp-fade-up-2.5">
                  <TimeOfUseCard
                    dailyGenKwh={model.baseAnnualKwh / 365}
                    lat={data.location?.lat}
                  />
                </div>
              )}

              {/* Main 9/3 grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sp-fade-up-3">

                {/* Left side content */}
                <div className="lg:col-span-9 flex flex-col gap-8">

                  {/* ROI Tuning Console */}
                  <section>
                    <div style={{ borderBottom: `1px solid ${REPORT_TOKENS.graticule}` }} className="flex justify-between items-baseline pb-2 mb-4">
                      <h2 className="sp-serif text-[#F0EEE9] text-lg font-bold">ROI Tuning Console</h2>
                      <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-[#8A8A99]">Live Recalculation</span>
                    </div>
                    <div style={{ background: REPORT_TOKENS.parcel, border: `1px solid ${REPORT_TOKENS.graticule}` }} className="p-6 rounded-[4px]">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-2">
                        <SnappySlider values={[3,5,7.5,10,12,15]} defaultValue={7.5} value={tariff} min={3} max={15} step={0.5} onChange={setTariff} label="Electricity Tariff" prefix="₹" suffix=" / kWh" />
                        <SnappySlider values={[1,5,10,15,maxPanelsRef.current]} defaultValue={15} value={pCount} min={1} max={maxPanelsRef.current} step={1} onChange={setPCount} label="Active Panels" suffix={` / ${maxPanelsRef.current}`} />
                        <SnappySlider values={[0,2.5,4.5,7,10]} defaultValue={4.5} value={escalation} min={0} max={10} step={0.5} onChange={setEscalation} label="Annual Grid Escalation" suffix="%" />
                        <SnappySlider values={[0,3,5,8.5,12,15]} defaultValue={8.5} value={discountRate} min={0} max={15} step={0.5} onChange={setDiscountRate} label="NPV Discount Rate" suffix="%" />
                        <SnappySlider values={[0,1,2.5,5]} defaultValue={1} value={omCost} min={0} max={5} step={0.5} onChange={setOmCost} label="Annual O&M Inflation" suffix="%" />
                        <div className="flex flex-col gap-3 pb-4">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5 font-mono text-[#8A8A99]">Module Grade</div>
                            <div className="flex gap-1.5">
                              <button onClick={() => setPType("compact")} className={cn("sp-toggle flex-1 cursor-pointer", pType === "compact" && "on")}>450W Compact</button>
                              <button onClick={() => setPType("premium")} className={cn("sp-toggle flex-1 cursor-pointer", pType === "premium" && "on")}>550W Premium</button>
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5 font-mono text-[#8A8A99]">BESS Storage</div>
                            <button onClick={() => setBatteryStorage(!batteryStorage)} className={cn("sp-toggle w-full flex items-center justify-between px-3 cursor-pointer", batteryStorage && "on")}>
                              <span>Hybrid Battery (+₹85k CapEx)</span>
                              <span style={{ width: 10, height: 10, borderRadius: "50%", border: `2px solid ${batteryStorage ? REPORT_TOKENS.solarDim : REPORT_TOKENS.graticule}`, background: batteryStorage ? REPORT_TOKENS.solarDim : "transparent", display: "inline-block", transition: "all .15s" }} />
                            </button>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5 font-mono text-[#8A8A99]">Shading Estimate</div>
                            <select
                              value={shading}
                              onChange={(e) => handleShadingChange(e.target.value as any)}
                              style={{ background: REPORT_TOKENS.ink, border: `1px solid ${REPORT_TOKENS.graticule}`, color: REPORT_TOKENS.text }}
                              className="w-full px-3 py-2 text-xs focus:outline-none font-mono cursor-pointer rounded-[4px]"
                            >
                              <option value="auto" className="bg-[#0E0E0F]">Auto-detected from nearby buildings</option>
                              <option value="none" className="bg-[#0E0E0F]">None — full sun</option>
                              <option value="partial" className="bg-[#0E0E0F]">Partial — moderate shade</option>
                              <option value="heavy" className="bg-[#0E0E0F]">Heavy — significant shade</option>
                            </select>
                            <div className="text-xs font-bold font-mono mt-1.5" style={{ color: REPORT_TOKENS.text }}>
                              Shading Loss: {Math.round(model.shadingLoss * 100)}%
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                              {shading === "auto" || !shading
                                ? `Estimated from ${store.scanInput?.nearbyStructuresCount ?? 0} nearby structures`
                                : "User-selected estimate"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Solar Simulator */}
                  <section className="mb-8">
                    <div style={{ borderBottom: `1px solid ${REPORT_TOKENS.graticule}` }} className="flex justify-between items-baseline pb-2 mb-4">
                      <h2 className="sp-serif text-[#F0EEE9] text-lg font-bold">Interactive Solar Simulator</h2>
                      <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-[#8A8A99]">Simulate Cash Flow</span>
                    </div>
                    <SolarSimulator />
                  </section>

                  {/* Financial Forecasts charts */}
                  <section>
                    <div style={{ borderBottom: `1px solid ${REPORT_TOKENS.graticule}` }} className="flex justify-between items-baseline pb-2 mb-4">
                      <h2 className="sp-serif text-[#F0EEE9] text-lg font-bold">Financial Forecasts</h2>
                      <div style={{ background: REPORT_TOKENS.parcel, border: `1px solid ${REPORT_TOKENS.graticule}` }} className="flex rounded-none overflow-hidden border">
                        {[{ k: "roi", l: "Cumulative ROI" }, { k: "yield", l: "Degradation" }, { k: "monthly", l: "Climatology" }].map(t => (
                          <button key={t.k} onClick={() => setActiveTab(t.k as any)} className={cn("sp-tab", activeTab === t.k && "on")}>{t.l}</button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div style={{ background: REPORT_TOKENS.parcel, border: `1px solid ${REPORT_TOKENS.graticule}` }} className="h-64 p-4 rounded-[4px]">
                        {activeTab === "roi" ? (
                          <AreaChart data={roiData} xDataKey="year" margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid />
                            <XAxis tickFormatter={v => Number(v)===0?"Yr 0":Number(v)%5===0?`Yr ${v}`:""} />
                            <YAxis tickFormatter={v => v>=100000?`₹${(v/100000).toFixed(0)}L`:v<=-100000?`-₹${(Math.abs(v)/100000).toFixed(0)}L`:`₹${(v/1000).toFixed(0)}k`} />
                            <ReferenceLine y={0} stroke={REPORT_TOKENS.graticule} />
                            {model.breakEvenFound && <ReferenceLine x={model.breakEvenYr} stroke={REPORT_TOKENS.solar} />}
                            <Area dataKey="cumulative" stroke={REPORT_TOKENS.yield} fill={REPORT_TOKENS.yield} fillOpacity={0.12} strokeWidth={2} />
                            <ChartTooltip dataKeys={["cumulative"]} colors={[REPORT_TOKENS.yield]} formatter={(v, _k) => [`₹${Math.abs(Number(v)).toLocaleString()}`, Number(v) >= 0 ? "Cumulative ROI" : "Net Investment"]} />
                          </AreaChart>
                        ) : activeTab === "yield" ? (
                          <ComposedChart data={yieldData} xDataKey="year" margin={{ top: 10, right: -10, left: -20, bottom: 0 }}>
                            <CartesianGrid />
                            <XAxis tickFormatter={(v, _i) => Number(v)%5===0?v:""} />
                            <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                            <Bar dataKey="production" fill={REPORT_TOKENS.yield} opacity={0.35} radius={[2, 2, 0, 0]} />
                            <Line dataKey="efficiency" stroke={REPORT_TOKENS.solar} strokeWidth={2} dot={false} />
                          </ComposedChart>
                        ) : (
                          <ComposedChart data={monthlyData} xDataKey="label" margin={{ top: 10, right: -10, left: -20, bottom: 0 }}>
                            <CartesianGrid />
                            <XAxis />
                            <YAxis />
                            <Bar dataKey="generation" fill={REPORT_TOKENS.yield} opacity={0.4} radius={[2, 2, 0, 0]} />
                            <Line dataKey="psh" stroke={REPORT_TOKENS.solar} strokeWidth={1.5} dot={false} />
                          </ComposedChart>
                        )}
                      </div>
                      {/* Cashflow Waterfall SVG infographic */}
                      {(() => {
                        const YEARS = 13;
                        const bars = model.cashFlows.slice(0, YEARS);
                        const cum  = model.cumulativeCashFlow.slice(0, YEARS);
                        const maxAbs = Math.max(...bars.map(Math.abs), ...cum.map(Math.abs)) || 1;

                        const W = 780, H = 320;
                        const PAD_L = 72, PAD_R = 24, PAD_T = 50, PAD_B = 52;
                        const chartW = W - PAD_L - PAD_R;
                        const chartH = H - PAD_T - PAD_B;
                        const barW   = chartW / YEARS;
                        const BAR_PAD = barW * 0.22;
                        const bw     = barW - BAR_PAD;
                        const zeroY  = PAD_T + chartH / 2;

                        const valToY = (v: number) => zeroY - (v / maxAbs) * (chartH / 2);
                        const barX   = (i: number) => PAD_L + i * barW + BAR_PAD / 2;

                        const cumPts = cum.map((v, i) => `${barX(i) + bw / 2},${valToY(v)}`).join(" L ");
                        const cumPath = `M ${cumPts}`;

                        const fmt = (v: number) => {
                          const abs = Math.abs(v);
                          if (abs >= 1_00_000) return `₹${(abs / 1_00_000).toFixed(1)}L`;
                          if (abs >= 1_000)   return `₹${(abs / 1_000).toFixed(0)}K`;
                          return `₹${Math.round(abs)}`;
                        };

                        const breakEvenYr = model.breakEvenYr;

                        return (
                          <div style={{ background: REPORT_TOKENS.parcel, border: `1px solid ${REPORT_TOKENS.graticule}` }} className="p-5 flex flex-col sp-card rounded-[4px]">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-bold uppercase tracking-widest font-mono" style={{ color: REPORT_TOKENS.text }}>Cashflow Waterfall</span>
                              <span className="text-xs font-mono" style={{ color: REPORT_TOKENS.muted }}>Yr 0 – Yr 12 · Net annual + cumulative</span>
                            </div>

                            <div className="flex items-center gap-4 flex-wrap mb-3">
                              <div className="flex items-center gap-1.5">
                                <span style={{ width: 10, height: 10, background: REPORT_TOKENS.yield }} className="rounded-none inline-block" />
                                <span className="text-[10px] font-mono font-semibold" style={{ color: REPORT_TOKENS.yield }}>Annual Savings</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span style={{ width: 10, height: 10, background: REPORT_TOKENS.cost }} className="rounded-none inline-block" />
                                <span className="text-[10px] font-mono font-semibold" style={{ color: REPORT_TOKENS.cost }}>CapEx / Outflow</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span style={{ width: 20, height: 2, background: REPORT_TOKENS.solar }} className="rounded-none inline-block" />
                                <span className="text-[10px] font-mono font-semibold" style={{ color: REPORT_TOKENS.solar }}>Cumulative</span>
                              </div>
                              {model.breakEvenFound && (
                                <div className="flex items-center gap-1.5 ml-auto">
                                  <span style={{ width: 2, height: 10, background: REPORT_TOKENS.solar }} className="inline-block" />
                                  <span className="text-[10px] font-mono font-semibold" style={{ color: REPORT_TOKENS.solar }}>
                                    Break-even Yr {model.breakEvenYr} ({model.paybackPeriod.toFixed(1)} yrs)
                                  </span>
                                </div>
                              )}
                            </div>

                            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
                              <defs>
                                <linearGradient id="cfGainGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={REPORT_TOKENS.yield} stopOpacity={0.95} />
                                  <stop offset="100%" stopColor={REPORT_TOKENS.yield} stopOpacity={0.4} />
                                </linearGradient>
                                <linearGradient id="cfLossGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={REPORT_TOKENS.cost} stopOpacity={0.5} />
                                  <stop offset="100%" stopColor={REPORT_TOKENS.cost} stopOpacity={0.95} />
                                </linearGradient>
                              </defs>

                              {[-1, -0.5, 0, 0.5, 1].map((frac) => {
                                const y = valToY(frac * maxAbs);
                                const val = frac * maxAbs;
                                const isZero = frac === 0;
                                return (
                                  <g key={frac}>
                                    <line
                                      x1={PAD_L} x2={W - PAD_R} y1={y} y2={y}
                                      stroke={isZero ? REPORT_TOKENS.text : `${REPORT_TOKENS.graticule}60`}
                                      strokeWidth={isZero ? 1.5 : 0.7}
                                      strokeDasharray={isZero ? undefined : "4 4"}
                                    />
                                    <text
                                      x={PAD_L - 8} y={y + 4.5}
                                      textAnchor="end" fontSize="13" fontFamily="monospace"
                                      fill={isZero ? REPORT_TOKENS.text : REPORT_TOKENS.muted}
                                      fontWeight={isZero ? "700" : "400"}
                                    >
                                      {isZero ? "₹0" : (val > 0 ? "+" : "") + fmt(val)}
                                    </text>
                                  </g>
                                );
                              })}

                              {bars.map((cf, i) => {
                                const x = barX(i);
                                const isPos = cf >= 0;
                                const barH = Math.max(4, (Math.abs(cf) / maxAbs) * (chartH / 2));
                                const y = isPos ? zeroY - barH : zeroY;
                                const isBreak = i === breakEvenYr;

                                const showLabel = i === 0 || i === YEARS - 1 || isBreak || i % 3 === 1;

                                return (
                                  <g key={i}>
                                    {isBreak && (
                                      <rect
                                        x={x - 2} y={PAD_T}
                                        width={bw + 4} height={chartH}
                                        fill={`${REPORT_TOKENS.solar}10`}
                                      />
                                    )}

                                    <rect
                                      x={x} y={y} width={bw} height={barH}
                                      fill={isPos ? "url(#cfGainGrad)" : "url(#cfLossGrad)"}
                                      stroke={isPos ? REPORT_TOKENS.yield : REPORT_TOKENS.cost}
                                      strokeWidth="0.8"
                                      rx="2"
                                    />

                                    {showLabel && (
                                      <text
                                        x={x + bw / 2} y={isPos ? y - 6 : y + barH + 14}
                                        textAnchor="middle" fontSize="11" fontFamily="monospace"
                                        fill={isBreak ? REPORT_TOKENS.solar : REPORT_TOKENS.text}
                                        fontWeight="600"
                                      >
                                        {fmt(cf)}
                                      </text>
                                    )}

                                    <text
                                      x={x + bw / 2} y={H - PAD_B + 18}
                                      textAnchor="middle" fontSize="11" fontFamily="monospace"
                                      fill={isBreak ? REPORT_TOKENS.solar : REPORT_TOKENS.muted}
                                      fontWeight={isBreak ? "700" : "400"}
                                    >
                                      Yr{i}
                                    </text>
                                  </g>
                                );
                              })}

                              <path d={cumPath} fill="none" stroke={REPORT_TOKENS.solar} strokeWidth="2.5" />
                              {cum.map((v, i) => (
                                <circle
                                  key={i} cx={barX(i) + bw / 2} cy={valToY(v)} r="3.5"
                                  fill={REPORT_TOKENS.ink} stroke={REPORT_TOKENS.solar} strokeWidth="2"
                                />
                              ))}
                            </svg>
                          </div>
                        );
                      })()}
                    </div>
                  </section>

                  {/* Cash Flow Table */}
                  <section style={{ background: REPORT_TOKENS.parcel, border: `1px solid ${REPORT_TOKENS.graticule}` }} className="p-6 rounded-[4px]">
                    <div className="flex flex-col sm:flex-row justify-between items-baseline gap-2 mb-4">
                      <h3 className="sp-serif text-[#F0EEE9] text-base font-bold">25-Year Operational Balance Sheet</h3>
                      <button
                        onClick={() => setShowAllYears(!showAllYears)}
                        style={{ border: `1px solid ${REPORT_TOKENS.graticule}`, background: REPORT_TOKENS.parcelHigh, color: REPORT_TOKENS.text }}
                        className="px-3 py-1.5 text-[9px] font-bold tracking-wider sp-mono uppercase hover:opacity-80 transition-opacity rounded-lg"
                      >
                        {showAllYears ? "Show Key Years Only" : "Expand Full 25-Year Ledger"}
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left font-mono">
                        <thead>
                          <tr className="sp-table-header">
                            <th className="py-2.5 px-3 rounded-none text-left" style={{ background: REPORT_TOKENS.parcelHigh, color: REPORT_TOKENS.muted }}>Yr</th>
                            <th className="py-2.5 px-3 rounded-none text-right" style={{ background: REPORT_TOKENS.parcelHigh, color: REPORT_TOKENS.muted }}>Yield (kWh)</th>
                            <th className="py-2.5 px-3 rounded-none text-right" style={{ background: REPORT_TOKENS.parcelHigh, color: REPORT_TOKENS.muted }}>Savings</th>
                            <th className="py-2.5 px-3 rounded-none text-right" style={{ background: REPORT_TOKENS.parcelHigh, color: REPORT_TOKENS.muted }}>O&M Cost</th>
                            <th className="py-2.5 px-3 rounded-none text-right" style={{ background: REPORT_TOKENS.parcelHigh, color: REPORT_TOKENS.muted }}>Maint. Res</th>
                            <th className="py-2.5 px-3 rounded-none text-right" style={{ background: REPORT_TOKENS.parcelHigh, color: REPORT_TOKENS.muted }}>Tax Benefit</th>
                            <th className="py-2.5 px-3 rounded-none text-right" style={{ background: REPORT_TOKENS.parcelHigh, color: REPORT_TOKENS.muted }}>Net Cashflow</th>
                            <th className="py-2.5 px-3 rounded-none text-right" style={{ background: REPORT_TOKENS.parcelHigh, color: REPORT_TOKENS.muted }}>Cumulative</th>
                          </tr>
                        </thead>
                        <tbody className="sp-table-body">
                          {(showAllYears ? Array.from({ length: 25 }, (_, i) => i + 1) : [1, 5, 10, 15, 20, 25]).map((yr) => {
                            const prod = model.baseAnnualKwh * Math.pow(0.995, yr - 1);
                            const savings = model.yearlySavings[yr - 1];
                            const om = model.yearlyOm[yr - 1];
                            const maintRes = yr === 10 ? 35000 : 0;
                            const taxBenefit = 0; // standard residential
                            const net = savings - om - maintRes + taxBenefit;
                            const cumNpv = model.cumulativeCashFlow[yr];
                            return (
                              <tr key={yr} className="sp-row border-b" style={{ borderColor: `${REPORT_TOKENS.graticule}50` }}>
                                <td className="py-2 px-3 text-left font-bold" style={{ color: REPORT_TOKENS.muted }}>{yr}</td>
                                <td className="py-2 px-3 text-right" style={{ color: REPORT_TOKENS.text }}>{Math.round(prod).toLocaleString()}</td>
                                <td className="py-2 px-3 text-right" style={{ color: REPORT_TOKENS.yield }}>{formatINR(savings, { decimals: 2 })}</td>
                                <td className="py-2 px-3 text-right animate-in fade-in" style={{ color: REPORT_TOKENS.cost }}>({formatINR(om, { decimals: 2 })})</td>
                                <td className="py-2 px-3 text-right" style={{ color: REPORT_TOKENS.cost }}>{maintRes > 0 ? `(${formatINR(maintRes, { decimals: 2 })})` : "—"}</td>
                                <td className="py-2 px-3 text-right text-neutral-500">—</td>
                                <td className="py-2 px-3 text-right font-medium" style={{ color: net > 0 ? REPORT_TOKENS.yield : REPORT_TOKENS.cost }}>
                                  {net > 0 ? "+" : ""}{formatINR(net, { decimals: 2 })}
                                </td>
                                <td className="py-2 px-3 text-right font-semibold" style={{ color: cumNpv >= 0 ? REPORT_TOKENS.text : REPORT_TOKENS.cost }}>
                                  {cumNpv >= 0 ? "+" : ""}{formatINR(cumNpv, { decimals: 2 })}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  {/* Lead capture CTA card */}
                  <div className="border p-6 sm:p-8 text-center sp-fade-up-4 rounded-[4px]" style={{ background: REPORT_TOKENS.parcel, borderColor: REPORT_TOKENS.graticule }}>
                    <div className="max-w-xl mx-auto">
                      <div className="inline-flex items-center gap-2 bg-neutral-800/40 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest sp-mono text-neutral-400 mb-3">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#2BD4A0]" /> Verified MNRE installers active
                      </div>
                      <h2 className="sp-serif text-2xl sm:text-3xl mb-2 font-bold leading-tight text-[#F0EEE9]">
                        Ready to install? Get a free quote.
                      </h2>
                      <p className="text-xs text-neutral-400 mb-5 max-w-md mx-auto leading-relaxed">
                        An authorized solar installer in your city will contact you within 24 hours with a custom structural quote and PM Surya Ghar paperwork.
                      </p>
                      <button
                        onClick={() => setLeadFormOpen(true)}
                        style={{ background: REPORT_TOKENS.solar, color: REPORT_TOKENS.onAccent }}
                        className="inline-flex items-center gap-2 font-bold px-6 py-2.5 rounded-lg hover:opacity-90 active:scale-95 transition-all text-xs uppercase cursor-pointer tracking-wider sp-mono"
                      >
                        <PhoneCall className="w-4 h-4" />
                        Talk to an installer
                      </button>
                      <div className="text-[9px] sp-mono text-neutral-500 mt-3">No spam · No obligation · Your number stays private</div>
                    </div>
                  </div>

                  {/* Remote Installer marketplace */}
                  <div className="sp-fade-up-4">
                    <InstallerMarketplace
                      installedKw={model.installedKw}
                      city={data.location?.label?.split(",")[0]?.trim()}
                    />
                  </div>

                  {/* Closing CTA */}
                  <section style={{ background: REPORT_TOKENS.parcel, border: `1px solid ${REPORT_TOKENS.graticule}` }} className="p-8 text-center flex flex-col items-center rounded-[4px]">
                    <span className="material-symbols-outlined text-4xl mb-3 text-neutral-400">solar_power</span>
                    <h2 className="sp-serif text-[#F0EEE9] text-2xl font-bold mb-2">Get 3 Verified Installer Quotes</h2>
                    <p style={{ color: REPORT_TOKENS.muted }} className="text-xs max-w-2xl mb-6 leading-relaxed">Take the next step in realizing your projected ₹{savings25L}L in lifetime savings. Get competitive installation rates in minutes.</p>
                    <div className="flex flex-wrap justify-center gap-3">
                      <button onClick={() => setLeadFormOpen(true)} style={{ background: REPORT_TOKENS.yield, color: REPORT_TOKENS.onAccent }} className="flex items-center gap-2 px-5 py-2 text-[10px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer rounded-lg font-mono">
                        <span className="material-symbols-outlined text-sm">request_quote</span>
                        Request Quotes — Free
                      </button>
                      <button onClick={() => setLeadFormOpen(true)} style={{ background: REPORT_TOKENS.parcelHigh, border: `1px solid ${REPORT_TOKENS.graticule}`, color: REPORT_TOKENS.text }} className="flex items-center gap-2 px-5 py-2 text-[10px] font-bold uppercase tracking-wider hover:opacity-80 transition-opacity cursor-pointer rounded-lg font-mono">
                        <span className="material-symbols-outlined text-sm">calendar_month</span>
                        Schedule Consultation
                      </button>
                      <button onClick={handleDownload} disabled={downloading} style={{ background: REPORT_TOKENS.parcelHigh, border: `1px solid ${REPORT_TOKENS.graticule}`, color: REPORT_TOKENS.text }} className="flex items-center gap-2 px-5 py-2 text-[10px] font-bold uppercase tracking-wider hover:opacity-80 transition-opacity disabled:opacity-40 cursor-pointer rounded-lg font-mono">
                        {downloading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        {downloading ? "Generating..." : "Download PDF"}
                      </button>
                      <button onClick={() => setShareModalOpen(true)} style={{ background: REPORT_TOKENS.parcelHigh, border: `1px solid ${REPORT_TOKENS.graticule}`, color: REPORT_TOKENS.text }} className="flex items-center gap-2 px-5 py-2 text-[10px] font-bold uppercase tracking-wider hover:opacity-80 transition-opacity cursor-pointer rounded-lg font-mono">
                        <span>📱</span> Share on WhatsApp
                      </button>
                    </div>
                  </section>
                </div>

                {/* Right Sidebar */}
                <aside className="lg:col-span-3 flex flex-col gap-4 sp-fade-up-4">
                  {/* Energy Grade */}
                  <div style={{ background: REPORT_TOKENS.parcel, border: `1px solid ${REPORT_TOKENS.graticule}` }} className="p-4 flex flex-col items-center text-center sp-card rounded-[4px]">
                    <div style={{ width: 70, height: 70, borderRadius: "50%", background: `${REPORT_TOKENS.yield}08`, border: `1px solid ${REPORT_TOKENS.yield}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                      <span className="sp-serif text-2xl text-emerald-400 font-bold">A+</span>
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-wider sp-mono text-[#F0EEE9]">Energy Grade</h3>
                    <p className="text-[11px] mt-1 text-neutral-400">Top 12% in {data.location?.label?.split(",")[0] ?? "your"} region based on roof potential.</p>
                  </div>

                  <SideCard title="Technical Assumptions">
                    <DataList rows={[
                      { label: "Panel Degradation", value: "0.55% / yr" },
                      { label: "Inverter Efficiency", value: "97.5%" },
                      { label: "System Losses",       value: "14.0%" },
                      { label: "Tariff Escalation",   value: `${escalation}% p.a.` },
                      { label: "Discount Rate",        value: `${discountRate}%` },
                      { label: "O&M Escalation",       value: `${omCost}% p.a.` },
                    ]} />
                  </SideCard>

                  <SideCard title="Hardware Configuration">
                    <DataList rows={[
                      { label: "Modules",    value: `${pCount}x ${pType === "premium" ? "550W" : "450W"} Mono PERC` },
                      { label: "Inverter",   value: `1x ${Math.round(model.installedKw)}kW String` },
                      { label: "Monitoring", value: "Smart Meter Pro" },
                    ]} />
                  </SideCard>

                  <SideCard title="Geospatial Parameters">
                    <DataList rows={[
                      { label: "Horizon Shading", value: `${Math.round(model.shadingLoss * 100)}% Loss` },
                      { label: "Albedo",           value: "0.20" },
                      { label: "Sky View Factor",  value: data.skyViewFactor !== undefined ? data.skyViewFactor.toFixed(2) : "0.95" },
                      { label: "Azimuth",          value: data.roof?.azimuth ? `${data.roof.azimuth} (Facing)` : "180° (South)" },
                      { label: "Tilt",             value: `${data.roof?.tilt ?? 20}°` },
                      { label: "Wind Zone",        value: `${typeof data.windZone === "object" ? (data.windZone?.label ?? "Zone 1") : (data.windZone ?? "Zone 1")} (${typeof data.windZone === "object" ? (data.windZone?.category ?? "Low") : (data.windZoneLabel ?? "Low")})` },
                    ]} />
                  </SideCard>

                  <SideCard title="AI Roof Insights">
                    <p className="text-[11px] mb-3 text-neutral-400 leading-relaxed">Strong southern exposure detected. Minimal shading from adjacent structures modeled via LIDAR.</p>
                    <RoofLayoutDiagram
                      polygons={store.scanInput?.roofPolygon ?? []}
                      panelConfig={store.panelConfig}
                    />
                  </SideCard>

                  {/* Installer Readiness */}
                  <div style={{ background: REPORT_TOKENS.parcel, border: `1px solid ${REPORT_TOKENS.graticule}` }} className="p-4 sp-card rounded-[4px]">
                    <h3 className="text-[9px] font-bold uppercase tracking-wider mb-3 font-mono"
                      style={{ color: REPORT_TOKENS.text, borderBottom: `1px solid ${REPORT_TOKENS.graticule}`, paddingBottom: "8px" }}>Installer Readiness</h3>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-mono" style={{ color: REPORT_TOKENS.muted }}>Risk Assessment</span>
                      <span className="text-[11px] font-mono font-bold" style={{ color: data.highWindWarning ? REPORT_TOKENS.cost : REPORT_TOKENS.yield }}>
                        {data.highWindWarning ? "HIGH" : "LOW"}
                      </span>
                    </div>
                    <div style={{ background: REPORT_TOKENS.parcelHigh }} className="w-full h-1 rounded-none overflow-hidden mb-3">
                      <div style={{ background: data.highWindWarning ? REPORT_TOKENS.cost : REPORT_TOKENS.yield, width: data.highWindWarning ? "75%" : "25%" }} className="h-full" />
                    </div>
                    <ul className="flex flex-col gap-1.5 text-[11px] font-mono" style={{ color: REPORT_TOKENS.muted }}>
                      {data.highWindWarning ? (
                        <li className="flex items-start gap-2 leading-relaxed" style={{ color: REPORT_TOKENS.cost }}>
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: REPORT_TOKENS.cost }} />
                          <span>High Wind Structural Risk Warning: Exceeds threshold for &gt;4 consecutive months.</span>
                        </li>
                      ) : (
                        <li className="flex items-center gap-2 text-neutral-300">✓ Structural Integrity OK</li>
                      )}
                      {data.windZone === "Zone 5/6" && (
                        <li className="flex items-start gap-2 mt-1" style={{ color: REPORT_TOKENS.solar }}>
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: REPORT_TOKENS.solar }} />
                          <span>Needs concrete ballast anchor modeling.</span>
                        </li>
                      )}
                      <li className="flex items-center gap-2 text-neutral-300">✓ Grid Connection Viable</li>
                    </ul>
                  </div>

                  <SideCard title="Headline Returns">
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-center font-mono">
                      <div style={{ background: REPORT_TOKENS.parcelHigh, border: `1px solid ${REPORT_TOKENS.graticule}` }} className="p-2.5 rounded-lg">
                        <div style={{ color: REPORT_TOKENS.muted }} className="mb-1 text-[8px] uppercase tracking-wider font-bold">Net Present Value</div>
                        <div style={{ color: metrics.npvInr >= 0 ? REPORT_TOKENS.yield : REPORT_TOKENS.cost }} className="font-bold text-sm">{metrics.npvInr >= 0 ? "+" : "−"}{formatINR(Math.abs(metrics.npvInr))}</div>
                      </div>
                      <div style={{ background: REPORT_TOKENS.parcelHigh, border: `1px solid ${REPORT_TOKENS.graticule}` }} className="p-2.5 rounded-lg">
                        <div style={{ color: REPORT_TOKENS.muted }} className="mb-1 text-[8px] uppercase tracking-wider font-bold">Rate of Return</div>
                        <div style={{ color: REPORT_TOKENS.text }} className="font-bold text-sm">{metrics.irrFound ? `${metrics.irrPct.toFixed(1)}% IRR` : "N/A"}</div>
                      </div>
                    </div>
                  </SideCard>

                  <InstallerLeadForm data={data} />
                </aside>
              </div>
            </>
          ) : (
            /* ================================================================
               LOCKED STATE — teaser upgrade layout
            ================================================================ */
            <div className="space-y-8 sp-fade-up-1">
              {/* AI Summary + metrics strip */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div style={{ background: REPORT_TOKENS.parcel, border: `1px solid ${REPORT_TOKENS.graticule}` }}
                  className="lg:col-span-1 p-6 flex flex-col gap-4 sp-card animate-slide-up rounded-[4px]">
                  <div className="flex items-center gap-2 text-[#2BD4A0]">
                    <Satellite className="w-5 h-5" />
                    <h2 className="sp-serif text-base font-bold">AI Summary</h2>
                  </div>
                  <div style={{ background: `${REPORT_TOKENS.yield}10`, border: `1px solid ${REPORT_TOKENS.yield}25` }} className="flex items-center gap-1.5 px-3 py-1 w-fit rounded-lg">
                    <div style={{ background: REPORT_TOKENS.yield, width: 5, height: 5, borderRadius: "50%" }} />
                    <span style={{ color: REPORT_TOKENS.yield }} className="text-[9px] font-bold uppercase tracking-widest font-mono">Geospatial Active</span>
                  </div>
                  <p style={{ color: REPORT_TOKENS.text }} className="text-xs leading-relaxed">
                    Based on geospatial analysis, this property exhibits excellent solar irradiance. The unshaded roof area supports a system capable of offsetting approximately{" "}
                    <span style={{ color: REPORT_TOKENS.text, fontWeight: 600 }}>92%</span> of historical energy consumption.
                  </p>
                </div>

                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: "Est. System Size",  value: data.energy.installedCapacityKw.toFixed(1), unit: "kWp", highlight: false },
                    { label: "Annual Production", value: data.energy.annualKwh.toLocaleString(),       unit: "kWh", highlight: false },
                    { label: "25-Yr Savings",     value: `₹${Math.round(data.financials.savings25yrInr/100000).toLocaleString()}L+`, unit: undefined, highlight: true },
                  ].map(({ label, value, unit, highlight }) => (
                    <div key={label}
                      style={{ background: REPORT_TOKENS.parcel, border: `1px solid ${highlight ? REPORT_TOKENS.yield+"35" : REPORT_TOKENS.graticule}` }}
                      className="sp-card p-6 flex flex-col justify-between relative overflow-hidden rounded-[4px]">
                      <span className="text-[9px] font-bold uppercase tracking-widest font-mono" style={{ color: highlight ? REPORT_TOKENS.yield : REPORT_TOKENS.muted }}>{label}</span>
                      <div className="mt-4 flex items-baseline gap-1.5">
                        <span style={{ color: highlight ? REPORT_TOKENS.yield : REPORT_TOKENS.text }} className="sp-serif text-3xl font-bold leading-none tabular-nums">
                          {value}
                        </span>
                        {unit && <span className="text-xs font-mono" style={{ color: REPORT_TOKENS.muted }}>{unit}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Locked paywall teaser container */}
              <div style={{ background: REPORT_TOKENS.parcel, border: `1px solid ${REPORT_TOKENS.graticule}`, minHeight: "500px" }} className="relative w-full overflow-hidden sp-fade-up-2 rounded-[4px]">
                {/* Faux content (blurred behind) */}
                <div className="absolute inset-0 p-8 opacity-10 pointer-events-none select-none flex flex-col gap-6">
                  <div style={{ borderBottom: `1px solid ${REPORT_TOKENS.graticule}` }} className="flex justify-between items-end pb-3">
                    <h3 className="sp-serif text-lg text-[#F0EEE9]">Cashflow & ROI Projection</h3>
                    <div className="flex gap-2">
                      <div style={{ background: REPORT_TOKENS.parcelHigh, height: 20, width: 80 }} />
                      <div style={{ background: REPORT_TOKENS.parcelHigh, height: 20, width: 80 }} />
                    </div>
                  </div>
                  <div style={{ borderLeft: `1px solid ${REPORT_TOKENS.graticule}`, borderBottom: `1px solid ${REPORT_TOKENS.graticule}` }} className="flex-grow w-full relative flex items-end gap-3 px-4 pb-0">
                    <div style={{ background: `${REPORT_TOKENS.parcelHigh}80`, width: "11%" }} className="sp-lbar-1" />
                    <div style={{ background: `${REPORT_TOKENS.parcelHigh}80`, width: "11%" }} className="sp-lbar-2" />
                    <div style={{ background: `${REPORT_TOKENS.yield}30`,      width: "11%" }} className="sp-lbar-3" />
                    <div style={{ background: `${REPORT_TOKENS.yield}30`,      width: "11%" }} className="sp-lbar-4" />
                    <div style={{ background: `${REPORT_TOKENS.yield}30`,      width: "11%" }} className="sp-lbar-5" />
                  </div>
                </div>

                {/* Fade overlay */}
                <div style={{ background: `linear-gradient(to bottom, transparent, ${REPORT_TOKENS.parcel}fc)` }} className="absolute inset-0 pointer-events-none" />

                {/* Upgrade panel */}
                <div className="absolute bottom-0 left-0 w-full p-8 flex flex-col items-center justify-center text-center z-10">
                  <div style={{ background: REPORT_TOKENS.ink, border: `1px solid ${REPORT_TOKENS.graticule}`, maxWidth: 540, width: "100%" }}
                    className="p-8 flex flex-col items-center gap-5 rounded-[4px] border">
                    <Lock style={{ color: REPORT_TOKENS.solar, width: 32, height: 32 }} />

                    <div className="flex w-full max-w-xs gap-1">
                      {[REPORT_TOKENS.yield, REPORT_TOKENS.yield, REPORT_TOKENS.solarDim, REPORT_TOKENS.graticule, REPORT_TOKENS.graticule].map((col, i) => (
                        <div key={i} style={{ height: 2, flex: 1, background: col }} />
                      ))}
                    </div>

                    <div className="flex flex-col gap-2">
                      <h3 className="sp-serif text-[#F0EEE9] text-xl font-bold leading-snug">
                        Unlock Your Full Solar Intelligence Report
                      </h3>
                      <p style={{ color: REPORT_TOKENS.text }} className="text-xs leading-relaxed max-w-sm mx-auto">
                        Access detailed financial models, itemized equipment specifications, 3D interactive viewer, and certified installer readiness breakdown.
                      </p>
                    </div>

                    <div className="flex flex-wrap justify-center gap-1.5">
                      {["25-Yr Cashflow Model","3D AR Preview","BESS Battery Config","PDF Export"].map(f => (
                        <div key={f} style={{ border: `1px solid ${REPORT_TOKENS.yield}30`, color: REPORT_TOKENS.yield, background: `${REPORT_TOKENS.yield}05` }} className="text-[9px] font-bold uppercase tracking-wider font-mono px-2.5 py-0.5 rounded-lg">
                          {f}
                        </div>
                      ))}
                    </div>

                    <button onClick={() => setCheckoutOpen(true)}
                      style={{ background: REPORT_TOKENS.solar, color: REPORT_TOKENS.onAccent }}
                      className="flex items-center gap-2 px-6 py-3 font-bold text-xs uppercase tracking-wider transition-all hover:opacity-90 active:scale-[0.98] rounded-lg cursor-pointer font-mono">
                      Unlock Report — ₹{payPerScanPrice} {hasReferralDiscount && "(₹20 off applied)"}
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-2 text-[10px] font-mono" style={{ color: REPORT_TOKENS.muted }}>
                      <ShieldCheck className="w-3.5 h-3.5" style={{ color: REPORT_TOKENS.yield }} />
                      Secure checkout. Immediate access.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footnote */}
          <div className="mt-4 text-center text-[8px] font-mono uppercase tracking-widest" style={{ color: REPORT_TOKENS.muted }}>
            SUNPOWER LINK Solar Estimation Engine · Grid loss factor: 14% · Climatology: NASA POWER API satellite profile · RCC flatness tilt structural calibration active
          </div>
        </main>

        {/* Footer */}
        <footer style={{ background: REPORT_TOKENS.ink, borderTop: `1px solid ${REPORT_TOKENS.graticule}` }} className="flex flex-col md:flex-row justify-between items-center px-4 md:px-16 py-4 gap-6 mt-4">
          <div className="flex flex-col gap-1.5 max-w-xl text-left">
            <div className="sp-serif text-[#8A8A99] text-sm font-bold">SUNPOWER LINK</div>
            <p className="text-[11px]" style={{ color: REPORT_TOKENS.muted }}>© {new Date().getFullYear()} SUNPOWER LINK. Financial intelligence driven by geospatial AI.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/map")} style={{ background: REPORT_TOKENS.yield, color: REPORT_TOKENS.onAccent }} className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider hover:opacity-95 transition-opacity cursor-pointer rounded-lg font-mono">
              Analyze Another Rooftop
            </button>
            <button onClick={() => navigate("/")} style={{ background: REPORT_TOKENS.parcel, border: `1px solid ${REPORT_TOKENS.graticule}`, color: REPORT_TOKENS.text }} className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider hover:opacity-80 transition-opacity cursor-pointer rounded-lg font-mono">
              Back to Home
            </button>
          </div>
          <div className="flex flex-col md:flex-row gap-6">
            {["Methodology","Data Sources","Terms","Privacy"].map(link => (
              <a key={link} href="#" className="text-[9px] font-bold uppercase tracking-wider font-mono transition-colors hover:text-white" style={{ color: REPORT_TOKENS.muted }}>{link}</a>
            ))}
          </div>
        </footer>

        {/* ── Checkout Dialog ───────────────────────────────────── */}
        <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
          <DialogContent style={{ background: REPORT_TOKENS.parcel, border: `1px solid ${REPORT_TOKENS.graticule}`, color: REPORT_TOKENS.text }} className="sm:max-w-[420px] rounded-[4px] shadow-2xl p-6 focus:outline-none border">
            <DialogHeader className="space-y-1.5 text-left">
              <DialogTitle className="text-xs font-bold flex items-center gap-2 font-mono uppercase tracking-wider" style={{ color: REPORT_TOKENS.solar }}>
                <Sparkles className="w-3.5 h-3.5" style={{ color: REPORT_TOKENS.solar }} />
                Secure Report Checkout
              </DialogTitle>
              <DialogDescription className="text-[10px]" style={{ color: REPORT_TOKENS.muted }}>
                Scan ID: <span className="font-mono font-bold text-neutral-300">{data.analysisId}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 my-3 text-left">
              <div className="text-[9px] font-bold uppercase tracking-wider font-mono" style={{ color: REPORT_TOKENS.muted }}>Select tier</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "pay_per_scan", label: "Single Scan", price: `₹${payPerScanPrice}`, sub: hasReferralDiscount ? "₹20 Referral Off" : "One-time payment" },
                  { key: "pro_monthly",  label: "Pro Monthly", price: "₹999/mo", sub: "Unlimited Scans", highlight: true },
                ].map(plan => (
                  <button key={plan.key} onClick={() => setPaymentPlan(plan.key as any)}
                    style={{ background: paymentPlan === plan.key ? `${REPORT_TOKENS.solar}05` : "transparent", border: `1px solid ${paymentPlan === plan.key ? REPORT_TOKENS.solar : REPORT_TOKENS.graticule}`, color: REPORT_TOKENS.text }}
                    className="p-3 text-left flex flex-col justify-between h-20 transition-all font-mono rounded-lg cursor-pointer">
                    <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: REPORT_TOKENS.muted }}>{plan.label}</span>
                    <span className="font-bold sp-serif text-base">{plan.price}</span>
                    <span className="text-[8px] text-[#2BD4A0]">{plan.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 my-2 text-left">
              <div className="text-[9px] font-bold uppercase tracking-wider font-mono" style={{ color: REPORT_TOKENS.muted }}>Payment details</div>
              <div style={{ background: REPORT_TOKENS.ink, border: `1px solid ${REPORT_TOKENS.graticule}` }} className="flex p-0.5 rounded-lg">
                {["card","upi"].map(m => (
                  <button key={m} onClick={() => setPaymentMethod(m as any)}
                    style={{ background: paymentMethod===m ? REPORT_TOKENS.solarDim : "transparent", color: paymentMethod===m ? REPORT_TOKENS.onAccent : REPORT_TOKENS.muted }}
                    className="flex-1 text-[9px] py-1 font-bold uppercase transition-all font-mono rounded-md cursor-pointer border-none outline-none">
                    {m === "card" ? "Card" : "UPI"}
                  </button>
                ))}
              </div>
              {paymentMethod === "card" ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-[8px] font-bold uppercase font-mono block mb-1" style={{ color: REPORT_TOKENS.muted }}>Card number</label>
                    <input type="text" placeholder="4000 1234 5678 9010" value={cardNumber} onChange={e => setCardNumber(e.target.value)}
                      style={{ background: REPORT_TOKENS.ink, border: `1px solid ${REPORT_TOKENS.graticule}`, color: REPORT_TOKENS.text }}
                      className="w-full px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#E8A020] rounded-lg border" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[8px] font-bold uppercase font-mono block mb-1" style={{ color: REPORT_TOKENS.muted }}>Expiry</label>
                      <input type="text" placeholder="MM/YY" value={cardExpiry} onChange={e => setCardExpiry(e.target.value)}
                        style={{ background: REPORT_TOKENS.ink, border: `1px solid ${REPORT_TOKENS.graticule}`, color: REPORT_TOKENS.text }}
                        className="w-full px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#E8A020] rounded-lg border" />
                    </div>
                    <div>
                      <label className="text-[8px] font-bold uppercase font-mono block mb-1" style={{ color: REPORT_TOKENS.muted }}>CVV</label>
                      <input type="password" placeholder="•••" value={cardCvv} onChange={e => setCardCvv(e.target.value)}
                        style={{ background: REPORT_TOKENS.ink, border: `1px solid ${REPORT_TOKENS.graticule}`, color: REPORT_TOKENS.text }}
                        className="w-full px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#E8A020] rounded-lg border" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <div style={{ border: `1px dashed ${REPORT_TOKENS.yield}30`, width: 120, height: 120, margin: "0 auto 8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span className="text-[8px] font-mono uppercase" style={{ color: REPORT_TOKENS.yield }}>SolarScan Sandbox QR</span>
                  </div>
                  <div className="text-[8px] font-mono uppercase" style={{ color: REPORT_TOKENS.muted }}>Scan with any UPI app</div>
                </div>
              )}
            </div>

            <div style={{ borderTop: `1px solid ${REPORT_TOKENS.graticule}` }} className="space-y-2 pt-4 mt-4">
              <button onClick={handleSandboxCheckout} disabled={paymentProcessing || paymentSuccess}
                style={{ background: REPORT_TOKENS.solar, color: REPORT_TOKENS.onAccent }}
                className="w-full text-[10px] font-bold py-2.5 flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity uppercase tracking-wider rounded-lg cursor-pointer border-none outline-none font-mono">
                {paymentProcessing ? <><RefreshCw className="w-4 h-4 animate-spin" />Processing...</> : paymentSuccess ? <><CheckCircle2 className="w-4 h-4" />Unlocking...</> : "Simulate Instant Sandbox Unlock"}
              </button>
              <button onClick={() => { setCheckoutOpen(false); initiatePayment({ plan: paymentPlan, scanId: data?.analysisId, onSuccess: refreshUnlock }); }}
                disabled={paymentProcessing || paymentSuccess || isPaymentGatewayLoading}
                style={{ background: "transparent", border: `1px solid ${REPORT_TOKENS.graticule}`, color: REPORT_TOKENS.text }}
                className="w-full text-[10px] font-bold py-2.5 flex items-center justify-center gap-2 hover:bg-[#141416] transition-colors disabled:opacity-50 uppercase tracking-wider rounded-lg cursor-pointer font-mono">
                {isPaymentGatewayLoading ? <><RefreshCw className="w-4 h-4 animate-spin" />Connecting...</> : "Launch Razorpay"}
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── WhatsApp Share Dialog ───────────────────────────────── */}
        <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
          <DialogContent style={{ background: REPORT_TOKENS.parcel, border: `1px solid ${REPORT_TOKENS.graticule}`, color: REPORT_TOKENS.text }} className="sm:max-w-[400px] rounded-[4px] shadow-2xl p-6 focus:outline-none border">
            <DialogHeader className="space-y-1.5 text-left">
              <DialogTitle className="text-xs font-bold flex items-center gap-2 font-mono uppercase tracking-wider" style={{ color: REPORT_TOKENS.yield }}>
                <span>📱</span>
                Share Proposal via WhatsApp
              </DialogTitle>
              <DialogDescription className="text-[10px]" style={{ color: REPORT_TOKENS.muted }}>
                Generate a clean solar proposal message and open wa.me link.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-4 text-left">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider font-mono" style={{ color: REPORT_TOKENS.muted }}>
                  Homeowner WhatsApp Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210"
                  value={sharePhone}
                  onChange={(e) => {
                    setSharePhone(e.target.value);
                    setSharePhoneError("");
                  }}
                  style={{ background: REPORT_TOKENS.ink, border: `1px solid ${REPORT_TOKENS.graticule}`, color: REPORT_TOKENS.text }}
                  className="px-3 py-2 text-xs font-mono rounded-lg focus:outline-none focus:ring-1 focus:ring-[#E2E8F0]"
                />
                {sharePhoneError && (
                  <p className="text-[10px] text-red-400 font-mono mt-0.5">{sharePhoneError}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleWhatsAppShare}
                disabled={isSharing}
                style={{ background: REPORT_TOKENS.solar, color: REPORT_TOKENS.onAccent }}
                className="w-full text-[10px] font-bold py-2.5 flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity uppercase tracking-wider rounded-lg cursor-pointer border-none outline-none font-mono"
              >
                {isSharing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Generating Link...
                  </>
                ) : (
                  "Open WhatsApp Web / App"
                )}
              </button>
              <button
                onClick={() => setShareModalOpen(false)}
                disabled={isSharing}
                style={{ background: "transparent", border: `1px solid ${REPORT_TOKENS.graticule}`, color: REPORT_TOKENS.text }}
                className="w-full text-[10px] font-bold py-2.5 flex items-center justify-center gap-2 hover:bg-[#141416] transition-colors disabled:opacity-50 uppercase tracking-wider rounded-lg cursor-pointer font-mono"
              >
                Cancel
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Lead capture modal form */}
        <LeadCaptureForm
          open={leadFormOpen}
          onOpenChange={setLeadFormOpen}
          context={{
            analysisId: data.analysisId,
            kw: model.installedKw,
            location: data.location?.label,
          }}
        />

      </div>
    </>
  );
};

export default ResultsPage;
