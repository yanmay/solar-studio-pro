import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInstallerAuth } from "@/hooks/use-installer-auth";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Settings as SettingsIcon, LogOut, MapPin,
  TrendingUp, Info, Building2, CheckCircle2, Zap, Phone,
  TrendingDown, BarChart2,
} from "lucide-react";

interface Activity {
  date: string;
  type: string;
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
  status: "new" | "contacted" | "site_visit" | "quoted" | "won_lost";
  date: string;
  quoteAmount?: number;
  activities?: Activity[];
}

const INITIAL_LEADS: Lead[] = [
  {
    id: "lead-101", name: "Ramesh Sharma", phone: "9820012345",
    address: "Sea Face Apartment, Worli, Mumbai, MH",
    roofArea: 120, estimatedKw: 12.5, roiLakh: 14.5,
    status: "new", date: "2026-07-17",
    activities: [{ date: "2026-07-17", type: "received", description: "Lead received from SUNPOWER LINK" }],
  },
  {
    id: "lead-102", name: "Ananya Deshmukh", phone: "9819922334",
    address: "Greenwood Colony, Kothrud, Pune, MH",
    roofArea: 85, estimatedKw: 8.5, roiLakh: 9.8,
    status: "contacted", date: "2026-07-16",
    activities: [
      { date: "2026-07-16", type: "received", description: "Lead received from SUNPOWER LINK" },
      { date: "2026-07-16", type: "contact", description: "First call made" },
    ],
  },
  {
    id: "lead-103", name: "Vijay Reddy", phone: "9900112233",
    address: "UB Hills, Lavelle Road, Bengaluru, KA",
    roofArea: 250, estimatedKw: 24.0, roiLakh: 28.5,
    status: "site_visit", date: "2026-07-15",
    activities: [{ date: "2026-07-16", type: "visit", description: "Rooftop site visit scheduled" }],
  },
  {
    id: "lead-104", name: "Karthik Srinivasan", phone: "9740054321",
    address: "12th Cross, Indiranagar, Bengaluru, KA",
    roofArea: 75, estimatedKw: 6.0, roiLakh: 7.2, quoteAmount: 5.8,
    status: "quoted", date: "2026-07-14",
    activities: [{ date: "2026-07-15", type: "quote", description: "Quote submitted: ₹5.8 Lakh" }],
  },
  {
    id: "lead-105", name: "Sunita Patel", phone: "9611223344",
    address: "Nirma Heights, Satellite, Ahmedabad, GJ",
    roofArea: 140, estimatedKw: 15.0, roiLakh: 18.0, quoteAmount: 14.2,
    status: "won_lost", date: "2026-07-13",
    activities: [{ date: "2026-07-15", type: "status", description: "Project won & locked" }],
  },
];

