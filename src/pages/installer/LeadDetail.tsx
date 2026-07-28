import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Phone,
  Calendar,
  Sparkles,
  MapPin,
  ShieldCheck,
  Zap,
  TrendingUp,
  DollarSign,
  Wind,
  Sun,
  Layers,
  CheckCircle,
} from "lucide-react";

interface Activity {
  date: string;
  type: "received" | "contact" | "visit" | "quote" | "reminder" | "status";
  description: string;
}

interface Lead {
  id: string;
  name: string;
  phone: string;
  address: string;
  roofArea: number;
  estimatedKw: number;
  roiLakh: number;
  source: string;
  status: "new" | "contacted" | "site_visit" | "quoted" | "won_lost";
  date: string;
  quoteAmount?: number;
  activities?: Activity[];
}

export default function LeadDetail() {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [lead, setLead] = useState<Lead | null>(null);

  useEffect(() => {
    const cached = localStorage.getItem("solarsan-installer-leads");
    if (cached) {
      const list: Lead[] = JSON.parse(cached);
      const found = list.find((l) => l.id === leadId);
      if (found) {
        setLead(found);
        return;
      }
    }
    // Fallback if not found in custom list
    toast({
      title: "Lead Not Found",
      description: "Displaying template customer data.",
      variant: "destructive",
    });
    setLead({
      id: leadId || "unknown",
      name: "Ramesh Sharma",
      phone: "9820012345",
      address: "Sea Face Apartment, Worli, Mumbai, MH",
      roofArea: 120,
      estimatedKw: 12.5,
      roiLakh: 14.5,
      source: "SolarScan B2C",
      status: "new",
      date: "2026-07-17",
      activities: [
        { date: "2026-07-17", type: "received", description: "Lead record received from SolarScan B2C" }
      ]
    });
  }, [leadId]);

  if (!lead) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-xs font-mono text-neutral-500 animate-pulse">Loading lead dossier...</p>
      </div>
    );
  }

  const handleAccept = () => {
    const nextAct: Activity = {
      date: new Date().toISOString().split('T')[0],
      type: "contact",
      description: "Lead request accepted. Homeowner contact unlocked."
    };
    const updated = {
      ...lead,
      status: 'contacted' as const,
      activities: [...(lead.activities || []), nextAct]
    };
    setLead(updated);
    
    // Save to localStorage
    const cached = localStorage.getItem("solarsan-installer-leads");
    if (cached) {
      const list: Lead[] = JSON.parse(cached);
      const updatedList = list.map(l => l.id === lead.id ? {
        ...l,
        status: 'contacted' as const,
        activities: [...(l.activities || []), nextAct]
      } : l);
      localStorage.setItem("solarsan-installer-leads", JSON.stringify(updatedList));
    }
    toast({
      title: "Lead Accepted",
      description: "Homeowner contact info unlocked.",
    });
  };

  const handleCall = () => {
    if (lead.status === 'new') {
      toast({
        title: "Access Denied",
        description: "Please accept the lead request to unlock homeowner phone number.",
        variant: "destructive"
      });
      return;
    }
    toast({
      title: "Direct Dial Triggered",
      description: `Opening dialing application for ${lead.name} (${lead.phone}).`,
    });
    window.location.href = `tel:${lead.phone}`;
  };

  return (
    <div className="min-h-screen bg-neutral-50 py-8 px-4 md:px-12">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* ── Header Dossier Actions ────────────────────────────── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-neutral-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/installer/dashboard")}
              className="p-2 bg-neutral-100 hover:bg-neutral-200 rounded-full transition-colors cursor-pointer"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-4 h-4 text-[#0F172A]" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#1A1A1A]">{lead.name}</h1>
                <span className="text-[9px] font-bold bg-[#0F172A] text-white px-2 py-0.5 rounded font-mono uppercase">
                  {lead.source}
                </span>
              </div>
              <p className="text-xs text-neutral-500 flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3 h-3 text-neutral-400 shrink-0" />
                {lead.address}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {lead.status === 'new' ? (
              <button
                onClick={handleAccept}
                className="flex-1 md:flex-none bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold py-2.5 px-4 rounded flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                Accept Lead to Unlock
              </button>
            ) : (
              <button
                onClick={handleCall}
                className="flex-1 md:flex-none bg-[#0F172A] text-white hover:bg-neutral-800 text-xs font-bold py-2.5 px-4 rounded flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Phone className="w-3.5 h-3.5" />
                Call Homeowner
              </button>
            )}
          </div>
        </div>

        {/* ── Main Detail Grid ───────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Columns - Specs & Rooftop Layout (2 Columns wide) */}
          <div className="md:col-span-2 space-y-6">
            {/* Rooftop Layout Simulation */}
            <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-neutral-100">
                <h3 className="text-xs font-bold font-mono text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#B45309]" />
                  Rooftop Layout Simulation
                </h3>
                <span className="text-[10px] text-neutral-500">Scale: 1:150</span>
              </div>

              {/* Stylized SVG Rooftop Drawing */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg h-64 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#E2E8F0_1.5px,transparent_1.5px)] [background-size:16px_16px]" />
                
                {/* Visual outline representation */}
                <svg className="w-full h-full p-6 text-emerald-400" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {/* Outer Roof boundary polygon */}
                  <polygon
                    points="15,20 85,15 80,85 20,80"
                    fill="#1F2937"
                    stroke="#4B5563"
                    strokeWidth="1.5"
                  />
                  {/* Solar panel array layout representation in rows */}
                  <g fill="#0F172A" stroke="#10B981" strokeWidth="0.8">
                    <rect x="25" y="30" width="8" height="12" rx="0.5" />
                    <rect x="35" y="30" width="8" height="12" rx="0.5" />
                    <rect x="45" y="30" width="8" height="12" rx="0.5" />
                    <rect x="55" y="30" width="8" height="12" rx="0.5" />
                    <rect x="65" y="30" width="8" height="12" rx="0.5" />

                    <rect x="25" y="46" width="8" height="12" rx="0.5" />
                    <rect x="35" y="46" width="8" height="12" rx="0.5" />
                    <rect x="45" y="46" width="8" height="12" rx="0.5" />
                    <rect x="55" y="46" width="8" height="12" rx="0.5" />
                    <rect x="65" y="46" width="8" height="12" rx="0.5" />

                    <rect x="30" y="62" width="8" height="12" rx="0.5" />
                    <rect x="40" y="62" width="8" height="12" rx="0.5" />
                    <rect x="50" y="62" width="8" height="12" rx="0.5" />
                    <rect x="60" y="62" width="8" height="12" rx="0.5" />
                  </g>
                  {/* Compass south arrow indicator */}
                  <line x1="88" y1="80" x2="88" y2="92" stroke="#B45309" strokeWidth="1.5" />
                  <polygon points="88,76 85,82 91,82" fill="#B45309" />
                  <text x="86" y="98" fill="#B45309" fontSize="6" fontWeight="bold">S</text>
                </svg>

                <div className="absolute bottom-3 left-3 bg-[#0F172A]/90 px-2 py-1 rounded border border-neutral-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[9px] text-neutral-300 font-mono">Usable Array: {lead.estimatedKw} kWp Installed Capacity</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="border border-neutral-100 p-2.5 rounded">
                  <span className="text-[9px] font-bold text-neutral-400 block uppercase font-mono">Total Drawn Area</span>
                  <span className="text-xs font-bold text-[#1A1A1A]">{lead.roofArea} m²</span>
                </div>
                <div className="border border-neutral-100 p-2.5 rounded">
                  <span className="text-[9px] font-bold text-neutral-400 block uppercase font-mono">Usable Solar Area</span>
                  <span className="text-xs font-bold text-[#1A1A1A]">{Math.round(lead.roofArea * 0.7)} m²</span>
                </div>
                <div className="border border-neutral-100 p-2.5 rounded">
                  <span className="text-[9px] font-bold text-neutral-400 block uppercase font-mono">Installed Modules</span>
                  <span className="text-xs font-bold text-[#1A1A1A]">{Math.round((lead.estimatedKw * 1000) / 550)}x 550W</span>
                </div>
                <div className="border border-neutral-100 p-2.5 rounded">
                  <span className="text-[9px] font-bold text-neutral-400 block uppercase font-mono">Azimuth Orientation</span>
                  <span className="text-xs font-bold text-[#1A1A1A]">180° South</span>
                </div>
              </div>
            </div>

            {/* Financial Analysis dossier */}
            <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold font-mono text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-neutral-100">
                <DollarSign className="w-4 h-4 text-[#B45309]" />
                Financial Audit Summary
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 border border-neutral-100 rounded bg-neutral-50/50">
                  <span className="text-[9px] font-bold text-neutral-400 uppercase font-mono">CapEx System Cost</span>
                  <p className="text-base font-bold text-[#1A1A1A]">₹{((lead.estimatedKw * 48000 + 35000) / 100000).toFixed(2)} Lakh</p>
                  <span className="text-[8px] text-neutral-400 font-mono block">Post-subsidy outline</span>
                </div>
                <div className="p-3 border border-neutral-100 rounded bg-neutral-50/50">
                  <span className="text-[9px] font-bold text-neutral-400 uppercase font-mono">25-Yr Net Savings</span>
                  <p className="text-base font-bold text-emerald-600">₹{lead.roiLakh.toFixed(1)} Lakh</p>
                  <span className="text-[8px] text-neutral-400 font-mono block">Net Present Value return</span>
                </div>
                <div className="p-3 border border-neutral-100 rounded bg-neutral-50/50">
                  <span className="text-[9px] font-bold text-neutral-400 uppercase font-mono">Payback Timeline</span>
                  <p className="text-base font-bold text-[#B45309]">3.4 Years</p>
                  <span className="text-[8px] text-neutral-400 font-mono block">Estimated break-even</span>
                </div>
              </div>

              {/* Financial returns ledger */}
              <div className="border border-neutral-200 rounded overflow-hidden">
                <table className="w-full text-[10px] text-left border-collapse font-mono">
                  <thead>
                    <tr className="bg-[#0F172A] text-white">
                      <th className="p-2">Period</th>
                      <th className="p-2 text-right">Annual Yield</th>
                      <th className="p-2 text-right">Utility Savings</th>
                      <th className="p-2 text-right">O&M Cost</th>
                      <th className="p-2 text-right">Net Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 5, 10, 15, 20, 25].map((yr, idx) => {
                      const yieldVal = Math.round(lead.estimatedKw * 1450 * Math.pow(0.9945, yr - 1));
                      const savings = Math.round(yieldVal * 8.5 * Math.pow(1.045, yr - 1));
                      const om = Math.round(1500 * Math.pow(1.02, yr - 1));
                      return (
                        <tr key={yr} className={idx % 2 === 1 ? "bg-neutral-50" : "bg-white"}>
                          <td className="p-2 font-bold text-[#0F172A]">Year {yr}</td>
                          <td className="p-2 text-right">{yieldVal.toLocaleString()} kWh</td>
                          <td className="p-2 text-right">₹{(savings / 1000).toFixed(1)} K</td>
                          <td className="p-2 text-right">₹{(om / 1000).toFixed(1)} K</td>
                          <td className="p-2 text-right font-bold text-emerald-600">₹{((savings - om) / 1000).toFixed(1)} K</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column - Parameters, Wind, Shading, Metadata */}
          <div className="space-y-6">
            {/* Shading & Horizon obstruction analysis */}
            <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold font-mono text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-neutral-100">
                <Sun className="w-4 h-4 text-[#B45309]" />
                Horizon Shading Loss
              </h3>

              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[9px] text-neutral-400 block font-mono">CALCULATED LOSS</span>
                  <span className="text-xl font-bold text-[#1A1A1A]">8.0%</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-neutral-400 block font-mono">NEARBY BUILDINGS</span>
                  <span className="text-xl font-bold text-[#0F172A]">3 Structures</span>
                </div>
              </div>

              <div className="text-[10px] text-neutral-500 leading-relaxed font-mono bg-neutral-50 p-2.5 border rounded">
                <Info className="w-3.5 h-3.5 text-neutral-400 inline mr-1 -mt-0.5" />
                Obstructions detected at 142° and 185° azimuth (distance &lt; 25m, elevation &gt; 12°). Default auto calculations apply.
              </div>
            </div>

            {/* Wind Zone structural parameters */}
            <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold font-mono text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-neutral-100">
                <Wind className="w-4 h-4 text-[#B45309]" />
                Wind Zone & Safety
              </h3>

              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[9px] text-neutral-400 block font-mono">ZONE PROFILE</span>
                  <span className="text-sm font-bold text-[#1A1A1A]">Zone 2 (Moderate)</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-neutral-400 block font-mono">WIND VELOCITY</span>
                  <span className="text-sm font-bold text-[#1A1A1A]">39 m/s</span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-neutral-100">
                <span className="text-[10px] text-neutral-500 font-mono">Structural Cost Adder:</span>
                <span className="text-xs font-bold text-[#B45309]">₹3,000 / kWp</span>
              </div>
            </div>

            {/* Technical Metas info card */}
            <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-bold font-mono text-[#0F172A] uppercase tracking-wider pb-1 border-b border-neutral-100">
                Site Prospectus Metadata
              </h3>

              <div className="space-y-2 text-[10px] font-mono">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Prospect ID:</span>
                  <span className="font-bold text-neutral-800">{lead.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Scan Source:</span>
                  <span className="font-bold text-neutral-800">{lead.source}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Captured Date:</span>
                  <span className="font-bold text-neutral-800">{lead.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Status Stage:</span>
                  <span className="font-bold text-neutral-800 uppercase text-blue-500">{lead.status}</span>
                </div>
                <div className="flex justify-between border-t border-neutral-100 pt-2">
                  <span className="text-neutral-400">Homeowner Contact:</span>
                  <span className="font-bold text-neutral-800">
                    {lead.status === 'new' ? "XXXXX XXXXX (Locked)" : `+91 ${lead.phone}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Chronological Activity Log */}
            <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold font-mono text-[#0F172A] uppercase tracking-wider pb-1 border-b border-neutral-100">
                Chronological Activity Log
              </h3>
              
              <div className="space-y-4 relative before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-200">
                {(lead.activities || [
                  { date: lead.date, type: "received", description: "Lead record received from SolarScan B2C" }
                ]).map((act, idx) => (
                  <div key={idx} className="flex gap-4 relative items-start pl-6">
                    <span className="w-5 h-5 rounded-full bg-[#0F172A] text-white absolute left-0 flex items-center justify-center text-[8px] font-mono border border-white">
                      ✓
                    </span>
                    <div>
                      <span className="text-[9px] text-neutral-400 block font-mono">{act.date}</span>
                      <p className="text-[10px] text-neutral-800 font-mono leading-relaxed">{act.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
