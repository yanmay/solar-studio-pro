import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, CheckCircle2, Zap, TrendingUp, BarChart2, Search } from "lucide-react";

import { useInstallerAuth } from "@/hooks/use-installer-auth";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { AppShell } from "@/components/shell/AppShell";
import { InstallerUserMenu } from "@/components/shell/InstallerUserMenu";
import { INSTALLER_NAV } from "@/lib/nav-registry";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import { makeLeadsColumns } from "@/components/installer/leads-columns";
import { LeadsKanban } from "@/components/installer/LeadsKanban";
import { LeadDetailSheet } from "@/components/installer/LeadDetailSheet";
import {
  INITIAL_LEADS,
  LEAD_STATUS_META,
  deriveKpis,
  filterLeads,
  formatInrLakh,
  updateLeadStatus,
  type Lead,
  type LeadStatus,
} from "@/lib/installer-leads";

/** Partner summary rendered in the shell sidebar footer (hidden on the icon rail). */
function PartnerFooterCard({
  companyName, city, state,
}: { companyName?: string; city?: string; state?: string }) {
  return (
    <div className="group-data-[collapsible=icon]:hidden space-y-1.5 px-1 py-1.5">
      <div className="text-[12px] font-semibold text-white truncate">{companyName || "Premier Solar Corp"}</div>
      <div className="text-[11px] text-white/40 flex items-center gap-1.5">
        <Building2 className="w-3 h-3 text-[#FF6600] shrink-0" />
        {city || "Mumbai"}, {state || "MH"}
      </div>
      <div className="inline-flex items-center gap-1 text-[9px] text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-['JetBrains_Mono',monospace] tracking-wide">
        <CheckCircle2 className="w-2.5 h-2.5" /> GSTIN Verified
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useInstallerAuth();
  const { toast } = useToast();

  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const kpis = useMemo(() => deriveKpis(leads), [leads]);
  const filtered = useMemo(() => filterLeads(leads, query), [leads, query]);

  const openLead = (lead: Lead) => {
    setSelected(lead);
    setSheetOpen(true);
  };

  const moveLeadStatus = (id: string, status: LeadStatus) => {
    setLeads((prev) => updateLeadStatus(prev, id, status));
    setSelected((prev) => (prev && prev.id === id ? { ...prev, assignment_status: status } : prev));
    toast({ title: "Pipeline updated", description: `Lead moved to ${LEAD_STATUS_META[status].label}` });
  };

  const columns = useMemo(
    () => makeLeadsColumns({ onView: openLead, onMoveStatus: moveLeadStatus }),
    // openLead/moveLeadStatus are stable enough for this mock page; leads drive re-render via `filtered`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const kpiCards = [
    { label: "This Month", value: `${kpis.total} Leads`, sub: "Active pipeline", icon: <TrendingUp className="w-4 h-4 text-emerald-400" />, accent: "text-white" },
    { label: "Conversion", value: `${kpis.conversionPct}% Won`, sub: `${kpis.won} closed`, icon: <BarChart2 className="w-4 h-4 text-[#FF6600]" />, accent: "text-emerald-400" },
    { label: "Avg Quote", value: formatInrLakh(kpis.avgProjectValueInr), sub: "Across quoted leads", icon: <Zap className="w-4 h-4 text-[#FF6600]" />, accent: "text-[#FF6600]" },
    { label: "Pipeline Value", value: formatInrLakh(kpis.pipelineValueInr), sub: "Open opportunity", icon: <TrendingUp className="w-4 h-4 text-cyan-400" />, accent: "text-cyan-400" },
  ];

  return (
    <AppShell
      nav={INSTALLER_NAV}
      profile={<InstallerUserMenu />}
      sidebarFooter={
        <PartnerFooterCard
          companyName={profile?.companyName}
          city={profile?.city}
          state={profile?.state}
        />
      }
    >
      <div className="relative min-h-full text-white font-['Inter',sans-serif] antialiased">
        {/* Ambient blobs */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
          <div className="absolute top-[-20%] left-[-10%] w-[700px] h-[700px] rounded-full opacity-[0.06] blur-[130px]"
            style={{ background: "#FF6600", animation: "dashBlob1 20s ease-in-out infinite alternate" }} />
          <div className="absolute bottom-[-15%] right-0 w-[600px] h-[600px] rounded-full opacity-[0.05] blur-[110px]"
            style={{ background: "#10B981", animation: "dashBlob2 25s ease-in-out infinite alternate" }} />
        </div>
        <style>{`
          @keyframes dashBlob1 { to { transform: translate(60px, 80px) scale(1.12); } }
          @keyframes dashBlob2 { to { transform: translate(-50px, -40px) scale(1.08); } }
        `}</style>

        {/* Page header */}
        <header className="relative z-10 px-6 py-5 border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          style={{ background: "rgba(2,2,3,0.5)", backdropFilter: "blur(20px)" }}
        >
          <div>
            <h1 className="font-['Calistoga',serif] text-2xl text-white tracking-tight flex items-center gap-3">
              Leads Pipeline
              <span className="text-[11px] font-['Inter',sans-serif] font-semibold text-[#FF6600] bg-[#FF6600]/10 border border-[#FF6600]/20 px-2.5 py-0.5 rounded-full">
                {kpis.total} Active
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

        {/* KPI cards */}
        <section className="relative z-10 px-6 py-5 border-b border-white/[0.06]">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {kpiCards.map((k) => (
              <div
                key={k.label}
                className="p-4 rounded-2xl border border-white/[0.07] hover:border-white/[0.12] transition-all duration-200"
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

        {/* Workspace: search + Tabs(DataTable, Kanban) */}
        <section className="relative z-10 p-6 space-y-4">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, phone, or address…"
              className="h-9 pl-9 bg-white/[0.03] border-white/[0.08] text-[13px] focus-visible:ring-[#FF6600]/40"
            />
          </div>

          <Tabs defaultValue="leads">
            <TabsList className="bg-white/[0.04] border border-white/[0.06]">
              <TabsTrigger value="leads" className="text-[13px] data-[state=active]:bg-[#FF6600]/15 data-[state=active]:text-[#FF6600]">
                Leads
              </TabsTrigger>
              <TabsTrigger value="pipeline" className="text-[13px] data-[state=active]:bg-[#FF6600]/15 data-[state=active]:text-[#FF6600]">
                Pipeline
              </TabsTrigger>
            </TabsList>

            <TabsContent value="leads" className="mt-4">
              <DataTable columns={columns} data={filtered} />
            </TabsContent>

            <TabsContent value="pipeline" className="mt-4">
              <LeadsKanban leads={filtered} onView={openLead} />
            </TabsContent>
          </Tabs>
        </section>
      </div>

      <LeadDetailSheet
        lead={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onMoveStatus={moveLeadStatus}
      />
    </AppShell>
  );
}
