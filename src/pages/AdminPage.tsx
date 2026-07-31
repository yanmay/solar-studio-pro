import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  Users,
  Activity,
  DollarSign,
  Briefcase,
  AlertTriangle,
  Download,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  Send,
  Loader2,
  ArrowLeft,
  Settings,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  ComposedChart,
  Line,
  CartesianGrid,
} from "@/components/charts";
import { ComposedBar as Bar } from "@/components/charts/ComposedChart";
import { ComposedXAxis as XAxis, ComposedYAxis as YAxis } from "@/components/charts/ComposedChart";

interface MetricCardProps {
  title: string;
  value: string | number;
  change: string;
  isPositive: boolean;
  icon: React.ReactNode;
}

function MetricCard({ title, value, change, isPositive, icon }: MetricCardProps) {
  return (
    <div className="p-6 rounded-3xl border border-white/10 bg-[#0A0A0A]/90 backdrop-blur-2xl flex justify-between items-center transition-all hover:border-[#FF6600]/40 shadow-2xl">
      <div className="space-y-1.5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 block">
          {title}
        </span>
        <h3 className="text-2xl font-bold font-mono text-white tracking-tight">
          {value}
        </h3>
        <span
          className={`text-[10px] font-mono font-bold ${
            isPositive ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {change}
        </span>
      </div>
      <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
        {icon}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Date filter state
  const [startDate, setStartDate] = useState("2026-07-01");
  const [endDate, setEndDate] = useState("2026-07-19");
  const [loadingAlert, setLoadingAlert] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Admin Console — SolarScan AI";
  }, []);

  // Mock database statistics over date range
  const [analyticsData, setAnalyticsData] = useState([
    { date: "Jul 01", dau: 450, scansStarted: 620, scansCompleted: 580, pdfSales: 12, leadSales: 24, saasInr: 9990 },
    { date: "Jul 03", dau: 480, scansStarted: 670, scansCompleted: 620, pdfSales: 15, leadSales: 28, saasInr: 9990 },
    { date: "Jul 05", dau: 520, scansStarted: 710, scansCompleted: 660, pdfSales: 18, leadSales: 32, saasInr: 19980 },
    { date: "Jul 07", dau: 580, scansStarted: 800, scansCompleted: 750, pdfSales: 22, leadSales: 40, saasInr: 19980 },
    { date: "Jul 09", dau: 610, scansStarted: 850, scansCompleted: 790, pdfSales: 25, leadSales: 45, saasInr: 29970 },
    { date: "Jul 11", dau: 680, scansStarted: 950, scansCompleted: 880, pdfSales: 31, leadSales: 52, saasInr: 29970 },
    { date: "Jul 13", dau: 720, scansStarted: 1010, scansCompleted: 940, pdfSales: 35, leadSales: 60, saasInr: 39960 },
    { date: "Jul 15", dau: 760, scansStarted: 1080, scansCompleted: 1010, pdfSales: 39, leadSales: 68, saasInr: 39960 },
    { date: "Jul 17", dau: 810, scansStarted: 1150, scansCompleted: 1070, pdfSales: 44, leadSales: 74, saasInr: 49950 },
    { date: "Jul 19", dau: 850, scansStarted: 1210, scansCompleted: 1130, pdfSales: 48, leadSales: 82, saasInr: 49950 },
  ]);

  // Aggregated totals
  const totalScansStarted = analyticsData.reduce((acc, curr) => acc + curr.scansStarted, 0);
  const totalScansCompleted = analyticsData.reduce((acc, curr) => acc + curr.scansCompleted, 0);
  const scanCompletionRate = totalScansStarted > 0 ? (totalScansCompleted / totalScansStarted) * 100 : 0;

  const totalPdfSalesCount = analyticsData.reduce((acc, curr) => acc + curr.pdfSales, 0);
  const totalLeadsCount = analyticsData.reduce((acc, curr) => acc + curr.leadSales, 0);
  const wonProjectsCount = Math.round(totalLeadsCount * 0.28);
  const installerConversionRate = 28;

  const pdfRevenue = totalPdfSalesCount * 149;
  const leadRevenue = totalLeadsCount * 1200;
  const saasRevenue = analyticsData.reduce((acc, curr) => acc + curr.saasInr, 0);
  const totalRevenue = pdfRevenue + leadRevenue + saasRevenue;

  // Funnel steps
  const funnelSteps = [
    { name: "1. Website Visitors (DAU)", value: analyticsData.reduce((acc, curr) => acc + curr.dau, 0) },
    { name: "2. Scans Completed", value: totalScansCompleted },
    { name: "3. Quote Requests (Leads)", value: totalLeadsCount },
    { name: "4. Won Projects (Solar Installed)", value: wonProjectsCount },
  ];

  // CSV Exporter
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,DAU,Scans Started,Scans Completed,PDF Sales,Lead Sales,SaaS Rev (INR)\n";
    
    analyticsData.forEach((row) => {
      csvContent += `${row.date},${row.dau},${row.scansStarted},${row.scansCompleted},${row.pdfSales},${row.leadSales},${row.saasInr}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `solar-studio-analytics_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "CSV Export Complete", description: "Analytics records exported." });
  };

  // Slack Alert Simulation
  const triggerSlackAlert = async (alertType: string, message: string) => {
    setLoadingAlert(alertType);
    try {
      await fetch("/api/alerts/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: alertType, text: message })
      });
      
      toast({
        title: "🚨 Alert Dispatched",
        description: `Alert triggered: "${message.substring(0, 40)}..."`,
      });
    } catch {
      toast({
        title: "🚨 Alert Dispatched (Simulation)",
        description: `Mock notification routed for: ${alertType}`,
      });
    } finally {
      setLoadingAlert(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans antialiased flex flex-col relative overflow-x-hidden selection:bg-[#FF6600]/30 selection:text-white pb-20">
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-15%] right-[-5%] w-[600px] h-[600px] rounded-full bg-[#FF6600]/5 blur-[140px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-2xl bg-[#050505]/85 border-b border-white/10 px-4 md:px-12 py-3">
        <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }} className="flex items-center gap-3 group">
            <img src="/logo.png" alt="SolarScan AI Logo" className="w-8 h-8 object-contain transition-transform duration-200 group-hover:scale-105" />
            <span className="text-[15px] font-bold text-white tracking-tight">
              SUNPOWER <span className="font-serif italic font-light text-[#FF6600]">LINK</span> <span className="font-mono text-xs text-white/40 font-normal">/ ADMIN</span>
            </span>
          </a>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/map")}
              className="px-3.5 py-1.5 text-xs font-semibold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all cursor-pointer"
            >
              Client App
            </button>
            <button
              onClick={() => navigate("/installer/dashboard")}
              className="px-3.5 py-1.5 text-xs font-bold text-black bg-[#FF6600] hover:bg-orange-500 rounded-xl transition-all cursor-pointer border-none shadow-lg shadow-[#FF6600]/20"
            >
              Installer Portal
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-[1280px] mx-auto w-full px-4 md:px-12 py-8 flex-1 space-y-6 relative z-10">
        
        {/* Title */}
        <section className="flex flex-col gap-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-white/5 border border-white/10 text-[#FF6600] text-xs font-mono w-fit">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>EXECUTIVE SYSTEM ANALYTICS</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            Telemetry & Revenue <span className="text-[#FF6600] font-serif italic font-light">Dashboard</span>
          </h1>
        </section>

        {/* Date Filter & Control Banner */}
        <section className="p-6 rounded-3xl border border-white/10 bg-[#0A0A0A]/90 backdrop-blur-2xl flex flex-col md:flex-row justify-between items-center gap-4 shadow-2xl">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#FF6600]" />
              <span className="text-xs font-mono text-white/40 uppercase font-bold">Range:</span>
            </div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs px-3 py-2 rounded-xl font-mono bg-white/[0.04] border border-white/10 text-white focus:outline-none focus:border-[#FF6600]/60 cursor-pointer"
            />
            <span className="text-white/40 font-mono text-xs">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs px-3 py-2 rounded-xl font-mono bg-white/[0.04] border border-white/10 text-white focus:outline-none focus:border-[#FF6600]/60 cursor-pointer"
            />
          </div>

          <button
            onClick={handleExportCSV}
            className="w-full md:w-auto px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all bg-[#FF6600] hover:bg-orange-500 text-black font-mono cursor-pointer flex items-center justify-center gap-2 border-none shadow-lg shadow-[#FF6600]/20"
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            Export CSV
          </button>
        </section>

        {/* Analytics Alert Diagnostic Panel */}
        <section className="p-6 rounded-3xl border border-white/10 bg-[#0A0A0A]/90 backdrop-blur-2xl space-y-4 shadow-2xl">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <AlertTriangle className="w-4 h-4 text-[#FF6600]" />
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-white">
              System Triggers & Alert Dispatcher
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col justify-between h-32">
              <div>
                <span className="text-[10px] font-mono font-bold text-white/40 uppercase block">Scans Inactivity Check</span>
                <p className="text-xs text-white/50 mt-1">Zero scans completed within a rolling 24 hour window.</p>
              </div>
              <button
                disabled={loadingAlert === "zero_scans"}
                onClick={() => triggerSlackAlert("zero_scans", "🚨 WARNING: Zero solar scan completions recorded on the portal in the last 24 hours.")}
                className="w-full py-2 text-[10px] font-mono uppercase tracking-wider font-bold rounded-xl flex items-center justify-center gap-1.5 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {loadingAlert === "zero_scans" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                Trigger Inactivity Alert
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col justify-between h-32">
              <div>
                <span className="text-[10px] font-mono font-bold text-white/40 uppercase block">Lead Distribution Alert</span>
                <p className="text-xs text-white/50 mt-1">Simulated alert when regional mapping fails to match installer profiles.</p>
              </div>
              <button
                disabled={loadingAlert === "lead_failed"}
                onClick={() => triggerSlackAlert("lead_failed", "🚨 CRITICAL: Lead distribution failure detected for scanned rooftop pincode.")}
                className="w-full py-2 text-[10px] font-mono uppercase tracking-wider font-bold rounded-xl flex items-center justify-center gap-1.5 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {loadingAlert === "lead_failed" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                Trigger Failure Alert
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col justify-between h-32">
              <div>
                <span className="text-[10px] font-mono font-bold text-white/40 uppercase block">API Error Rate Threshold</span>
                <p className="text-xs text-white/50 mt-1">Alert triggers automatically if REST API gateway error rate exceeds 5%.</p>
              </div>
              <button
                disabled={loadingAlert === "api_error"}
                onClick={() => triggerSlackAlert("api_error", "🚨 ALERT: Underwriting REST API gateway error rate has exceeded 5.4%.")}
                className="w-full py-2 text-[10px] font-mono uppercase tracking-wider font-bold rounded-xl flex items-center justify-center gap-1.5 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {loadingAlert === "api_error" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                Trigger Error Rate Alert
              </button>
            </div>
          </div>
        </section>

        {/* Metrics Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Daily Active Users"
            value={analyticsData[analyticsData.length - 1].dau}
            change="+8.9% from yesterday"
            isPositive={true}
            icon={<Users className="w-5 h-5 text-blue-400" />}
          />
          <MetricCard
            title="Scan Completion Rate"
            value={`${scanCompletionRate.toFixed(1)}%`}
            change={`${totalScansCompleted} / ${totalScansStarted} scans`}
            isPositive={true}
            icon={<Activity className="w-5 h-5 text-emerald-400" />}
          />
          <MetricCard
            title="Total Revenue (INR)"
            value={`₹${totalRevenue.toLocaleString()}`}
            change={`PDF: ₹${pdfRevenue.toLocaleString()} | Leads: ₹${leadRevenue.toLocaleString()}`}
            isPositive={true}
            icon={<DollarSign className="w-5 h-5 text-[#FF6600]" />}
          />
          <MetricCard
            title="Installer Won Projects"
            value={`${installerConversionRate}%`}
            change={`${wonProjectsCount} installs finalized`}
            isPositive={true}
            icon={<Briefcase className="w-5 h-5 text-purple-400" />}
          />
        </section>

        {/* Charts & Funnel Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Trends Chart */}
          <div className="p-6 rounded-3xl border border-white/10 bg-[#0A0A0A]/90 backdrop-blur-2xl lg:col-span-2 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-white">
                System Telemetry & Activity
              </h3>
              <div className="flex items-center gap-4 text-[10px] font-mono text-white/40">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-blue-400 rounded-full" /> DAU
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-[#FF6600] rounded-full" /> Scans Completed
                </span>
              </div>
            </div>

            <div className="h-64">
              <ComposedChart data={analyticsData} xDataKey="date" margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid />
                <XAxis />
                <YAxis />
                <Bar dataKey="scansCompleted" fill="#FF6600" opacity={0.7} barSize={20} radius={[4, 4, 0, 0]} />
                <Line dataKey="dau" stroke="#60A5FA" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </div>
          </div>

          {/* Conversion Funnel */}
          <div className="p-6 rounded-3xl border border-white/10 bg-[#0A0A0A]/90 backdrop-blur-2xl space-y-4 flex flex-col justify-between shadow-2xl">
            <div className="border-b border-white/5 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-white">
                Platform Conversion Funnel
              </h3>
            </div>

            <div className="space-y-4 flex-1 flex flex-col justify-center">
              {funnelSteps.map((step, idx) => {
                const prevStep = idx > 0 ? funnelSteps[idx - 1] : null;
                const conversion = prevStep ? Math.round((step.value / prevStep.value) * 100) : 100;
                
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-white">{step.name}</span>
                      <span className="text-[#FF6600] font-bold">{step.value.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-white/5 h-3 rounded-full overflow-hidden flex relative border border-white/5">
                      <div
                        style={{
                          background: idx === 0 ? "#60A5FA" : idx === 1 ? "#FF6600" : idx === 2 ? "#10B981" : "#C084FC",
                          width: `${(step.value / funnelSteps[0].value) * 100}%`
                        }}
                        className="h-full rounded-full"
                      />
                      {prevStep && (
                        <span className="absolute right-2 top-0.5 text-[8px] font-bold text-white uppercase tracking-widest font-mono">
                          {conversion}% conversion
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-white/5 pt-3 flex justify-between text-xs font-mono text-white/40">
              <span>Overall Funnel Yield:</span>
              <span className="text-emerald-400 font-bold">
                {Math.round((wonProjectsCount / funnelSteps[0].value) * 100)}%
              </span>
            </div>
          </div>
        </section>

        {/* Details Table */}
        <section className="p-6 rounded-3xl border border-white/10 bg-[#0A0A0A]/90 backdrop-blur-2xl space-y-4 shadow-2xl">
          <div className="border-b border-white/5 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-white">
              Raw Activity Telemetry Log
            </h3>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-white/10 text-white/40">
                  <th className="pb-3 px-2 font-mono uppercase text-[10px]">Date</th>
                  <th className="pb-3 px-2 font-mono uppercase text-[10px]">DAU</th>
                  <th className="pb-3 px-2 font-mono uppercase text-[10px]">Scans (Start/Comp)</th>
                  <th className="pb-3 px-2 font-mono uppercase text-[10px]">PDF Sales</th>
                  <th className="pb-3 px-2 font-mono uppercase text-[10px]">Installer Leads</th>
                  <th className="pb-3 px-2 font-mono uppercase text-[10px]">SaaS Subscriptions</th>
                  <th className="pb-3 px-2 text-right font-mono uppercase text-[10px]">Total Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {analyticsData.map((row, idx) => {
                  const dayRevenue = row.pdfSales * 149 + row.leadSales * 1200 + row.saasInr;
                  return (
                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-2 text-white font-semibold">{row.date}</td>
                      <td className="py-3 px-2 text-white/70">{row.dau}</td>
                      <td className="py-3 px-2 text-white/50">{row.scansStarted} / {row.scansCompleted}</td>
                      <td className="py-3 px-2 text-emerald-400 font-bold">{row.pdfSales} sales</td>
                      <td className="py-3 px-2 text-purple-400 font-bold">{row.leadSales} dispatches</td>
                      <td className="py-3 px-2 text-white/70">₹{(row.saasInr).toLocaleString()}</td>
                      <td className="py-3 px-2 text-right text-[#FF6600] font-bold">₹{dayRevenue.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-12 py-6 text-center border-t border-white/10 text-xs font-mono text-white/40 bg-[#050505]">
        <div className="max-w-[1280px] mx-auto px-4 md:px-12 flex justify-between items-center">
          <span>© {new Date().getFullYear()} SolarScan AI. Internal Telemetry.</span>
          <span>Access Restricted to Certified Operators</span>
        </div>
      </footer>
    </div>
  );
}
