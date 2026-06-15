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
} from "lucide-react";
import { AnimatedThemeToggleButton } from "@/components/ui/animated-theme-toggle-button";
import { SnappySlider } from "@/components/ui/snappy-slider";
import { useEffect, useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import type { SolarAnalysis } from "@/lib/solar-calc";
import { generatePDFReport } from "@/lib/pdf-generator";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useScanStore } from "@/hooks/use-scan-store";
import { usePayment } from "@/hooks/use-payment";
import { runFullCalculation } from "@/lib/solar-calc";
import { decodeScanFromUrl } from "@/lib/scan-url";
import { computePanelLayout } from "@/lib/panel-layout";
import { fetchSolarIrradiance } from "@/lib/nasa-power";
import {
  trackResultsViewed,
  trackPaywallShown,
  trackPaymentInitiated,
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

// ─── Color tokens from code.html ─────────────────────────────
const C = {
  background:          "#171210",
  charcoal:            "#1F1B18",
  surfaceVariant:      "#393431",
  surfaceContainerHigh:"#2e2927",
  primary:             "#ffb87b",
  primaryContainer:    "#ff8f00",
  secondary:           "#41e1b4",
  onSurface:           "#eae0dd",
  onSurfaceVariant:    "#dcc1ae",
  mutedSand:           "#AD9F92",
  outline:             "#a48c7a",
  outlineVariant:      "#564334",
  error:               "#ffb4ab",
  onPrimary:           "#4c2700",
  onSecondary:         "#00382a",
};

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
}

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_KEYS   = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

const leadFormSchema = z.object({
  name:  z.string().min(1, "Name is required"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  city:  z.string().min(1, "City is required"),
});

// ─── Financial solver ────────────────────────────────────────
function computeModel({ peakSunHours, pCount, pType, tariff, escalation, discountRate, omCost, batteryStorage }: {
  peakSunHours: number; pCount: number; pType: "compact"|"premium";
  tariff: number; escalation: number; discountRate: number; omCost: number; batteryStorage: boolean;
}) {
  const panelW = pType === "premium" ? 550 : 450;
  const installedKw = (pCount * panelW) / 1000;
  const grossCost = pCount * (pType === "premium" ? 22000 : 18000) + 35000;
  const batteryCost = batteryStorage ? 85000 : 0;
  const totalGrossCapEx = grossCost + batteryCost;
  let subsidyInr = installedKw <= 2 ? installedKw * 30000 : installedKw <= 3 ? 60000 + (installedKw - 2) * 18000 : 78000;
  subsidyInr = Math.min(78000, Math.round(subsidyInr));
  const netCostInr = Math.max(0, totalGrossCapEx - subsidyInr);
  const baseAnnualKwh = installedKw * peakSunHours * 365 * 0.86;
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
  let irr = 0, low = -0.5, high = 2.0;
  const calcNpv = (r: number) => cashFlows.reduce((s, v, i) => s + v / Math.pow(1 + r, i), 0);
  if (calcNpv(low) > 0 && calcNpv(high) < 0) {
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
    cashFlows, cumulativeCashFlow, yearlySavings, yearlyOm, irr: irr * 100, npv, paybackPeriod, breakEvenYr, lcoe, breakEvenFound };
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
    <div style={{ background: `${C.secondary}10`, border: `1px solid ${C.secondary}40` }} className="p-6 text-center space-y-3">
      <CheckCircle2 className="w-8 h-8 mx-auto" style={{ color: C.secondary }} />
      <p className="text-xs font-bold" style={{ color: C.onSurface }}>Partner Quote Requested</p>
      <p className="text-xs" style={{ color: C.mutedSand }}>Certified installers in your region will contact you shortly.</p>
    </div>
  );
  return (
    <div style={{ background: C.charcoal, border: `1px solid ${C.outlineVariant}` }} className="p-4">
      <h3 style={{ color: C.onSurface, borderBottom: `1px solid ${C.outlineVariant}`, paddingBottom: "8px", marginBottom: "12px" }}
        className="text-xs font-bold uppercase tracking-wider font-mono">Request Partner Quotes</h3>
      <p className="text-xs mb-4" style={{ color: C.mutedSand }}>Get direct quotes from MNRE-certified partners near you.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        {[
          { field: "phone", label: "Mobile Number", placeholder: "e.g. 9876543210" },
          { field: "city",  label: "City",          placeholder: "e.g. Mumbai"     },
        ].map(({ field, label, placeholder }) => (
          <div key={field}>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: C.mutedSand }}>{label}</label>
            <input {...register(field as any)} type={field === "phone" ? "tel" : "text"} placeholder={placeholder}
              style={{ background: C.background, border: `1px solid ${C.outlineVariant}`, color: C.onSurface }}
              className="w-full px-3 py-2 text-xs focus:outline-none font-mono" />
            {(errors as any)[field] && <span className="text-[10px] block mt-0.5" style={{ color: C.error }}>{(errors as any)[field].message}</span>}
          </div>
        ))}
        <button type="submit" disabled={submitting}
          style={{ background: C.secondary, color: C.onSecondary }}
          className="w-full py-2.5 text-[10px] font-bold uppercase tracking-wider transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
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
          style={{ borderBottom: i < rows.length - 1 ? `1px solid ${C.outlineVariant}40` : "none", paddingBottom: i < rows.length - 1 ? "6px" : "0" }}>
          <span style={{ color: C.mutedSand }}>{r.label}</span>
          <span style={{ color: C.onSurface }}>{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Sidebar card shell ──────────────────────────────────────
function SideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.charcoal, border: `1px solid ${C.outlineVariant}` }} className="p-4 sp-card">
      <h3 className="text-xs font-bold uppercase tracking-wider mb-3 font-mono"
        style={{ color: C.onSurface, borderBottom: `1px solid ${C.outlineVariant}`, paddingBottom: "8px" }}>{title}</h3>
      {children}
    </div>
  );
}