const COLUMNS: { key: Lead["status"]; label: string; color: string; dot: string }[] = [
  { key: "new",        label: "New Lead",    color: "border-blue-500/30 bg-blue-500/10 text-blue-300",    dot: "bg-blue-400" },
  { key: "contacted",  label: "Contacted",   color: "border-[#FF6600]/30 bg-[#FF6600]/10 text-[#FF6600]", dot: "bg-[#FF6600]" },
  { key: "site_visit", label: "Site Visit",  color: "border-violet-500/30 bg-violet-500/10 text-violet-300", dot: "bg-violet-400" },
  { key: "quoted",     label: "Quoted",      color: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",    dot: "bg-cyan-400" },
  { key: "won_lost",   label: "Won / Closed",color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", dot: "bg-emerald-400" },
];

const KPI_CARDS = [
  { label: "This Month",     value: "5 Leads",     sub: "+40% vs last month", icon: <TrendingUp className="w-4 h-4 text-emerald-400" />, accent: "text-white" },
  { label: "Conversion",     value: "20% Won",     sub: "1 closed proposal",  icon: <BarChart2   className="w-4 h-4 text-[#FF6600]" />,  accent: "text-emerald-400" },
  { label: "Avg Quote",      value: "₹10.0 L",     sub: "Commercial & high-kW", icon: <Zap       className="w-4 h-4 text-[#FF6600]" />,  accent: "text-[#FF6600]" },
  { label: "Pipeline Value", value: "₹41.1 L",     sub: "Active opportunity",  icon: <TrendingUp className="w-4 h-4 text-cyan-400" />,     accent: "text-cyan-400" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, signOut } = useInstallerAuth();
  const { toast } = useToast();

  const [leads, setLeads]     = useState<Lead[]>(INITIAL_LEADS);
  const [modal, setModal]     = useState<Lead | null>(null);
  const [activeNav, setNav]   = useState<"leads" | "settings">("leads");

  const moveLeadStatus = (id: string, status: Lead["status"]) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    toast({ title: "Pipeline updated", description: `Lead moved to ${status.replace("_", " ")}` });
  };

  return (
    <div
      className="professional-product-ui min-h-screen text-white flex flex-col lg:flex-row antialiased"
      style={{ background: "#050505" }}
    >
      {/* ── Cinematic Ambient Blobs ─────────────────────────────── */}
      <div className="hidden" aria-hidden="true">
        <div className="absolute top-[-20%] left-[-10%] w-[700px] h-[700px] rounded-full opacity-[0.06] blur-[130px]"
          style={{ background: "#FF6600", animation: "dashBlob1 20s ease-in-out infinite alternate" }} />
        <div className="absolute bottom-[-15%] right-0 w-[600px] h-[600px] rounded-full opacity-[0.05] blur-[110px]"
          style={{ background: "#10B981", animation: "dashBlob2 25s ease-in-out infinite alternate" }} />
      </div>
      <style>{`
        @keyframes dashBlob1 { to { transform: translate(60px, 80px) scale(1.12); } }
        @keyframes dashBlob2 { to { transform: translate(-50px, -40px) scale(1.08); } }
      `}</style>

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside
        className="w-full lg:w-60 shrink-0 border-b lg:border-b-0 lg:border-r border-white/[0.06] relative z-20"
        style={{ background: "rgba(2,2,3,0.85)", backdropFilter: "blur(24px)" }}
      >
        <div className="p-5 flex flex-col h-full lg:min-h-screen justify-between">
          <div className="space-y-6">
            {/* Logo */}
            <button onClick={() => navigate("/")} className="flex items-center gap-2.5 cursor-pointer group" aria-label="Go to Home">
              <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain transition-transform duration-200 group-hover:scale-105" />
              <div>
                <span className="text-[14px] font-bold text-white block leading-tight tracking-tight">
                  SUNPOWER <span className="font-['Calistoga',serif] italic font-normal text-[#FF6600]">LINK</span>
                </span>
                <span className="text-[9px] text-[#FF6600]/70 font-['JetBrains_Mono',monospace] uppercase tracking-[0.2em] block">
                  Partner Portal
                </span>
              </div>
            </button>

            {/* Profile Card */}
            <div
              className="p-3.5 rounded-2xl border border-white/[0.08] space-y-1.5"
              style={{ background: "rgba(255,255,255,0.03)" }}
            >
              <div className="text-[12px] font-semibold text-white truncate">{profile?.companyName || "Premier Solar Corp"}</div>
              <div className="text-[11px] text-white/40 flex items-center gap-1.5">
                <Building2 className="w-3 h-3 text-[#FF6600]" />
                {profile?.city || "Mumbai"}, {profile?.state || "MH"}
              </div>
              <div className="inline-flex items-center gap-1 text-[9px] text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-['JetBrains_Mono',monospace] tracking-wide">
                <CheckCircle2 className="w-2.5 h-2.5" /> GSTIN Verified
              </div>
            </div>

            {/* Nav */}
            <nav className="space-y-1" role="navigation" aria-label="Dashboard navigation">
              {[
                { key: "leads",    label: "Leads Pipeline",  icon: <Users       className="w-4 h-4" /> },
                { key: "settings", label: "Partner Settings", icon: <SettingsIcon className="w-4 h-4" /> },
              ].map(item => (
                <button
                  key={item.key}
                  onClick={() => setNav(item.key as any)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[12px] font-medium transition-all duration-150 cursor-pointer border",
                    activeNav === item.key
                      ? "text-[#FF6600] border-[#FF6600]/25 bg-[#FF6600]/10"
                      : "text-white/40 border-transparent hover:text-white/70 hover:bg-white/[0.04]"
                  )}
                  aria-current={activeNav === item.key ? "page" : undefined}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
              <button
                onClick={() => navigate("/map")}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[12px] font-medium text-white/40 hover:text-white/70 hover:bg-white/[0.04] border border-transparent transition-all duration-150 cursor-pointer"
              >
                <Zap className="w-4 h-4 text-[#FF6600]" />
                <span>Run Rooftop Scan</span>
              </button>
            </nav>
          </div>

          {/* Sign Out */}
          <button
            onClick={() => { signOut(); navigate("/"); }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-[12px] text-red-400/70 hover:text-red-400 hover:bg-red-500/[0.06] border border-transparent transition-all duration-150 cursor-pointer mt-6"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden relative z-10">

        {/* Header */}
        <header className="px-6 py-5 border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          style={{ background: "rgba(2,2,3,0.5)", backdropFilter: "blur(20px)" }}
        >
          <div>
            <h1 className="font-['Calistoga',serif] text-2xl text-white tracking-tight flex items-center gap-3">
              Leads Pipeline
              <span className="text-[11px] font-['Inter',sans-serif] font-semibold text-[#FF6600] bg-[#FF6600]/10 border border-[#FF6600]/20 px-2.5 py-0.5 rounded-full">
                5 Active
              </span>
            </h1>
            <p className="text-[12px] text-white/35 mt-0.5">Manage inbound rooftop solar quote requests.</p>
          </div>
          <button
            onClick={() => navigate("/map")}
            className="shrink-0 flex items-center gap-2 h-10 px-5 rounded-xl text-[12px] font-bold text-black transition-all duration-200 active:scale-[0.97] cursor-pointer border-none"
            style={{
              background: "linear-gradient(135deg, #FF6600 0%, #FF8C38 100%)",
              boxShadow: "0 0 24px rgba(255,102,0,0.2)",
            }}
          >
            <Zap className="w-3.5 h-3.5" />
            + Run Roof Scan
          </button>
        </header>

        {/* KPI Cards */}
        <section className="px-6 py-5 border-b border-white/[0.06]">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {KPI_CARDS.map((k, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl border border-white/[0.07] hover:border-white/[0.12] transition-all duration-200 group"
                style={{ background: "rgba(255,255,255,0.03)", boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-white/35 font-semibold uppercase tracking-widest font-['JetBrains_Mono',monospace]">{k.label}</span>
                  {k.icon}
                </div>
                <div className={cn("text-xl font-['Calistoga',serif] tracking-tight", k.accent)}>{k.value}</div>
                <div className="text-[10px] text-white/30 mt-0.5">{k.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Kanban Board */}
        <section className="flex-1 p-6 overflow-x-auto">
          <div className="flex gap-4 min-w-[1100px] h-full pb-4">
            {COLUMNS.map(col => {
              const colLeads = leads.filter(l => l.status === col.key);
              return (
                <div key={col.key} className="flex-1 min-w-[240px] max-w-[300px] flex flex-col">
                  {/* Column Header */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("w-1.5 h-1.5 rounded-full", col.dot)} />
                      <span className="text-[11px] font-semibold text-white/60 uppercase tracking-widest">{col.label}</span>
                    </div>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", col.color)}>
                      {colLeads.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 space-y-3 overflow-y-auto max-h-[600px] pr-0.5">
                    {colLeads.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 rounded-2xl border border-dashed border-white/[0.06] text-white/20 text-[11px] gap-2">
                        <span>No leads here</span>
                      </div>
                    ) : colLeads.map(lead => (
                      <div
                        key={lead.id}
                        className="p-4 rounded-2xl border border-white/[0.07] hover:border-[#FF6600]/30 hover:scale-[1.01] transition-all duration-200 group"
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
                          transformOrigin: "center",
                        }}
                      >
                        {/* Name + Info */}
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="text-[13px] font-semibold text-white group-hover:text-[#FF6600] transition-colors duration-150">{lead.name}</div>
                            <div className="text-[11px] text-white/35 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" />{lead.phone}
                            </div>
                          </div>
                          <button
                            onClick={() => setModal(lead)}
                            className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/30 hover:text-white transition-all duration-150 cursor-pointer"
                            aria-label={`View details for ${lead.name}`}
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Address */}
                        <div className="text-[11px] text-white/40 flex items-start gap-1.5 mb-3 leading-snug">
                          <MapPin className="w-3 h-3 text-[#FF6600] shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{lead.address}</span>
                        </div>

                        {/* Metrics */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="p-2 rounded-xl border border-white/[0.06] bg-white/[0.02] text-center">
                            <div className="text-[9px] text-white/30 font-['JetBrains_Mono',monospace] uppercase">Roof Area</div>
                            <div className="text-[12px] font-semibold text-white mt-0.5">{lead.roofArea} m²</div>
                          </div>
                          <div className="p-2 rounded-xl border border-white/[0.06] bg-white/[0.02] text-center">
                            <div className="text-[9px] text-white/30 font-['JetBrains_Mono',monospace] uppercase">Est. Solar</div>
                            <div className="text-[12px] font-semibold text-[#FF6600] mt-0.5">{lead.estimatedKw} kWp</div>
                          </div>
                        </div>

                        {/* Value */}
                        <div className="flex items-center justify-between text-[11px] mb-3">
                          <span className="text-white/35">Project Value</span>
                          <span className="font-bold text-emerald-400 font-['JetBrains_Mono',monospace]">₹{lead.roiLakh}L</span>
                        </div>

                        {/* Actions */}
                        {lead.status === "new" ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => moveLeadStatus(lead.id, "contacted")}
                              className="flex-1 py-1.5 rounded-xl text-[11px] font-semibold bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25 transition-all duration-150 cursor-pointer"
                            >Accept</button>
                            <button
                              onClick={() => moveLeadStatus(lead.id, "won_lost")}
                              className="py-1.5 px-3 rounded-xl text-[11px] font-semibold bg-red-500/10 border border-red-500/20 text-red-400/70 hover:bg-red-500/20 transition-all duration-150 cursor-pointer"
                            >Skip</button>
                          </div>
                        ) : (
                          <select
                            value={lead.status}
                            onChange={e => moveLeadStatus(lead.id, e.target.value as Lead["status"])}
                            className="w-full px-3 py-1.5 text-[11px] rounded-xl border border-white/[0.08] bg-[#050506] text-white/60 focus:outline-none focus:border-[#FF6600]/50 cursor-pointer transition-all duration-150"
                          >
                            <option value="new">→ New</option>
                            <option value="contacted">→ Contacted</option>
                            <option value="site_visit">→ Site Visit</option>
                            <option value="quoted">→ Quoted</option>
                            <option value="won_lost">→ Won / Closed</option>
                          </select>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* ── Lead Detail Modal ─────────────────────────────────────── */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(16px)" }}
          onClick={(e) => e.target === e.currentTarget && setModal(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-white/[0.08] p-6 space-y-5"
            style={{
              background: "rgba(10,10,12,0.95)",
              boxShadow: "0 40px 120px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)",
              backdropFilter: "blur(32px)",
            }}
          >
            <div className="flex items-start justify-between border-b border-white/[0.06] pb-4">
              <div>
                <h3 className="font-['Calistoga',serif] text-xl text-white">{modal.name}</h3>
                <div className="text-[11px] text-white/35 flex items-center gap-1.5 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-[#FF6600]" />{modal.address}
                </div>
              </div>
              <button
                onClick={() => setModal(null)}
                className="text-white/30 hover:text-white p-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] transition-all duration-150 cursor-pointer"
                aria-label="Close modal"
              >✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Phone", value: modal.phone, accent: "text-white" },
                { label: "System Size", value: `${modal.estimatedKw} kWp`, accent: "text-[#FF6600]" },
                { label: "Roof Area", value: `${modal.roofArea} m²`, accent: "text-white" },
                { label: "Project Value", value: `₹${modal.roiLakh}L`, accent: "text-emerald-400" },
              ].map((item, i) => (
                <div key={i} className="p-3 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                  <div className="text-[9px] text-white/30 font-['JetBrains_Mono',monospace] uppercase mb-1">{item.label}</div>
                  <div className={cn("text-[14px] font-semibold font-['JetBrains_Mono',monospace]", item.accent)}>{item.value}</div>
                </div>
              ))}
            </div>

            {modal.activities && modal.activities.length > 0 && (
              <div>
                <div className="text-[10px] text-white/30 font-semibold uppercase tracking-widest mb-2">Activity Timeline</div>
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {modal.activities.map((act, i) => (
                    <div key={i} className="text-[11px] flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                      <span className="text-white/60">{act.description}</span>
                      <span className="text-white/25 font-['JetBrains_Mono',monospace] text-[9px] shrink-0 ml-3">{act.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setModal(null)}
              className="w-full h-10 rounded-xl text-[12px] font-semibold text-white/60 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] transition-all duration-150 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
