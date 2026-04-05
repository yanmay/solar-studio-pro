import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Square, Zap, IndianRupee, Leaf, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import MetricCard from "@/components/MetricCard";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface ResultsData {
  area: number;
  usable: number;
  kw: number;
  kwh: number;
  savings: number;
  co2: number;
  dailyKwh: number;
  monthlyKwh: number;
  monthlySavings: number;
  twentyFiveYearSavings: number;
  co2_25yr: number;
  trees: number;
}

const fallbackData: ResultsData = {
  area: 150.3, usable: 112.7, kw: 14.1, kwh: 18234, savings: 127642, co2: 14952,
  dailyKwh: 49.9, monthlyKwh: 1519, monthlySavings: 10637,
  twentyFiveYearSavings: 3191050, co2_25yr: 373800, trees: 680,
};

const ResultsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [data, setData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("urja-results");
    if (stored) {
      try {
        setData(JSON.parse(stored));
      } catch {
        setData(fallbackData);
      }
    } else {
      setData(fallbackData);
    }
    // Simulate load delay for skeleton effect
    setTimeout(() => setLoading(false), 600);
  }, []);

  const handleDownload = async () => {
    setDownloading(true);
    // Mock PDF generation delay
    await new Promise(r => setTimeout(r, 2000));
    toast({ title: "PDF Report", description: "Report download will be available once the backend is connected." });
    setDownloading(false);
  };

  const d = data || fallbackData;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl gradient-text leading-tight">
              Solar Potential Analysis
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-urja-success" />
              <span className="text-sm text-urja-text-secondary">Selected Location, India</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="ghost" onClick={() => navigate("/map")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Map
            </Button>
            <Button variant="cta" onClick={handleDownload} loading={downloading}>
              <Download className="w-4 h-4 mr-1" /> Download Report
            </Button>
          </div>
        </div>

        {/* MetricCard Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-urja-bg-card rounded-lg shadow-card p-5 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-md bg-muted" />
                  <div className="h-4 w-20 bg-muted rounded" />
                </div>
                <div className="h-8 w-28 bg-muted rounded mb-2" />
                <div className="h-3 w-24 bg-muted rounded" />
              </div>
            ))
          ) : (
            <>
              <MetricCard
                icon={<Square className="w-5 h-5 text-urja-info" />}
                iconBg="hsl(211 68% 94%)"
                label="Roof Area"
                value={`${d.area} m²`}
                subLabel={`Usable: ${d.usable} m²`}
                valueColor="hsl(211 79% 42%)"
                delay={0}
              />
              <MetricCard
                icon={<Zap className="w-5 h-5" style={{ color: "#E65100" }} />}
                iconBg="#FFF3E0"
                label="Installed Capacity"
                value={`${d.kw} kW`}
                subLabel={`Annual: ${d.kwh.toLocaleString()} kWh`}
                valueColor="#E65100"
                delay={80}
              />
              <MetricCard
                icon={<IndianRupee className="w-5 h-5 text-urja-success" />}
                iconBg="hsl(88 44% 91%)"
                label="Yearly Savings"
                value={`₹${d.savings.toLocaleString()}`}
                subLabel="Based on ₹7/kWh rate"
                valueColor="hsl(122 46% 33%)"
                delay={160}
              />
              <MetricCard
                icon={<Leaf className="w-5 h-5 text-urja-success" />}
                iconBg="hsl(88 44% 91%)"
                label="CO₂ Saved"
                value={`${d.co2.toLocaleString()} kg`}
                subLabel="Environmental impact / year"
                valueColor="hsl(122 46% 33%)"
                delay={240}
              />
            </>
          )}
        </div>

        {/* System Details Panel */}
        <div className="bg-urja-bg-card rounded-lg shadow-card p-6 sm:p-8 mb-8">
          <h2 className="text-xl font-medium text-urja-text-primary mb-6">System Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-urja-accent" />
                <span className="text-[15px] font-medium text-urja-text-primary">Energy Production</span>
              </div>
              {[
                { label: "Daily Average", value: `${d.dailyKwh} kWh` },
                { label: "Monthly Average", value: `${d.monthlyKwh.toLocaleString()} kWh` },
                { label: "Annual Total", value: `${d.kwh.toLocaleString()} kWh` },
              ].map((row, i, arr) => (
                <div key={row.label} className={`flex justify-between items-center py-3 ${i < arr.length - 1 ? "border-b border-dashed border-foreground/[0.08]" : ""}`}>
                  <span className="text-sm text-urja-text-secondary">{row.label}</span>
                  <span className="font-mono font-medium text-urja-text-primary">{row.value}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-4">
                <IndianRupee className="w-5 h-5 text-urja-success" />
                <span className="text-[15px] font-medium text-urja-text-primary">Financial Impact</span>
              </div>
              {[
                { label: "Monthly Savings", value: `₹${d.monthlySavings.toLocaleString()}` },
                { label: "Annual Savings", value: `₹${d.savings.toLocaleString()}` },
                { label: "25-Year Savings", value: `₹${d.twentyFiveYearSavings.toLocaleString()}` },
              ].map((row, i, arr) => (
                <div key={row.label} className={`flex justify-between items-center py-3 ${i < arr.length - 1 ? "border-b border-dashed border-foreground/[0.08]" : ""}`}>
                  <span className="text-sm text-urja-text-secondary">{row.label}</span>
                  <span className="font-mono font-medium text-urja-success">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Environmental Impact Card */}
        <div className="bg-urja-success-light border border-urja-success/20 rounded-lg p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-3">
            <Leaf className="w-5 h-5 text-urja-success" />
            <h2 className="text-xl font-medium text-urja-text-primary">Environmental Impact</h2>
          </div>
          <p className="text-[15px] text-urja-text-secondary mb-6">
            Your solar installation will offset approximately{" "}
            <span className="font-semibold text-urja-success">{d.co2.toLocaleString()} kg</span> of CO₂ per year, equivalent to planting{" "}
            <span className="font-semibold text-urja-success">{d.trees}</span> trees.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <div className="text-sm text-urja-text-secondary mb-1">25-Year CO₂ Reduction</div>
              <div className="font-mono text-2xl font-semibold text-urja-success">{d.co2_25yr.toLocaleString()} kg</div>
            </div>
            <div>
              <div className="text-sm text-urja-text-secondary mb-1">Equivalent Trees</div>
              <div className="font-mono text-2xl font-semibold text-urja-success">{d.trees} trees</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsPage;