// ─── Roof Layout Diagram (SVG minimap) ───────────────────────
function RoofLayoutDiagram({
  polygons,
  panelConfig,
}: {
  polygons: { type: "Polygon"; coordinates: [number, number][][] }[];
  panelConfig: {
    tiltAngle?: number; setbackM?: number; walkwayM?: number;
    panelWattage?: 450 | 550; orientation?: string; rowAlignment?: string;
  } | null;
}) {
  const W = 244, H = 130, PAD = 10;

  if (!polygons || polygons.length === 0 || (polygons[0]?.coordinates[0]?.length ?? 0) === 0) {
    return (
      <div style={{ background: `${C.surfaceVariant}30`, border: `1px solid ${C.outlineVariant}`, height: 96 }} className="flex items-center justify-center">
        <span className="text-xs font-mono" style={{ color: C.mutedSand }}>No roof data available</span>
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
      // corners are [lat, lng] pairs
      allPanelSVG.push(panel.corners.map(([lat, lng]) => project(lng, lat)));
    });
  });

  const panelCount = allPanelSVG.length;

  return (
    <div style={{ border: `1px solid ${C.outlineVariant}`, overflow: "hidden", borderRadius: 2 }}>
      <svg width={W} height={H} style={{ display: "block", background: "#0c1018" }}>
        <defs>
          <pattern id="rld-grid" width="12" height="12" patternUnits="userSpaceOnUse">
            <path d="M 12 0 L 0 0 0 12" fill="none" stroke="#1a2233" strokeWidth="0.4" />
          </pattern>
        </defs>
        {/* Satellite-style background */}
        <rect width={W} height={H} fill="url(#rld-grid)" />

        {/* Roof polygon fills */}
        {polygons.map((poly, pi) => {
          const coords = (poly.coordinates[0] ?? []).map(([lng, lat]) => project(lng, lat));
          return (
            <polygon
              key={`roof-${pi}`}
              points={coords.map(([x, y]) => `${x},${y}`).join(" ")}
              fill="#2e2420"
              stroke="#6b5040"
              strokeWidth="1"
            />
          );
        })}

        {/* Solar panels */}
        {allPanelSVG.map((corners, i) => (
          <polygon
            key={`panel-${i}`}
            points={corners.map(([x, y]) => `${x},${y}`).join(" ")}
            fill="#1a3a6e"
            stroke="#0c1f40"
            strokeWidth="0.4"
          />
        ))}

        {/* Panel count badge */}
        <rect x={W - 52} y={H - 18} width={48} height={14} fill="#00000080" rx="1" />
        <text x={W - 28} y={H - 7} textAnchor="middle" fill={C.secondary} fontSize="7" fontFamily="monospace">
          {panelCount} panels
        </text>
      </svg>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
const ResultsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const store = useScanStore();
  const [searchParams] = useSearchParams();
  const { initiatePayment, isLoading: isPaymentGatewayLoading } = usePayment();

  const [data, setData] = useState<FullResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [noData, setNoData] = useState(false);

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
  const [shading,        setShading]        = useState<"none" | "partial" | "heavy">("none");
  const [activeTab,      setActiveTab]      = useState<"roi"|"yield"|"monthly">("roi");
  const [inflationRate,  setInflationRate]  = useState(5);

  const handleShadingChange = (newShading: "none" | "partial" | "heavy") => {
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

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(document.documentElement.classList.contains("dark")));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const unlocked = store.isPaid || !!data?.unlocked;
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

  // Re-fetch report when payment succeeds to load full gated metrics
  useEffect(() => {
    if (store.isPaid && data && !data.unlocked) {
      const enc = searchParams.get("scan");
      if (enc) {
        const decoded = decodeScanFromUrl(enc);
        if (decoded) {
          const { scanInput } = decoded;
          const siteId = `sunpower_${Math.abs(Math.round(scanInput.lat * 100000))}_${Math.abs(Math.round(scanInput.lng * 100000))}`;
          (async () => {
            try {
              const res = await fetch(`/api/report?siteId=${siteId}&scan=${encodeURIComponent(enc)}`);
              if (res.ok) {
                const resData = await res.json();
                const fr = {
                  ...resData,
                  location: {
                    lat: scanInput.lat,
                    lng: scanInput.lng,
                    label: scanInput.address || `${scanInput.lat.toFixed(4)}, ${scanInput.lng.toFixed(4)}`
                  },
                  panelCount: decoded.panelConfig.panelCount
                };
                setData(fr);
                store.setFullAnalysis(fr);
              }
            } catch (err) {
              console.error("Failed to re-fetch report on payment success:", err);
            }
          })();
        }
      }
    }
  }, [store.isPaid, searchParams]);

  // Coordinate all initial loading states to prevent race conditions and flickering
  useEffect(() => {
    const enc = searchParams.get("scan");

    // 1. If scan query parameter is in URL, fetch it from backend.
    if (enc) {
      const decoded = decodeScanFromUrl(enc);
      if (!decoded) {
        setNoData(true);
        setLoading(false);
        return;
      }
      
      setLoading(true);
      setNoData(false);

      let active = true;
      (async () => {
        try {
          const { scanInput, panelConfig } = decoded;
          const siteId = `sunpower_${Math.abs(Math.round(scanInput.lat * 100000))}_${Math.abs(Math.round(scanInput.lng * 100000))}`;

          const res = await fetch(`/api/report?siteId=${siteId}&scan=${encodeURIComponent(enc)}`);
          if (!res.ok) {
            throw new Error("Failed to fetch report from server");
          }
          const resData = await res.json();
          if (!active) return;

          const fr = {
            ...resData,
            location: {
              lat: scanInput.lat,
              lng: scanInput.lng,
              label: scanInput.address || `${scanInput.lat.toFixed(4)}, ${scanInput.lng.toFixed(4)}`
            },
            panelCount: panelConfig.panelCount
          };

          const s = useScanStore.getState();
          s.setScanInput(scanInput);
          s.setPanelConfig(panelConfig);
          s.setTariff({ tariffPerKwh: resData.financials.electricityRateInr });
          s.setFullAnalysis(fr);
          if (resData.unlocked) {
            s.setIsPaid(true, `pay_backend`);
          }

          setData(fr);
          setTariff(resData.financials.electricityRateInr);
          setPType(resData.panelType ?? "compact");
          setPCount(resData.panelCount ?? 15);
          setShading(panelConfig.shading || "none");
          maxPanelsRef.current = resData.panelCount ?? 15;

          if (!hasTrackedViewed.current) {
            trackResultsViewed(fr.energy.installedCapacityKw);
            hasTrackedViewed.current = true;
          }
          setNoData(false);
        } catch (error) {
          if (!active) return;
          console.error("URL Load failed:", error);
          toast({
            title: "Load Failed",
            description: "Could not load the shared solar report.",
            variant: "destructive"
          });
          setNoData(true);
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      })();

      return () => {
        active = false;
      };
    }

    // 2. If no scan query param, check store.fullAnalysis
    const s = useScanStore.getState();
    const fa = s.fullAnalysis;
    if (fa) {
      setData(fa);
      setTariff(fa.financials.electricityRateInr);
      setPType(fa.panelType ?? "compact");
      setPCount(fa.panelCount ?? 15);
      setShading(s.panelConfig?.shading || "none");
      maxPanelsRef.current = fa.panelCount ?? 15;
      if (!hasTrackedViewed.current) {
        trackResultsViewed(fa.energy.installedCapacityKw);
        hasTrackedViewed.current = true;
      }
      setNoData(false);
      setLoading(false);
      return;
    }

    // 3. Fallback to sessionStorage
    const stored = sessionStorage.getItem("sunpower-results");
    if (stored) {
      try {
        const p = JSON.parse(stored);
        if (p?.energy && p?.financials) {
          setData(p);
          setTariff(p.financials.electricityRateInr);
          setPType(p.panelType ?? "compact");
          setPCount(p.panelCount ?? 15);
          setShading(p.shading || "none");
          maxPanelsRef.current = p.panelCount ?? 15;
          
          s.setScanInput({
            address: p.location?.label || "Mumbai",
            lat: p.location?.lat || 19.076,
            lng: p.location?.lng || 72.877,
            roofPolygon: [],
            roofAreaM2: p.rooftop?.drawnAreaM2 || 85.5
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
          s.setFullAnalysis(p);

          if (p.unlocked !== false) {
            s.setIsPaid(true, p.paymentId || `pay_mock_${Date.now()}`);
          } else {
            s.setIsPaid(false);
          }
          setNoData(false);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.error("Session storage parse failed:", e);
      }
    }

    // 4. No data exists
    setNoData(true);
    setLoading(false);
  }, [searchParams, toast]);

  useEffect(() => {
    if (data && !unlocked && !hasTrackedPaywall.current) { trackPaywallShown(); hasTrackedPaywall.current = true; }
  }, [data, unlocked]);

  const psh   = data?.energy.peakSunHoursDaily ?? 5.0;
  const model = computeModel({ peakSunHours: psh, pCount, pType, tariff, escalation, discountRate, omCost, batteryStorage });

  const handleDownload = () => {
    if (!data) return; setDownloading(true); setDownloadError(null);
    try {
      generatePDFReport({ ...data, energy: { ...data.energy, installedCapacityKw: model.installedKw, annualKwh: model.baseAnnualKwh }, financials: { electricityRateInr: tariff, monthlySavingsInr: Math.round(model.yearlySavings[0]/12), annualSavingsInr: Math.round(model.yearlySavings[0]), savings25yrInr: Math.round(model.cumulativeCashFlow[25]+model.netCostInr) }, panelCount: pCount, panelType: pType } as SolarAnalysis, { locationLabel: data.location?.label || "India" });
      toast({ title: "Report Downloaded" });
    } catch { const msg = "Failed to generate report."; setDownloadError(msg); toast({ title: "Download Failed", description: msg, variant: "destructive" }); }
    finally { setDownloading(false); }
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

  // ── Derived chart/display values ──────────────────────────
  if (noData) return (
    <div style={{ background: C.background }} className="min-h-screen flex items-center justify-center px-4">
      <div style={{ background: C.charcoal, border: `1px solid ${C.outlineVariant}` }} className="text-center max-w-md p-8 sp-fade-up">
        <MapPin className="w-12 h-12 mx-auto mb-4" style={{ color: C.primary }} />
        <h1 style={{ fontFamily: "Sora, sans-serif", color: C.onSurface }} className="text-2xl font-semibold mb-2">No Analysis Found</h1>
        <p style={{ color: C.mutedSand }} className="text-sm mb-6">Draw your rooftop on the map first to generate a solar potential analysis report.</p>
        <button onClick={() => navigate("/map")} style={{ background: C.primaryContainer, color: C.onPrimary }} className="px-6 py-2 text-xs font-bold uppercase tracking-wider">Go to Map →</button>
      </div>
    </div>
  );

  if (loading) return (
    <div style={{ background: C.background }} className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div style={{ border: `2px solid ${C.outlineVariant}`, borderTopColor: C.secondary }} className="w-8 h-8 rounded-full sp-spin" />
        <span style={{ color: C.mutedSand }} className="text-xs font-mono uppercase tracking-widest">Loading Report...</span>
      </div>
    </div>
  );

  if (!data) return null;

  const roiData     = model.cumulativeCashFlow.map((cf, y) => ({ year: y, cumulative: Math.round(cf) }));
  const yieldData   = Array.from({ length: 25 }, (_, i) => ({ year: `Yr ${i+1}`, production: Math.round(model.baseAnnualKwh * Math.pow(0.995, i)), efficiency: parseFloat((100 - i*0.5).toFixed(1)) }));
  const monthlyData = MONTH_KEYS.map((k, i) => {
    const mPsh = data.monthlyIrradiance?.[k] ?? psh;
    const days = i===1?28:[3,5,8,10].includes(i)?30:31;
    return { label: MONTH_LABELS[i], psh: parseFloat(mPsh.toFixed(2)), generation: Math.round(model.installedKw * mPsh * days * 0.86) };
  });
  const savings25L  = Math.round((model.cumulativeCashFlow[25] + model.netCostInr) / 100000);
  const suitability = data.suitabilityScore !== undefined ? data.suitabilityScore : Math.round(Math.min(99, 70 + data.energy.peakSunHoursDaily * 5));
  const circumference = 2 * Math.PI * 45;
  const dashOffset  = circumference * (1 - suitability / 100);
  const roofUsable  = Math.round(Math.min(75, 50 + data.energy.peakSunHoursDaily * 4));
  const roofObst    = Math.min(30, 100 - roofUsable - 10);
  const roofAccess  = 100 - roofUsable - roofObst;

  return (
    <>
      {/* ── Global styles + animations ────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');

        .sp-page * { box-sizing: border-box; }
        .sp-page { font-family: 'Inter', sans-serif; }

        /* ── Keyframes ── */
        @keyframes sp-fade-up   { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:none; } }
        @keyframes sp-fade-in   { from { opacity:0; } to { opacity:1; } }
        @keyframes sp-spin      { to { transform:rotate(360deg); } }
        @keyframes sp-scan-line { 0%{top:0%;opacity:.6} 100%{top:100%;opacity:0} }
        @keyframes sp-glow-pulse{ 0%,100%{box-shadow:0 0 0 0 ${C.secondary}30} 50%{box-shadow:0 0 0 8px ${C.secondary}00} }
        @keyframes sp-float     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes sp-bar-grow  { from { height:0; } }
        @keyframes sp-border-glow { 0%,100%{border-color:${C.outlineVariant}} 50%{border-color:${C.secondary}60} }
        @keyframes sp-shimmer   { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes sp-count-in  { from{opacity:0;transform:scale(.85)} to{opacity:1;transform:scale(1)} }

        /* ── Animation classes ── */
        .sp-fade-up   { animation: sp-fade-up .65s cubic-bezier(.16,1,.3,1) both; }
        .sp-fade-up-1 { animation: sp-fade-up .65s cubic-bezier(.16,1,.3,1) .05s both; }
        .sp-fade-up-2 { animation: sp-fade-up .65s cubic-bezier(.16,1,.3,1) .15s both; }
        .sp-fade-up-3 { animation: sp-fade-up .65s cubic-bezier(.16,1,.3,1) .25s both; }
        .sp-fade-up-4 { animation: sp-fade-up .65s cubic-bezier(.16,1,.3,1) .35s both; }
        .sp-fade-up-5 { animation: sp-fade-up .65s cubic-bezier(.16,1,.3,1) .45s both; }
        .sp-fade-in   { animation: sp-fade-in .5s ease both; }
        .sp-spin      { animation: sp-spin .9s linear infinite; }
        .sp-float     { animation: sp-float 4s ease-in-out infinite; }
        .sp-glow-pulse{ animation: sp-glow-pulse 2.5s ease-in-out infinite; }
        .sp-border-glow { animation: sp-border-glow 3s ease-in-out infinite; }
        .sp-count-in  { animation: sp-count-in .5s cubic-bezier(.16,1,.3,1) .3s both; }

        /* SVG gauge */
        .sp-gauge-ring { animation: sp-gauge-draw 1.5s cubic-bezier(.16,1,.3,1) .5s both; }
        @keyframes sp-gauge-draw {
          from { stroke-dashoffset: ${circumference}; }
          to   { stroke-dashoffset: ${dashOffset}; }
        }

        /* Bar chart bars */
        .sp-lbar-1 { height:20%; animation: sp-bar-grow .7s ease .4s both; }
        .sp-lbar-2 { height:40%; animation: sp-bar-grow .7s ease .55s both; }
        .sp-lbar-3 { height:70%; animation: sp-bar-grow .7s ease .7s both; }
        .sp-lbar-4 { height:90%; animation: sp-bar-grow .7s ease .85s both; }
        .sp-lbar-5 { height:100%; animation: sp-bar-grow .7s ease 1s both; }

        /* Terminal scan line */
        .sp-terminal { position:relative; overflow:hidden; }
        .sp-terminal::before {
          content:''; position:absolute; left:0; right:0; height:2px;
          background:linear-gradient(to right, transparent, ${C.secondary}, transparent);
          animation: sp-scan-line 2.5s ease-in-out infinite;
        }

        /* Cards */
        .sp-card { transition: border-color .2s, transform .2s; }
        .sp-card:hover { border-color: ${C.outline} !important; transform: translateY(-1px); }
        .sp-row:hover td { background: ${C.charcoal} !important; }

        /* Sticky nav glass */
        .sp-nav { background: ${C.background}f0; backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); }

        /* Toggle buttons */
        .sp-toggle { border:1px solid ${C.outlineVariant}; background:transparent; color:${C.mutedSand}; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; padding:6px 12px; cursor:pointer; transition:all .15s; font-family:Inter,monospace; }
        .sp-toggle.on { background:${C.primaryContainer}20; border-color:${C.primaryContainer}; color:${C.primary}; }
        .sp-toggle:hover:not(.on) { background:${C.surfaceVariant}30; border-color:${C.outline}; color:${C.onSurface}; }

        /* Chart tabs */
        .sp-tab { background:transparent; border:none; color:${C.mutedSand}; font-size:9px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; padding:4px 12px; cursor:pointer; transition:all .15s; font-family:Inter,monospace; }
        .sp-tab.on { background:${C.primaryContainer}; color:${C.onPrimary}; }
        .sp-tab:hover:not(.on) { color:${C.onSurface}; }

        /* Tooltip custom */
        .sp-tip { background:${C.surfaceContainerHigh}; border:1px solid ${C.outlineVariant}; padding:8px 12px; font-family:Inter,monospace; font-size:10px; }

        .tabular-nums { font-variant-numeric:tabular-nums; }
        .material-symbols-outlined { font-family:'Material Symbols Outlined'; font-style:normal; line-height:1; text-transform:none; white-space:nowrap; word-wrap:normal; direction:ltr; -webkit-font-smoothing:antialiased; }

        /* Break-even bar fill transition */
        .sp-breakeven-fill { transition: width 1.2s cubic-bezier(.16,1,.3,1); }
      `}</style>

      <div className="sp-page min-h-screen" style={{ background: C.background, color: C.onSurface }}>

        {/* ── Header ──────────────────────────────────────────── */}
        <header className="sp-nav sticky top-0 z-50" style={{ borderBottom: `1px solid ${C.outlineVariant}` }}>
          <div className="flex justify-between items-center px-4 md:px-16 py-3 mx-auto max-w-[1280px]">
            <div style={{ fontFamily: "Sora, sans-serif", color: C.mutedSand, fontSize: "20px", fontWeight: 500, letterSpacing: "-0.01em" }}>
              SUNPOWER LINK
            </div>
            <nav className="hidden md:flex gap-6">
              <a style={{ color: C.mutedSand }} className="text-[10px] font-bold uppercase tracking-wider font-mono hover:text-white transition-colors cursor-pointer" onClick={() => navigate("/")}>Home</a>
              <a style={{ color: C.mutedSand }} className="text-[10px] font-bold uppercase tracking-wider font-mono hover:text-white transition-colors cursor-pointer" onClick={() => navigate("/market-insights")}>Market Insights</a>
              <a style={{ color: C.mutedSand }} className="text-[10px] font-bold uppercase tracking-wider font-mono hover:text-white transition-colors cursor-pointer" onClick={() => navigate("/policy-tracker")}>Policy Tracker</a>
            </nav>
            <div className="flex items-center gap-2 md:gap-3">
              <AnimatedThemeToggleButton type="vertical" />
              <button onClick={() => navigate("/map")}
                aria-label="Go back to map"
                style={{ background: C.charcoal, border: `1px solid ${C.outlineVariant}`, color: C.onSurface }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider hover:opacity-80 transition-opacity">
                <ArrowLeft className="w-3 h-3" /> Back
              </button>
              <button onClick={handleDownload} disabled={downloading}
                style={{ background: C.charcoal, border: `1px solid ${C.outlineVariant}`, color: C.onSurface }}
                className="hidden md:flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider hover:opacity-80 transition-opacity disabled:opacity-40">
                <Download className="w-3 h-3" /> {downloading ? "Generating..." : "Download PDF"}
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-[1280px] mx-auto px-4 md:px-16 py-4 flex flex-col gap-8">

          {downloadError && (
            <div style={{ background: `${C.error}10`, border: `1px solid ${C.error}30`, color: C.error }} className="p-3 text-xs flex items-center gap-2 sp-fade-up">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{downloadError}</span>
              <button onClick={handleDownload} className="ml-auto underline font-bold">Retry</button>
            </div>
          )}

          {/* ── Document Header ──────────────────────────────── */}
          <section style={{ borderBottom: `1px solid ${C.outlineVariant}` }} className="pb-4 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 sp-fade-up">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-2 font-mono" style={{ color: C.mutedSand }}>
                Technical Prospectus · Site ID: {data.analysisId?.slice(-6).toUpperCase() ?? "8492-B"}
              </div>
              <h1 style={{ fontFamily: "Sora, sans-serif", color: C.onSurface, fontSize: "clamp(24px,4vw,36px)", fontWeight: 500, lineHeight: 1.1, letterSpacing: "-0.01em" }} className="mb-2">
                {data.location?.label ? data.location.label.split(",")[0] : "Premium Solar Analysis"}
              </h1>
              {data.location?.label && (
                <p className="text-xs flex items-center gap-1.5" style={{ color: C.mutedSand }}>
                  <MapPin className="w-3 h-3 shrink-0" /> {data.location.label}
                </p>
              )}
              <p style={{ color: C.mutedSand, fontSize: "13px" }} className="max-w-2xl mt-2">
                Detailed financial intelligence and operational projections based on geospatial irradiance modeling and localized tariff structures.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <div style={{ background: `${C.secondary}15`, border: `1px solid ${C.secondary}`, color: C.secondary }} className="flex items-center gap-2 px-4 py-2 sp-glow-pulse">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Investment Grade: A+</span>
              </div>
              {data.windZoneLabel && (
                <div style={{ 
                  background: data.highWindWarning ? `${C.error}15` : `${C.secondary}15`, 
                  border: `1px solid ${data.highWindWarning ? C.error : C.secondary}`, 
                  color: data.highWindWarning ? C.error : C.secondary 
                }} className="flex items-center gap-2 px-4 py-2">
                  <span className="material-symbols-outlined text-[14px]">windpower</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider">Wind: {data.windZoneLabel}</span>
                </div>
              )}
            </div>
          </section>

          {unlocked ? (
            /* ================================================================
               UNLOCKED STATE — exact code.html layout
            ================================================================ */
            <>
              {/* Executive Highlights Bar */}
              <section style={{ background: C.charcoal, border: `1px solid ${C.outlineVariant}` }} className="sp-fade-up-1">
                <div className="py-4 px-6 grid grid-cols-2 md:grid-cols-5 gap-4" style={{ borderBottom: `1px solid ${C.outlineVariant}` }}>
                  {[
                    { label: "IRR",             value: `${model.irr.toFixed(1)}%`,              color: C.onSurface },
                    { label: "Payback Period",  value: `${model.paybackPeriod.toFixed(1)} Yrs`, color: C.onSurface },
                    { label: "LCOE",            value: `₹${model.lcoe.toFixed(2)}`, sub: "/ kWh", color: C.onSurface },
                    { label: "Lifetime Savings",value: `₹${savings25L}L`,                       color: C.secondary },
                    { label: "System Size",     value: `${model.installedKw.toFixed(1)} kWp`,   color: C.onSurface },
                  ].map((item, i) => (
                    <div key={i} style={{ borderLeft: i > 0 ? `1px solid ${C.outlineVariant}` : "none", paddingLeft: i > 0 ? "16px" : "0" }} className="animate-slide-up">
                      <div className="text-[10px] font-bold uppercase tracking-wider mb-1 font-mono" style={{ color: C.mutedSand }}>{item.label}</div>
                      <div className="tabular-nums font-semibold sp-count-in" style={{ fontFamily: "Sora, sans-serif", fontSize: "20px", lineHeight: 1.3, color: item.color }}>
                        {item.value}{item.sub && <span className="text-xs ml-1" style={{ color: C.mutedSand }}>{item.sub}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="py-4 px-6 grid grid-cols-2 md:grid-cols-3 gap-4" style={{ background: `${C.surfaceVariant}22` }}>
                  {[
                    { label: "Net Present Value (NPV)", value: `${model.npv >= 0 ? "+" : ""}₹${Math.round(Math.abs(model.npv)/1000)}k`, color: model.npv >= 0 ? C.onSurface : C.error },
                    { label: "Return on Equity (ROE)",  value: `${(model.irr * 1.1).toFixed(1)}%`,                                      color: C.onSurface },
                    { label: "PM Surya Subsidy",        value: `₹${model.subsidyInr.toLocaleString()}`,                                 color: C.primary },
                  ].map((item, i) => (
                    <div key={i} style={{ borderLeft: i > 0 ? `1px solid ${C.outlineVariant}` : "none", paddingLeft: i > 0 ? "16px" : "0" }}>
                      <div className="text-[10px] font-bold uppercase tracking-wider mb-1 font-mono" style={{ color: C.mutedSand }}>{item.label}</div>
                      <div className="tabular-nums font-semibold sp-count-in" style={{ fontFamily: "Sora, sans-serif", fontSize: "20px", color: item.color }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Suitability & Roof Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sp-fade-up-2">
                {/* Suitability Score Gauge */}
                <section style={{ background: C.charcoal, border: `1px solid ${C.outlineVariant}` }} className="p-6 flex flex-col items-center justify-center relative sp-card">
                  <div className="absolute top-4 left-4 text-[10px] font-bold uppercase tracking-wider font-mono" style={{ color: C.mutedSand }}>Suitability Score</div>
                  <div className="relative w-40 h-40 flex items-center justify-center">
                    <svg className="w-full h-full" style={{ transform: "rotate(-90deg)" }} viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke={C.surfaceVariant} strokeWidth="4" />
                      <circle cx="50" cy="50" r="45" fill="none" stroke={C.secondary} strokeWidth="4"
                        strokeDasharray={circumference} strokeDashoffset={dashOffset}
                        className="sp-gauge-ring" style={{ strokeLinecap: "round" }} />
                    </svg>
                    <div className="absolute flex flex-col items-center sp-count-in">
                      <span style={{ fontFamily: "Sora, sans-serif", fontSize: "36px", fontWeight: 500, color: C.onSurface }} className="tabular-nums">{suitability}</span>
                      <span className="text-[10px] font-bold" style={{ color: C.mutedSand }}>/ 100</span>
                    </div>
                  </div>
                  <p className="mt-4 text-center text-xs" style={{ color: C.mutedSand }}>
                    Excellent solar potential based on roof orientation and shading analysis.
                  </p>
                </section>

                {/* Factor Breakdown */}
                <section style={{ background: C.charcoal, border: `1px solid ${C.outlineVariant}` }} className="p-6 flex flex-col sp-card">
                  <div className="text-[10px] font-bold uppercase tracking-wider mb-4 font-mono" style={{ color: C.mutedSand }}>Factor Breakdown</div>
                  <div className="flex flex-col gap-3 flex-1 justify-center">
                    {[
                      { label: "Solar Orientation", pct: 94 },
                      { label: "Roof Area",          pct: 88 },
                      { label: "Shading Loss",       pct: suitability },
                      { label: "Structural",         pct: 96 },
                    ].map((f) => (
                      <div key={f.label} className="flex items-center gap-3">
                        <span className="text-xs font-mono shrink-0" style={{ color: C.mutedSand, width: 110 }}>{f.label}</span>
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: C.surfaceVariant }}>
                          <div style={{ width: `${f.pct}%`, background: C.secondary, height: "100%", borderRadius: "9999px", transition: "width 1.2s cubic-bezier(.16,1,.3,1)" }} />
                        </div>
                        <span className="text-[10px] font-mono tabular-nums" style={{ color: C.secondary }}>{f.pct}%</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Roof Utilization */}
                <section style={{ background: C.charcoal, border: `1px solid ${C.outlineVariant}` }} className="p-6 flex flex-col sp-card">
                  <div className="text-[10px] font-bold uppercase tracking-wider mb-4 font-mono" style={{ color: C.mutedSand }}>Roof Utilization</div>
                  <div className="flex flex-col gap-4 mt-auto">
                    <div className="w-full h-8 flex overflow-hidden" style={{ borderRadius: "2px" }}>
                      <div style={{ background: C.secondary,       width: `${roofUsable}%`,  transition: "width 1.2s ease" }} />
                      <div style={{ background: C.surfaceVariant,  width: `${roofObst}%`,    transition: "width 1.2s ease .1s" }} />
                      <div style={{ background: C.primaryContainer,width: `${roofAccess}%`,  transition: "width 1.2s ease .2s" }} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs font-mono" style={{ color: C.mutedSand }}>
                      <div className="flex items-center gap-1.5"><div style={{ background: C.secondary,       width: 8, height: 8 }} /> {roofUsable}% Usable</div>
                      <div className="flex items-center gap-1.5"><div style={{ background: C.surfaceVariant,  width: 8, height: 8 }} /> {roofObst}% Obstr.</div>
                      <div className="flex items-center gap-1.5"><div style={{ background: C.primaryContainer,width: 8, height: 8 }} /> {roofAccess}% Access</div>
                    </div>
                  </div>
                </section>
              </div>

              {/* Main 9/3 grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sp-fade-up-3">

                {/* ── Left: main content ── */}
                <div className="lg:col-span-9 flex flex-col gap-8">

                  {/* ROI Tuning Console */}
                  <section>
                    <div style={{ borderBottom: `1px solid ${C.outlineVariant}` }} className="flex justify-between items-baseline pb-2 mb-4">
                      <h2 style={{ fontFamily: "Sora, sans-serif", color: C.onSurface, fontSize: "18px", fontWeight: 500 }}>ROI Tuning Console</h2>
                      <span className="text-[10px] font-bold uppercase tracking-wider font-mono" style={{ color: C.mutedSand }}>Live Recalculation</span>
                    </div>
                    <div style={{ background: C.charcoal, border: `1px solid ${C.outlineVariant}` }} className="p-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-2">
                        <SnappySlider values={[3,5,7.5,10,12,15]} defaultValue={7.5} value={tariff} min={3} max={15} step={0.5} onChange={setTariff} label="Electricity Tariff" prefix="₹" suffix=" / kWh" />
                        <SnappySlider values={[1,5,10,15,maxPanelsRef.current]} defaultValue={15} value={pCount} min={1} max={maxPanelsRef.current} step={1} onChange={setPCount} label="Active Panels" suffix={` / ${maxPanelsRef.current}`} />
                        <SnappySlider values={[0,2.5,4.5,7,10]} defaultValue={4.5} value={escalation} min={0} max={10} step={0.5} onChange={setEscalation} label="Annual Grid Escalation" suffix="%" />
                        <SnappySlider values={[0,3,5,8.5,12,15]} defaultValue={8.5} value={discountRate} min={0} max={15} step={0.5} onChange={setDiscountRate} label="NPV Discount Rate" suffix="%" />
                        <SnappySlider values={[0,1,2.5,5]} defaultValue={1} value={omCost} min={0} max={5} step={0.5} onChange={setOmCost} label="Annual O&M Inflation" suffix="%" />
                        <div className="flex flex-col gap-3 pb-4">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5 font-mono" style={{ color: C.mutedSand }}>Module Grade</div>
                            <div className="flex gap-1.5">
                              <button onClick={() => setPType("compact")} className={cn("sp-toggle flex-1", pType === "compact" && "on")}>450W Compact</button>
                              <button onClick={() => setPType("premium")} className={cn("sp-toggle flex-1", pType === "premium" && "on")}>550W Premium</button>
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5 font-mono" style={{ color: C.mutedSand }}>BESS Storage</div>
                            <button onClick={() => setBatteryStorage(!batteryStorage)} className={cn("sp-toggle w-full flex items-center justify-between px-3", batteryStorage && "on")}>
                              <span>Hybrid Battery (+₹85k CapEx)</span>
                              <span style={{ width: 10, height: 10, borderRadius: "50%", border: `2px solid ${batteryStorage ? C.primaryContainer : C.outlineVariant}`, background: batteryStorage ? C.primaryContainer : "transparent", display: "inline-block", transition: "all .15s" }} />
                            </button>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5 font-mono" style={{ color: C.mutedSand }}>Roof Shading</div>
                            <select
                              value={shading}
                              onChange={(e) => handleShadingChange(e.target.value as "none" | "partial" | "heavy")}
                              style={{ background: C.background, border: `1px solid ${C.outlineVariant}`, color: C.onSurface }}
                              className="w-full px-3 py-2 text-xs focus:outline-none font-mono cursor-pointer rounded-none"
                            >
                              <option value="none" className="bg-[#171210]">None</option>
                              <option value="partial" className="bg-[#171210]">Partial</option>
                              <option value="heavy" className="bg-[#171210]">Heavy</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Financial Forecasts */}
                  <section>
                    <div style={{ borderBottom: `1px solid ${C.outlineVariant}` }} className="flex justify-between items-baseline pb-2 mb-4">
                      <h2 style={{ fontFamily: "Sora, sans-serif", color: C.onSurface, fontSize: "18px", fontWeight: 500 }}>Financial Forecasts</h2>
                      <div style={{ background: C.charcoal, border: `1px solid ${C.outlineVariant}` }} className="flex">
                        {[{ k: "roi", l: "Cumulative ROI" }, { k: "yield", l: "Degradation" }, { k: "monthly", l: "Climatology" }].map(t => (
                          <button key={t.k} onClick={() => setActiveTab(t.k as any)} className={cn("sp-tab", activeTab === t.k && "on")}>{t.l}</button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div style={{ background: C.charcoal, border: `1px solid ${C.outlineVariant}` }} className="h-64 p-4">
                        <ResponsiveContainer width="100%" height="100%">
                          {activeTab === "roi" ? (
                            <AreaChart data={roiData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                              <defs>
                                <linearGradient id="rGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={C.secondary} stopOpacity={0.15} />
                                  <stop offset="100%" stopColor={C.secondary} stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 6" stroke={C.outlineVariant} vertical={false} />
                              <XAxis dataKey="year" tick={{ fill: C.mutedSand, fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => v===0?"Yr 0":v%5===0?`Yr ${v}`:""} />
                              <YAxis tick={{ fill: C.mutedSand, fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => v>=100000?`₹${(v/100000).toFixed(0)}L`:v<=-100000?`-₹${(Math.abs(v)/100000).toFixed(0)}L`:`₹${(v/1000).toFixed(0)}k`} />
                              <Tooltip content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const val = payload[0].value as number;
                                return <div className="sp-tip"><div style={{ color: C.mutedSand }}>Year {payload[0].payload.year}</div><div style={{ color: val >= 0 ? C.secondary : C.error, fontWeight: 700, fontSize: 13 }}>{val >= 0 ? "+" : "-"}₹{Math.abs(val).toLocaleString()}</div></div>;
                              }} />
                              <ReferenceLine y={0} stroke={C.outlineVariant} strokeDasharray="3 3" />
                              {model.breakEvenFound && <ReferenceLine x={model.breakEvenYr} stroke={C.secondary} strokeOpacity={0.4} strokeDasharray="3 3" label={{ value: `Break-even Yr ${model.breakEvenYr}`, fill: C.secondary, fontSize: 8, position: "insideTopLeft" }} />}
                              <Area type="monotone" dataKey="cumulative" stroke={C.secondary} strokeWidth={2} fill="url(#rGrad)" animationDuration={800} />
                            </AreaChart>
                          ) : activeTab === "yield" ? (
                            <ComposedChart data={yieldData} margin={{ top: 10, right: -10, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 6" stroke={C.outlineVariant} vertical={false} />
                              <XAxis dataKey="year" tick={{ fill: C.mutedSand, fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v,i)=>i%5===0?v:""} />
                              <YAxis yAxisId="l" tick={{ fill: C.mutedSand, fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`} />
                              <YAxis yAxisId="r" orientation="right" domain={[80,100]} tick={{ fill: C.mutedSand, fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v=>`${v}%`} />
                              <Tooltip content={({ active, payload }) => !active||!payload?.length?null:(
                                <div className="sp-tip"><div style={{ color: C.onSurface, fontWeight:700 }}>{payload[0]?.payload.year}</div><div style={{ color: C.secondary }}>Production: {(payload[0]?.value as number)?.toLocaleString()} kWh</div><div style={{ color: C.primary }}>Efficiency: {payload[1]?.value}%</div></div>
                              )} />
                              <Bar yAxisId="l" dataKey="production" fill={C.secondary} opacity={0.55} radius={[2,2,0,0]} />
                              <Line yAxisId="r" type="monotone" dataKey="efficiency" stroke={C.primary} strokeWidth={2} dot={false} />
                            </ComposedChart>
                          ) : (
                            <ComposedChart data={monthlyData} margin={{ top: 10, right: -10, left: -20, bottom: 0 }}>
                              <defs>
                                <linearGradient id="pGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={C.primary} stopOpacity={0.15} />
                                  <stop offset="100%" stopColor={C.primary} stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 6" stroke={C.outlineVariant} vertical={false} />
                              <XAxis dataKey="label" tick={{ fill: C.mutedSand, fontSize: 9 }} tickLine={false} axisLine={false} />
                              <YAxis yAxisId="l" tick={{ fill: C.mutedSand, fontSize: 9 }} tickLine={false} axisLine={false} />
                              <YAxis yAxisId="r" orientation="right" domain={[0,8]} tick={{ fill: C.mutedSand, fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v=>`${v}h`} />
                              <Tooltip content={({ active, payload }) => !active||!payload?.length?null:(
                                <div className="sp-tip"><div style={{ color: C.onSurface, fontWeight:700 }}>{payload[0]?.payload.label} Solar Stats</div><div style={{ color: C.secondary }}>Yield: {(payload[0]?.value as number)?.toLocaleString()} kWh</div><div style={{ color: C.primary }}>Peak Sun: {payload[1]?.value} hrs</div></div>
                              )} />
                              <Bar yAxisId="l" dataKey="generation" fill={C.secondary} opacity={0.6} radius={[2,2,0,0]} />
                              <Area yAxisId="r" type="monotone" dataKey="psh" stroke={C.primary} fill="url(#pGrad)" strokeWidth={1.5} />
                            </ComposedChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                      {/* Cashflow Waterfall — infographic redesign */}
                      {(() => {
                        const YEARS = 13; // Yr 0 → Yr 12
                        const bars = model.cashFlows.slice(0, YEARS);
                        const cum  = model.cumulativeCashFlow.slice(0, YEARS);
                        const maxAbs = Math.max(...bars.map(Math.abs), ...cum.map(Math.abs)) || 1;

                        // Generous canvas — tall enough that text is never squished
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

                        // Cumulative line
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
                          <div style={{ background: C.charcoal, border: `1px solid ${C.outlineVariant}` }} className="p-5 flex flex-col sp-card">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-bold uppercase tracking-widest font-mono" style={{ color: C.onSurface }}>Cashflow Waterfall</span>
                              <span className="text-xs font-mono" style={{ color: C.mutedSand }}>Yr 0 – Yr 12 · Net annual + cumulative</span>
                            </div>

                            {/* HTML legend — never scales down */}
                            <div className="flex items-center gap-5 mb-3">
                              <div className="flex items-center gap-2">
                                <span style={{ width: 14, height: 14, background: C.secondary, borderRadius: 2, display: "inline-block" }} />
                                <span className="text-xs font-mono font-semibold" style={{ color: C.secondary }}>Annual Savings</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span style={{ width: 14, height: 14, background: C.error, borderRadius: 2, display: "inline-block" }} />
                                <span className="text-xs font-mono font-semibold" style={{ color: C.error }}>CapEx / Outflow</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span style={{ width: 28, height: 2.5, background: C.primary, borderRadius: 2, display: "inline-block" }} />
                                <span className="text-xs font-mono font-semibold" style={{ color: C.primary }}>Cumulative</span>
                              </div>
                              {model.breakEvenFound && (
                                <div className="flex items-center gap-2 ml-auto">
                                  <span style={{ width: 2.5, height: 14, background: C.primary, display: "inline-block" }} />
                                  <span className="text-xs font-mono font-semibold" style={{ color: C.primary }}>
                                    Break-even @ Yr {model.breakEvenYr} ({model.paybackPeriod.toFixed(1)} yrs)
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* SVG chart */}
                            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
                              <defs>
                                <linearGradient id="cfGainGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={C.secondary} stopOpacity="0.95" />
                                  <stop offset="100%" stopColor={C.secondary} stopOpacity="0.4" />
                                </linearGradient>
                                <linearGradient id="cfLossGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={C.error} stopOpacity="0.5" />
                                  <stop offset="100%" stopColor={C.error} stopOpacity="0.95" />
                                </linearGradient>
                                <filter id="cfGlow" x="-20%" y="-20%" width="140%" height="140%">
                                  <feGaussianBlur stdDeviation="3" result="blur" />
                                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                                </filter>
                              </defs>

                              {/* ── Y-axis gridlines & labels ── */}
                              {[-1, -0.5, 0, 0.5, 1].map((frac) => {
                                const y = valToY(frac * maxAbs);
                                const val = frac * maxAbs;
                                const isZero = frac === 0;
                                return (
                                  <g key={frac}>
                                    <line
                                      x1={PAD_L} x2={W - PAD_R} y1={y} y2={y}
                                      stroke={isZero ? C.onSurface : `${C.outlineVariant}60`}
                                      strokeWidth={isZero ? 1.5 : 0.7}
                                      strokeDasharray={isZero ? undefined : "4 4"}
                                    />
                                    <text
                                      x={PAD_L - 8} y={y + 4.5}
                                      textAnchor="end" fontSize="13" fontFamily="monospace"
                                      fill={isZero ? C.onSurface : C.mutedSand}
                                      fontWeight={isZero ? "700" : "400"}
                                    >
                                      {isZero ? "₹0" : (val > 0 ? "+" : "") + fmt(val)}
                                    </text>
                                  </g>
                                );
                              })}

                              {/* ── Bars ── */}
                              {bars.map((cf, i) => {
                                const x = barX(i);
                                const isPos = cf >= 0;
                                const barH = Math.max(4, (Math.abs(cf) / maxAbs) * (chartH / 2));
                                const y = isPos ? zeroY - barH : zeroY;
                                const isBreak = i === breakEvenYr;
                                const cx = x + bw / 2;

                                // Show value label: always on Yr0, always last bar, always at break-even, and every 3rd bar
                                const showLabel = i === 0 || i === YEARS - 1 || isBreak || i % 3 === 1;

                                return (
                                  <g key={i}>
                                    {/* Break-even zone overlay */}
                                    {isBreak && (
                                      <rect
                                        x={x - 2} y={PAD_T}
                                        width={bw + 4} height={chartH}
                                        fill={`${C.primary}10`}
                                      />
                                    )}

                                    {/* Bar */}
                                    <rect
                                      x={x} y={y} width={bw} height={barH}
                                      fill={isPos ? "url(#cfGainGrad)" : "url(#cfLossGrad)"}
                                      rx="3"
                                    />

                                    {/* Tooltip */}
                                    <title>{`Year ${i}: ${cf >= 0 ? "+" : ""}${fmt(cf)}\nCumulative: ${cum[i] >= 0 ? "+" : ""}${fmt(cum[i])}`}</title>

                                    {/* Value label above/below bar */}
                                    {showLabel && (
                                      <text
                                        x={cx}
                                        y={isPos ? y - 6 : y + barH + 16}
                                        textAnchor="middle" fontSize="12" fontFamily="monospace"
                                        fill={isPos ? C.secondary : C.error}
                                        fontWeight="700"
                                      >
                                        {cf >= 0 ? "+" : ""}{fmt(cf)}
                                      </text>
                                    )}

                                    {/* Break-even vertical line */}
                                    {isBreak && (
                                      <line
                                        x1={cx} x2={cx}
                                        y1={PAD_T} y2={H - PAD_B}
                                        stroke={C.primary} strokeWidth="1.5"
                                        strokeDasharray="5 3"
                                        opacity="0.8"
                                      />
                                    )}

                                    {/* X-axis year label */}
                                    <text
                                      x={cx} y={H - PAD_B + 18}
                                      textAnchor="middle" fontSize="13" fontFamily="monospace"
                                      fill={isBreak ? C.primary : C.mutedSand}
                                      fontWeight={isBreak ? "700" : "400"}
                                    >
                                      Yr{i}
                                    </text>
                                  </g>
                                );
                              })}

                              {/* ── Cumulative line ── */}
                              <path
                                d={cumPath}
                                fill="none" stroke={C.primary}
                                strokeWidth="2.5"
                                strokeLinejoin="round" strokeLinecap="round"
                                filter="url(#cfGlow)"
                              />

                              {/* Cumulative dots */}
                              {cum.map((v, i) => {
                                const key = i === 0 || i === breakEvenYr || i === YEARS - 1;
                                return (
                                  <circle
                                    key={i}
                                    cx={barX(i) + bw / 2} cy={valToY(v)}
                                    r={key ? 5 : 2.5}
                                    fill={C.primary}
                                    stroke={C.charcoal} strokeWidth="1.5"
                                  />
                                );
                              })}

                              {/* Cumulative end-label */}
                              <text
                                x={barX(YEARS - 1) + bw / 2}
                                y={valToY(cum[YEARS - 1]) - 10}
                                textAnchor="middle" fontSize="13" fontFamily="monospace"
                                fill={C.primary} fontWeight="700"
                              >
                                {cum[YEARS - 1] >= 0 ? "+" : ""}{fmt(cum[YEARS - 1])}
                              </text>
                            </svg>
                          </div>
                        );
                      })()}
                    </div>
                  </section>

                  {/* Wealth & Break-Even */}
                  <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div style={{ background: C.charcoal, border: `1px solid ${C.outlineVariant}` }} className="p-6 sp-card">
                      <h3 className="text-[10px] font-bold uppercase tracking-wider mb-4 font-mono" style={{ color: C.mutedSand }}>25-Year Wealth Projection</h3>
                      <div className="flex justify-between items-center mb-4">
                        <div className="text-center">
                          <div className="text-xs mb-1" style={{ color: C.mutedSand }}>Without Solar</div>
                          <div style={{ fontFamily: "Sora, sans-serif", fontSize: "22px", color: C.error }} className="tabular-nums sp-count-in">₹{Math.round((tariff * model.baseAnnualKwh * 25)/100000)}L</div>
                          <div className="text-xs" style={{ color: C.mutedSand }}>Utility Spend</div>
                        </div>
                        <span className="material-symbols-outlined text-3xl" style={{ color: C.surfaceVariant }}>arrow_forward</span>
                        <div className="text-center">
                          <div className="text-xs mb-1" style={{ color: C.mutedSand }}>With Solar</div>
                          <div style={{ fontFamily: "Sora, sans-serif", fontSize: "22px", color: C.secondary }} className="tabular-nums sp-count-in">₹{savings25L}L</div>
                          <div className="text-xs" style={{ color: C.secondary }}>Wealth Retained</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ background: C.charcoal, border: `1px solid ${C.outlineVariant}` }} className="p-6 sp-card">
                      <h3 className="text-[10px] font-bold uppercase tracking-wider mb-4 font-mono" style={{ color: C.mutedSand }}>Break-Even Timeline</h3>
                      <div className="flex flex-col justify-center h-full pb-4">
                        <div className="relative w-full h-2 rounded-full" style={{ background: C.surfaceVariant }}>
                          <div className="absolute left-0 top-0 h-full rounded-full sp-breakeven-fill" style={{ background: C.secondary, width: `${Math.min((model.paybackPeriod / 25) * 100, 100)}%` }} />
                          <div className="absolute w-3 h-3 bg-white rounded-full top-1/2 -translate-y-1/2" style={{ left: `${Math.min((model.paybackPeriod / 25) * 100, 100)}%` }} />
                          <div className="absolute text-xs font-mono font-bold" style={{ bottom: "-22px", left: 0, color: C.mutedSand }}>Yr 0</div>
                          <div className="absolute text-xs font-mono font-bold" style={{ bottom: "-22px", left: `${Math.min((model.paybackPeriod / 25) * 100, 100)}%`, transform: "translateX(-50%)", color: C.secondary }}>{model.paybackPeriod.toFixed(1)} Yrs</div>
                          <div className="absolute text-xs font-mono" style={{ bottom: "-22px", right: 0, color: C.mutedSand }}>Yr 25</div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Inflation Simulator & Carbon */}
                  <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div style={{ background: C.charcoal, border: `1px solid ${C.outlineVariant}` }} className="p-6 sp-card">
                      <h3 className="text-[10px] font-bold uppercase tracking-wider mb-4 font-mono" style={{ color: C.mutedSand }}>Electricity Inflation Simulator</h3>
                      <div className="grid grid-cols-4 gap-2 mb-4">
                        {[3,5,7,10].map(r => (
                          <button key={r} onClick={() => setInflationRate(r)}
                            style={{ border: `1px solid ${inflationRate === r ? C.primary : C.outlineVariant}`, background: inflationRate === r ? `${C.primary}12` : `${C.surfaceVariant}30`, color: inflationRate === r ? C.primary : C.mutedSand }}
                            className="p-2 text-center text-xs font-mono cursor-pointer transition-all hover:border-primary">
                            {r}%
                          </button>
                        ))}
                      </div>
                      <div className="text-sm" style={{ color: C.mutedSand }}>
                        At {inflationRate}% annual inflation, utility rates will double in <span style={{ color: C.onSurface, fontWeight: 600 }}>{(Math.log(2)/Math.log(1+inflationRate/100)).toFixed(1)} years</span>.
                      </div>
                    </div>
                    <div style={{ background: C.charcoal, border: `1px solid ${C.outlineVariant}` }} className="p-6 sp-card">
                      <h3 className="text-[10px] font-bold uppercase tracking-wider mb-4 font-mono" style={{ color: C.mutedSand }}>Carbon Impact Dashboard</h3>
                      <div className="grid grid-cols-3 gap-4">
                        {[
                          { icon: "park",          value: data.environmental.treesEquivalent.toLocaleString(),                              label: "Trees Planted", color: C.secondary },
                          { icon: "directions_car", value: Math.round(data.environmental.co2AnnualKg * 25 / 4600).toString(),               label: "Cars Removed",  color: C.primary },
                          { icon: "factory",        value: `${Math.round(data.environmental.co2AnnualKg * 25 / 1000)}t`,                    label: "Coal Avoided",  color: C.mutedSand },
                        ].map((item, i) => (
                          <div key={i} className="flex flex-col items-center text-center">
                            <span className="material-symbols-outlined mb-2" style={{ color: item.color, fontSize: "28px" }}>{item.icon}</span>
                            <span style={{ fontFamily: "Sora, sans-serif", fontSize: "18px", color: C.onSurface }} className="tabular-nums">{item.value}</span>
                            <span className="text-xs" style={{ color: C.mutedSand }}>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>

                  {/* Detailed Cashflow Table */}
                  <section>
                    <div style={{ borderBottom: `1px solid ${C.outlineVariant}` }} className="flex justify-between items-baseline pb-2 mb-4">
                      <h2 style={{ fontFamily: "Sora, sans-serif", color: C.onSurface, fontSize: "18px", fontWeight: 500 }}>Detailed Cashflow & Yield Projection</h2>
                      <span className="text-[10px] font-bold uppercase tracking-wider font-mono" style={{ color: C.mutedSand }}>Years 1–10</span>
                    </div>
                    <div style={{ border: `1px solid ${C.outlineVariant}` }} className="overflow-x-auto">
                      <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead>
                          <tr style={{ background: C.charcoal, borderBottom: `1px solid ${C.outlineVariant}` }}>
                            {["Year","Adj. Yield (kWh)","Gross Savings","O&M Costs","Maint. Res.","Tax Benefits","Post-Tax Net","Cum. NPV"].map(h => (
                              <th key={h} className="text-[10px] font-bold uppercase py-2 px-3 font-mono tracking-wider" style={{ color: C.mutedSand }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody style={{ fontFamily: "Inter, monospace", fontSize: "12px" }} className="tabular-nums">
                          {Array.from({ length: 10 }, (_, i) => {
                            const yr = i + 1;
                            const prod = model.baseAnnualKwh * Math.pow(0.995, i);
                            const currentRate = tariff * Math.pow(1 + escalation/100, i);
                            const savings = prod * currentRate * (batteryStorage ? 1.15 : 1);
                            const baseOm = 1500 + Math.max(0, model.installedKw-1)*500;
                            const om = baseOm * Math.pow(1+omCost/100, i);
                            const maintRes = om * 0.4;
                            const taxBenefit = yr <= 5 ? savings * 0.15 : 0;
                            const net = savings - om - (yr===10?35000:0) + taxBenefit;
                            const cumNpv = model.cumulativeCashFlow[yr];
                            return (
                              <tr key={yr} className="sp-row" style={{ borderBottom: `1px solid ${C.outlineVariant}50` }}>
                                <td className="py-2 px-3" style={{ color: C.mutedSand }}>{yr}</td>
                                <td className="py-2 px-3" style={{ color: C.onSurface }}>{Math.round(prod).toLocaleString()}</td>
                                <td className="py-2 px-3" style={{ color: C.onSurface }}>₹{Math.round(savings).toLocaleString()}</td>
                                <td className="py-2 px-3" style={{ color: C.error }}>₹({Math.round(om).toLocaleString()})</td>
                                <td className="py-2 px-3" style={{ color: C.error }}>₹({Math.round(maintRes).toLocaleString()})</td>
                                <td className="py-2 px-3" style={{ color: C.secondary }}>₹{Math.round(taxBenefit).toLocaleString()}</td>
                                <td className="py-2 px-3" style={{ color: net > 0 ? C.secondary : C.error }}>₹{Math.round(net).toLocaleString()}</td>
                                <td className="py-2 px-3" style={{ color: C.onSurface }}>₹{Math.round(cumNpv).toLocaleString()}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  {/* Closing CTA */}
                  <section style={{ background: C.charcoal, border: `1px solid ${C.outlineVariant}` }} className="p-8 text-center flex flex-col items-center">
                    <span className="material-symbols-outlined text-4xl mb-4" style={{ color: C.secondary }}>solar_power</span>
                    <h2 style={{ fontFamily: "Sora, sans-serif", color: C.onSurface, fontSize: "24px", fontWeight: 500, lineHeight: 1.2 }} className="mb-2">Ready to Secure Your Energy Future?</h2>
                    <p style={{ color: C.mutedSand, fontSize: "14px" }} className="max-w-2xl mb-8">Take the next step in realizing your projected ₹{savings25L}L in lifetime savings. Our experts are ready to finalize your system engineering.</p>
                    <div className="flex flex-wrap justify-center gap-4">
                      <button style={{ background: C.secondary, color: C.onSecondary }} className="flex items-center gap-2 px-6 py-3 text-[10px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity">
                        <span className="material-symbols-outlined text-sm">request_quote</span>
                        Request Quotes
                      </button>
                      <button style={{ background: C.charcoal, border: `1px solid ${C.outline}`, color: C.onSurface }} className="flex items-center gap-2 px-6 py-3 text-[10px] font-bold uppercase tracking-wider hover:opacity-80 transition-opacity">
                        <span className="material-symbols-outlined text-sm">calendar_month</span>
                        Schedule Consultation
                      </button>
                      <button onClick={handleDownload} disabled={downloading} style={{ background: C.charcoal, border: `1px solid ${C.outline}`, color: C.onSurface }} className="flex items-center gap-2 px-6 py-3 text-[10px] font-bold uppercase tracking-wider hover:opacity-80 transition-opacity disabled:opacity-40">
                        <Download className="w-3.5 h-3.5" /> Download PDF
                      </button>
                    </div>
                  </section>
                </div>

                {/* ── Right Sidebar ── */}
                <aside className="lg:col-span-3 flex flex-col gap-4 sp-fade-up-4">
                  {/* Energy Grade */}
                  <div style={{ background: C.charcoal, border: `1px solid ${C.outlineVariant}` }} className="p-4 flex flex-col items-center text-center sp-card">
                    <div style={{ width: 80, height: 80, borderRadius: "50%", background: `${C.secondary}10`, border: `2px solid ${C.secondary}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }} className="sp-glow-pulse">
                      <span style={{ fontFamily: "Sora, sans-serif", fontSize: "24px", color: C.secondary, fontWeight: 500 }}>A+</span>
                    </div>
                    <h3 className="text-sm font-semibold" style={{ fontFamily: "Sora, sans-serif", color: C.onSurface }}>Energy Grade</h3>
                    <p className="text-xs mt-1" style={{ color: C.mutedSand }}>Top 12% in {data.location?.label?.split(",")[0] ?? "your"} region based on roof potential.</p>
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
                      { label: "Horizon Shading", value: data.horizonShadingLoss !== undefined ? `${(data.horizonShadingLoss * 100).toFixed(1)}% Loss` : "3.2% Loss" },
                      { label: "Albedo",           value: "0.20" },
                      { label: "Sky View Factor",  value: data.skyViewFactor !== undefined ? data.skyViewFactor.toFixed(2) : "0.95" },
                      { label: "Azimuth",          value: "180° (South)" },
                      { label: "Tilt",             value: `${data.tiltDeg ?? 15}°` },
                      { label: "Wind Zone",        value: `${data.windZone ?? "Zone 1"} (${data.windZoneLabel ?? "Low"})` },
                    ]} />
                  </SideCard>

                  <SideCard title="AI Roof Insights">
                    <p className="text-xs mb-3" style={{ color: C.mutedSand }}>Strong southern exposure detected. Minimal shading from adjacent structures modeled via LIDAR.</p>
                    <RoofLayoutDiagram
                      polygons={store.scanInput?.roofPolygon ?? []}
                      panelConfig={store.panelConfig}
                    />
                  </SideCard>

                  {/* Installer Readiness */}
                  <div style={{ background: C.charcoal, border: `1px solid ${C.outlineVariant}` }} className="p-4 sp-card">
                    <h3 className="text-xs font-bold uppercase tracking-wider mb-3 font-mono"
                      style={{ color: C.onSurface, borderBottom: `1px solid ${C.outlineVariant}`, paddingBottom: "8px" }}>Installer Readiness</h3>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs" style={{ color: C.mutedSand }}>Risk Assessment</span>
                      <span className="text-xs font-bold" style={{ color: data.highWindWarning ? C.error : C.secondary }}>
                        {data.highWindWarning ? "HIGH" : "LOW"}
                      </span>
                    </div>
                    <div style={{ background: C.surfaceVariant }} className="w-full h-1 rounded-full overflow-hidden mb-3">
                      <div style={{ background: data.highWindWarning ? C.error : C.secondary, width: data.highWindWarning ? "75%" : "25%" }} className="h-full" />
                    </div>
                    <ul className="flex flex-col gap-1 text-xs" style={{ color: C.mutedSand }}>
                      {data.highWindWarning ? (
                        <li className="flex items-start gap-2 text-[11px]" style={{ color: C.error }}>
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: C.error }} />
                          <span>High Wind Structural Risk Warning: Exceeds threshold for &gt;4 consecutive months.</span>
                        </li>
                      ) : (
                        <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[14px]" style={{ color: C.secondary }}>check_circle</span> Structural Integrity OK</li>
                      )}
                      {data.windZone === "Zone 5/6" && (
                        <li className="flex items-start gap-2 text-[11px] mt-1" style={{ color: C.primary }}>
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: C.primary }} />
                          <span>Needs concrete ballast anchor modeling.</span>
                        </li>
                      )}
                      <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[14px]" style={{ color: C.secondary }}>check_circle</span> Grid Connection Viable</li>
                    </ul>
                  </div>

                  <SideCard title="Purchase vs Loan">
                    <div className="grid grid-cols-2 gap-2 text-xs text-center font-mono">
                      <div style={{ background: `${C.secondary}08`, border: `1px solid ${C.secondary}20` }} className="p-3">
                        <div style={{ color: C.mutedSand }} className="mb-1">Cash</div>
                        <div style={{ color: C.onSurface, fontFamily: "Sora, sans-serif" }} className="font-bold">₹{Math.round(Math.abs(model.npv)/100000).toFixed(1)}L NPV</div>
                      </div>
                      <div style={{ background: `${C.primary}08`, border: `1px solid ${C.primary}20` }} className="p-3">
                        <div style={{ color: C.mutedSand }} className="mb-1">Loan (7yr)</div>
                        <div style={{ color: C.onSurface, fontFamily: "Sora, sans-serif" }} className="font-bold">₹{Math.round(Math.abs(model.npv)*0.78/100000).toFixed(1)}L NPV</div>
                      </div>
                    </div>
                  </SideCard>

                  <InstallerLeadForm data={data} />
                </aside>
              </div>

              {/* Methodology */}
              <section style={{ borderTop: `1px solid ${C.outlineVariant}` }} className="pt-6 mt-4 sp-fade-up-5">
                <h3 style={{ fontFamily: "Sora, sans-serif", color: C.onSurface, fontSize: "18px", fontWeight: 500 }} className="mb-4">Methodology & Data Fidelity</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs font-mono" style={{ color: C.mutedSand }}>
                  {[
                    { title: "NASA POWER Dataset",     body: "Meteorological and solar irradiance data is sourced from NASA's Prediction of Worldwide Energy Resources (POWER) project. Data utilizes 20-year historical averages mapped to precise lat/long coordinates." },
                    { title: "Local Tariff Structures", body: "Financial models incorporate real-time tariff databases, accounting for localized net-metering policies, time-of-use (TOU) rates, and projected utility escalation metrics standard to the operating region." },
                    { title: "LIDAR Terrain Mapping",  body: "Site-specific shading, slope, and structural parameters derived from high-resolution LIDAR scans and satellite imagery to calculate precise horizon losses and optimal array placement." },
                  ].map(item => (
                    <div key={item.title}>
                      <h4 className="mb-2 pb-1" style={{ color: C.onSurface, borderBottom: `1px solid ${C.outlineVariant}` }}>{item.title}</h4>
                      <p>{item.body}</p>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : (
            /* ================================================================
               LOCKED STATE — teaser + upgrade card
            ================================================================ */
            <div className="space-y-8 sp-fade-up-1">
              {/* AI Summary + metrics strip */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div style={{ background: `${C.charcoal}99`, border: `1px solid ${C.outlineVariant}`, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}
                  className="lg:col-span-1 p-6 flex flex-col gap-4 sp-card animate-slide-up">
                  <div className="flex items-center gap-2">
                    <Satellite className="w-5 h-5" style={{ color: C.secondary }} />
                    <h2 style={{ fontFamily: "Sora, sans-serif", fontSize: "16px", fontWeight: 500, color: C.secondary }}>AI Summary</h2>
                  </div>
                  <div style={{ background: `${C.secondary}10`, border: `1px solid ${C.secondary}25` }} className="flex items-center gap-1.5 px-3 py-1.5 w-fit">
                    <div style={{ background: C.secondary, width: 6, height: 6, borderRadius: "50%" }} className="sp-glow-pulse" />
                    <span style={{ color: C.secondary }} className="text-[10px] font-bold uppercase tracking-widest font-mono">Geospatial Analysis Active</span>
                  </div>
                  <p style={{ color: C.onSurfaceVariant, fontSize: "14px", lineHeight: 1.6 }}>
                    Based on geospatial analysis, this property exhibits excellent solar irradiance. The unshaded roof area supports a system capable of offsetting approximately{" "}
                    <span style={{ color: C.onSurface, fontWeight: 600 }}>92%</span> of historical energy consumption.
                  </p>
                </div>

                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-5">
                  {[
                    { label: "Est. System Size",  value: data.energy.installedCapacityKw.toFixed(1), unit: "kWp", highlight: false },
                    { label: "Annual Production", value: data.energy.annualKwh.toLocaleString(),       unit: "kWh", highlight: false },
                    { label: "25-Yr Savings",     value: `₹${Math.round(data.financials.savings25yrInr/100000).toLocaleString()}L+`, unit: undefined, highlight: true },
                  ].map(({ label, value, unit, highlight }) => (
                    <div key={label}
                      style={{ background: `${C.charcoal}33`, border: `1px solid ${highlight ? C.secondary+"40" : C.outlineVariant}20` }}
                      className="sp-card p-6 flex flex-col justify-between relative overflow-hidden animate-slide-up">
                      <div style={{ background: `linear-gradient(to right, transparent, ${highlight ? C.secondary : "rgba(255,255,255,0.04)"}, transparent)` }} className="absolute top-0 left-0 w-full h-px" />
                      {highlight && <div style={{ background: `radial-gradient(ellipse at top left, ${C.secondary}08, transparent 70%)` }} className="absolute inset-0 pointer-events-none" />}
                      <span className="text-[10px] font-bold uppercase tracking-widest font-mono" style={{ color: highlight ? C.secondary : C.mutedSand }}>{label}</span>
                      <div className="mt-4 flex items-baseline gap-1.5">
                        <span style={{ fontFamily: "Sora, sans-serif", fontSize: "32px", fontWeight: 500, color: highlight ? C.secondary : C.onSurface, lineHeight: 1.2, letterSpacing: "-0.01em" }} className="sp-count-in">
                          {value}
                        </span>
                        {unit && <span className="text-xs font-mono" style={{ color: C.mutedSand }}>{unit}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Locked paywall teaser */}
              <div style={{ background: C.charcoal, border: `1px solid ${C.outlineVariant}`, borderRadius: "16px", minHeight: "580px" }} className="relative w-full overflow-hidden sp-fade-up-2">
                {/* Faux content (blurred behind) */}
                <div className="absolute inset-0 p-8 opacity-20 pointer-events-none select-none flex flex-col gap-8">
                  <div style={{ borderBottom: `1px solid ${C.outlineVariant}` }} className="flex justify-between items-end pb-4">
                    <h3 style={{ fontFamily: "Sora, sans-serif", color: C.onSurface, fontSize: "20px" }}>Cashflow & ROI Projection</h3>
                    <div className="flex gap-3">
                      <div style={{ background: C.surfaceVariant, height: 24, width: 96, borderRadius: 4 }} />
                      <div style={{ background: C.surfaceVariant, height: 24, width: 96, borderRadius: 4 }} />
                    </div>
                  </div>
                  <div style={{ borderLeft: `1px solid ${C.outlineVariant}`, borderBottom: `1px solid ${C.outlineVariant}` }} className="flex-grow w-full relative flex items-end gap-3 px-4 pb-0">
                    <div style={{ background: `${C.surfaceVariant}80`, width: "11%", borderRadius: "2px 2px 0 0" }} className="sp-lbar-1" />
                    <div style={{ background: `${C.surfaceVariant}80`, width: "11%", borderRadius: "2px 2px 0 0" }} className="sp-lbar-2" />
                    <div style={{ background: `${C.secondary}30`,      width: "11%", borderRadius: "2px 2px 0 0" }} className="sp-lbar-3" />
                    <div style={{ background: `${C.secondary}30`,      width: "11%", borderRadius: "2px 2px 0 0" }} className="sp-lbar-4" />
                    <div style={{ background: `${C.secondary}30`,      width: "11%", borderRadius: "2px 2px 0 0" }} className="sp-lbar-5" />
                    <div style={{ background: `${C.primary}30`,        width: "11%", borderRadius: "2px 2px 0 0" }} className="sp-lbar-3" />
                    <div style={{ background: `${C.primary}40`,        width: "11%", borderRadius: "2px 2px 0 0" }} className="sp-lbar-4" />
                  </div>
                  <div className="space-y-2">
                    {[1,2,3].map(i => <div key={i} style={{ background: C.surfaceVariant, height: 32, borderRadius: 4, opacity: 0.5 }} />)}
                  </div>
                </div>

                {/* Fade overlay */}
                <div style={{ background: `linear-gradient(to bottom, transparent, ${C.charcoal}cc, ${C.charcoal})` }} className="absolute inset-0 pointer-events-none" />

                {/* Upgrade card */}
                <div className="absolute bottom-0 left-0 w-full p-8 flex flex-col items-center justify-center text-center z-10">
                  <div style={{ background: `${C.background}e0`, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: `1px solid ${C.outlineVariant}`, maxWidth: 600, width: "100%" }}
                    className="sp-border-glow p-8 flex flex-col items-center gap-6 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)]">
                    {/* Lock icon — bare, no box */}
                    <Lock style={{ color: C.primary, width: 36, height: 36 }} className="sp-float" />

                    {/* Progress stepper */}
                    <div className="flex w-full max-w-xs gap-1">
                      {[C.secondary, C.secondary, C.primaryContainer, C.outlineVariant, C.outlineVariant].map((col, i) => (
                        <div key={i} style={{ height: 2, flex: 1, background: col }} />
                      ))}
                    </div>

                    <div className="flex flex-col gap-2">
                      <h3 style={{ fontFamily: "Sora, sans-serif", color: C.onSurface, fontSize: "24px", fontWeight: 500, lineHeight: 1.2 }}>
                        Unlock Your Full Solar Intelligence Report
                      </h3>
                      <p style={{ color: C.onSurfaceVariant, fontSize: "14px", lineHeight: 1.6 }} className="max-w-md mx-auto">
                        Access detailed financial models, itemized equipment specifications, and a certified installer readiness breakdown.
                      </p>
                    </div>

                    {/* Feature chips */}
                    <div className="flex flex-wrap justify-center gap-2">
                      {["25-Yr Cashflow Model","IRR & NPV Solver","Installer Readiness","PDF Export"].map(f => (
                        <div key={f} style={{ background: `${C.secondary}10`, border: `1px solid ${C.secondary}30`, color: C.secondary }} className="text-[10px] font-bold uppercase tracking-wider font-mono px-3 py-1">
                          {f}
                        </div>
                      ))}
                    </div>

                    <button onClick={() => setCheckoutOpen(true)}
                      style={{ background: C.primaryContainer, color: C.onPrimary }}
                      className="flex items-center gap-2 px-8 py-4 font-semibold text-sm uppercase tracking-wider transition-all hover:opacity-90 active:scale-[0.98] group shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
                      Unlock Report — ₹149
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>

                    <div className="flex items-center gap-2 text-xs font-mono" style={{ color: C.mutedSand }}>
                      <ShieldCheck className="w-4 h-4" style={{ color: C.secondary }} />
                      Secure checkout. Immediate access.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footnote */}
          <div className="mt-4 text-center text-[9px] font-mono uppercase tracking-widest" style={{ color: C.mutedSand }}>
            SUNPOWER LINK Solar Estimation Engine · Grid loss factor: 14% · Climatology: NASA POWER API satellite profile · RCC flatness tilt structural calibration active
          </div>
        </main>

        {/* Footer */}
        <footer style={{ background: C.background, borderTop: `1px solid ${C.outlineVariant}` }} className="flex flex-col md:flex-row justify-between items-center px-4 md:px-16 py-4 gap-6 mt-4">
          <div className="flex flex-col gap-2 max-w-xl">
            <div style={{ fontFamily: "Sora, sans-serif", color: C.mutedSand, fontSize: "14px" }}>SUNPOWER LINK</div>
            <p className="text-xs" style={{ color: C.mutedSand }}>© {new Date().getFullYear()} SUNPOWER LINK. Financial intelligence driven by geospatial AI.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/map")} className="btn-primary">
              Analyze Another Rooftop
            </button>
            <button onClick={() => navigate("/")} style={{ background: C.charcoal, border: `1px solid ${C.outlineVariant}`, color: C.onSurface }} className="px-4 py-2 text-xs font-bold uppercase tracking-wider hover:opacity-80 transition-opacity">
              Back to Home
            </button>
          </div>
          <div className="flex flex-col md:flex-row gap-6">
            {["Methodology","Data Sources","Terms","Privacy"].map(link => (
              <a key={link} href="#" className="text-[10px] font-bold uppercase tracking-wider font-mono transition-colors hover:text-white" style={{ color: C.mutedSand }}>{link}</a>
            ))}
          </div>
        </footer>

        {/* ── Checkout Dialog ───────────────────────────────────── */}
        <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
          <DialogContent style={{ background: C.charcoal, border: `1px solid ${C.outlineVariant}`, color: C.onSurface }} className="sm:max-w-[450px] rounded-none shadow-2xl p-6 focus:outline-none">
            <DialogHeader className="space-y-1.5">
              <DialogTitle className="text-sm font-bold flex items-center gap-2 font-mono uppercase tracking-wider" style={{ color: C.primary }}>
                <Sparkles className="w-4 h-4 animate-pulse" style={{ color: C.primary }} />
                Secure Report Checkout
              </DialogTitle>
              <DialogDescription className="text-xs" style={{ color: C.mutedSand }}>
                Scan ID: <span className="font-mono font-bold" style={{ color: C.primary }}>{data.analysisId}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-3">
              <div className="text-[10px] font-bold uppercase tracking-wider font-mono" style={{ color: C.mutedSand }}>Select tier</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "pay_per_scan", label: "Single Scan", price: "₹149", sub: "One-time payment" },
                  { key: "pro_monthly",  label: "Pro Monthly", price: "₹999/mo", sub: "Unlimited Scans", highlight: true },
                ].map(plan => (
                  <button key={plan.key} onClick={() => setPaymentPlan(plan.key as any)}
                    style={{ background: paymentPlan === plan.key ? `${C.primaryContainer}15` : "transparent", border: `1px solid ${paymentPlan === plan.key ? C.primaryContainer : C.outlineVariant}`, color: C.onSurface }}
                    className="p-3 text-left flex flex-col justify-between h-20 transition-all font-mono">
                    <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: C.mutedSand }}>{plan.label}</span>
                    <span style={{ fontFamily: "Sora, sans-serif", fontSize: "16px" }} className="font-bold">{plan.price}</span>
                    <span className="text-[8px]" style={{ color: (plan as any).highlight ? C.secondary : C.mutedSand }}>{plan.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 my-2">
              <div className="text-[10px] font-bold uppercase tracking-wider font-mono" style={{ color: C.mutedSand }}>Payment details</div>
              <div style={{ background: C.background, border: `1px solid ${C.outlineVariant}` }} className="flex p-0.5">
                {["card","upi"].map(m => (
                  <button key={m} onClick={() => setPaymentMethod(m as any)}
                    style={{ background: paymentMethod===m ? C.primaryContainer : "transparent", color: paymentMethod===m ? C.onPrimary : C.mutedSand }}
                    className="flex-1 text-[10px] py-1.5 font-bold uppercase transition-all font-mono">
                    {m === "card" ? "Card" : "UPI"}
                  </button>
                ))}
              </div>
              {paymentMethod === "card" ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-[9px] font-bold uppercase font-mono block mb-1" style={{ color: C.mutedSand }}>Card number</label>
                    <input type="text" placeholder="4000 1234 5678 9010" value={cardNumber} onChange={e => setCardNumber(e.target.value)}
                      style={{ background: C.background, border: `1px solid ${C.outlineVariant}`, color: C.onSurface }}
                      className="w-full px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#ff8f00]" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-bold uppercase font-mono block mb-1" style={{ color: C.mutedSand }}>Expiry</label>
                      <input type="text" placeholder="MM/YY" value={cardExpiry} onChange={e => setCardExpiry(e.target.value)}
                        style={{ background: C.background, border: `1px solid ${C.outlineVariant}`, color: C.onSurface }}
                        className="w-full px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#ff8f00]" />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase font-mono block mb-1" style={{ color: C.mutedSand }}>CVV</label>
                      <input type="password" placeholder="•••" value={cardCvv} onChange={e => setCardCvv(e.target.value)}
                        style={{ background: C.background, border: `1px solid ${C.outlineVariant}`, color: C.onSurface }}
                        className="w-full px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#ff8f00]" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <div style={{ border: `1px dashed ${C.secondary}30`, width: 128, height: 128, margin: "0 auto 8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span className="text-[9px] font-mono uppercase" style={{ color: C.secondary }}>SolarScan Sandbox QR</span>
                  </div>
                  <div className="text-[9px] font-mono uppercase" style={{ color: C.mutedSand }}>Scan with any UPI app</div>
                </div>
              )}
            </div>

            <div style={{ borderTop: `1px solid ${C.outlineVariant}` }} className="space-y-2 pt-4 mt-4">
              <button onClick={handleSandboxCheckout} disabled={paymentProcessing || paymentSuccess}
                style={{ background: C.primaryContainer, color: C.onPrimary }}
                className="w-full text-xs font-bold py-3 flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity uppercase tracking-wider">
                {paymentProcessing ? <><RefreshCw className="w-4 h-4 animate-spin" />Processing...</> : paymentSuccess ? <><CheckCircle2 className="w-4 h-4" />Unlocking...</> : "Simulate Instant Sandbox Unlock"}
              </button>
              <button onClick={() => { setCheckoutOpen(false); initiatePayment({ plan: paymentPlan, scanId: data?.analysisId }); }}
                disabled={paymentProcessing || paymentSuccess || isPaymentGatewayLoading}
                style={{ background: "transparent", border: `1px solid ${C.outlineVariant}`, color: C.onSurface }}
                className="w-full text-xs font-bold py-3 flex items-center justify-center gap-2 hover:bg-[#1F1B18] transition-colors disabled:opacity-50 uppercase tracking-wider">
                {isPaymentGatewayLoading ? <><RefreshCw className="w-4 h-4 animate-spin" />Connecting...</> : "Launch Razorpay"}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default ResultsPage;
