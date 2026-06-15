import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  AreaChart,
  AreaSeries,
  Area,
  Gradient,
  GradientStop,
  LinearXAxis,
  LinearXAxisTickSeries,
  LinearXAxisTickLabel,
  LinearYAxis,
  LinearYAxisTickSeries,
  GridlineSeries,
  Gridline,
} from "reaviz";

const Count = ({
  className,
  to,
  suffix = "",
}: {
  className?: string;
  to: number;
  suffix?: string;
}) => {
  return <span className={className}>{to.toLocaleString()}{suffix}</span>;
};

const generateChartData = (days: number, maxVal: number = 50) => {
  const data = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    data.push({
      key: date,
      data: Math.floor(Math.random() * maxVal) + maxVal * 0.3,
    });
  }
  return data;
};

interface IncidentReportCardProps {
  isDarkMode?: boolean;
  installedKw?: number;
  annualKwh?: number;
  savings25yr?: number;
  lcoe?: number;
  irr?: number;
  paybackPeriod?: number;
}

export const Component = ({
  isDarkMode = true,
  installedKw = 12.4,
  annualKwh = 18240,
  savings25yr = 84000,
  lcoe = 2.76,
  irr = 36.55,
  paybackPeriod = 4.1,
}: IncidentReportCardProps) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState("last-7-days");

  const areaSingleSeriesSimpleData = useMemo(() => {
    switch (selectedTimeRange) {
      case "last-7-days": return generateChartData(7, installedKw * 4);
      case "last-30-days": return generateChartData(30, installedKw * 4.5);
      case "last-90-days": return generateChartData(90, installedKw * 5);
      default: return generateChartData(7, installedKw * 4);
    }
  }, [selectedTimeRange, installedKw]);

  const chartColorScheme = isDarkMode ? "#40D3F4" : "#2563EB";
  const axisTickColor = isDarkMode ? "#9A9AAF" : "#6B7280";
  const gridlineColor = isDarkMode ? "#7E7E8F75" : "#D1D5DB75"; 

  const criticalBgOpacity = isDarkMode ? "bg-[rgb(232,64,69)]/40" : "bg-red-100";
  const totalBgOpacity = isDarkMode ? "bg-[rgb(64,229,209)]/40" : "bg-teal-100";

  const metricIconFill = isDarkMode ? "#40D3F4" : "#2563EB";

  const metricBadgeRectFillRed = isDarkMode ? "rgb(232 64 69)" : "rgb(254 226 226)";
  const metricBadgeRectFillOpacityRed = isDarkMode ? 0.4 : 1;
  const metricBadgeArrowStrokeRed = isDarkMode ? "#F08083" : "rgb(220 38 38)";

  const metricBadgeRectFillTeal = isDarkMode ? "rgb(64 229 209)" : "rgb(204 251 241)";
  const metricBadgeRectFillOpacityTeal = isDarkMode ? 0.4 : 1;
  const metricBadgeArrowStrokeTeal = isDarkMode ? "#40E5D1" : "rgb(13 148 136)";

  return (
    <div
      className={cn(
        "flex flex-col justify-between pt-4 pb-4 rounded-3xl overflow-hidden w-full max-w-[600px] h-[714px] text-left",
        "bg-black text-white shadow-xl border border-white/5 shadow-[11px_21px_3px_rgba(0,0,0,0.06),14px_27px_7px_rgba(0,0,0,0.10),19px_38px_14px_rgba(0,0,0,0.13),27px_54px_27px_rgba(0,0,0,0.16),39px_78px_50px_rgba(0,0,0,0.20),55px_110px_86px_rgba(0,0,0,0.26)]"
      )}
    >
      <div className="flex justify-between items-center p-7 pt-6 pb-8">
        <h3 className="text-3xl text-left font-bold tracking-tight">
          Solar Performance
        </h3>
        <select
          value={selectedTimeRange}
          onChange={(e) => setSelectedTimeRange(e.target.value)}
          className={cn(
            "p-3 pt-2 pb-2 rounded-md appearance-none focus:outline-none focus:ring-2 cursor-pointer",
            "bg-[#262631] text-white border-transparent focus:ring-blue-400"
          )}
        >
          <option value="last-7-days">Weekly Yield</option>
          <option value="last-30-days">Monthly Climatology</option>
          <option value="last-90-days">25-Yr Projection</option>
        </select>
      </div>

      <div className="px-4 flex justify-center">
        <AreaChart
          height={200}
          width={540}
          data={areaSingleSeriesSimpleData}
          series={
            <AreaSeries
              area={
                <Area
                  gradient={
                    <Gradient
                      stops={[
                        <GradientStop key="1" stopOpacity={0} />,
                        <GradientStop key="2" offset="100%" stopOpacity={isDarkMode ? 0.4 : 0.2} />, 
                      ]}
                    />
                  }
                />
              }
              colorScheme={chartColorScheme}
            />
          }
          xAxis={
            <LinearXAxis
              type="time"
              tickSeries={
                <LinearXAxisTickSeries
                  label={
                    <LinearXAxisTickLabel
                      format={(v: Date) =>
                        new Date(v).toLocaleDateString("en-US", {
                          month: "numeric",
                          day: "numeric",
                        })
                      }
                      fill={axisTickColor}
                    />
                  }
                  tickSize={30}
                />
              }
            />
          }
          yAxis={
            <LinearYAxis
              axisLine={null}
              tickSeries={
                <LinearYAxisTickSeries line={null} label={null} tickSize={20} />
              }
            />
          }
          gridlines={
            <GridlineSeries line={<Gridline strokeColor={gridlineColor} />} />
          }
        />
      </div>

      <div className="flex w-full pl-8 pr-8 justify-between pb-2 pt-8">
        <div className="flex flex-col gap-2 w-1/2">
          <span className="text-xl text-white">Annual Energy Yield</span>
          <div className="flex items-center gap-2">
            <Count
              className="font-mono text-4xl font-semibold text-[#40D3F4]" 
              to={Math.round(annualKwh)}
              suffix=" kWh"
            />
          </div>
          <span className="text-sm text-[#9A9AAF]">
            Estimated year-1 production
          </span>
        </div>
        <div className="flex flex-col gap-2 w-1/2">
          <span className="text-xl text-white">25-Yr Net Gain</span>
          <div className="flex items-center gap-2">
            <Count
              className="font-mono text-4xl font-semibold text-[#40E5D1]"
              to={Math.round(savings25yr)}
            />
          </div>
          <span className="text-sm text-[#9A9AAF]">
            Lifetime cumulative savings
          </span>
        </div>
      </div>

      <div className="flex flex-col pl-8 pr-8 font-mono divide-y divide-[#262631]">
        {[
          { title: "Levelized Cost of Energy", value: `₹${lcoe.toFixed(2)} / kWh`, type: "critical" },
          { title: "Projected IRR", value: `${irr.toFixed(2)}%`, type: "critical" },
          { title: "Investment Payback", value: `${paybackPeriod.toFixed(2)} Years`, type: "improvement" },
        ].map((item, index) => (
          <div
            key={index}
            className="flex w-full pb-4 pt-4 items-center gap-2"
          >
            <div className="flex flex-row gap-2 items-center text-base w-1/2 text-[#9A9AAF]">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10.0001 2.10535C9.35241 2.10535 8.70472 2.42118 8.35459 3.05343L1.9044 14.7063C1.22414 15.9354 2.14514 17.5 3.5499 17.5H16.4511C17.8559 17.5 18.7769 15.9354 18.0966 14.7063L11.6456 3.05343C11.2955 2.42118 10.6478 2.10535 10.0001 2.10535ZM10.0001 3.31222C10.212 3.31222 10.4237 3.42739 10.5519 3.65889L17.0029 15.3117C17.2501 15.7585 16.9605 16.25 16.4511 16.25H3.5499C3.04051 16.25 2.7509 15.7585 2.99815 15.3117L9.44834 3.65889C9.57655 3.42739 9.78821 3.31222 10.0001 3.31222Z"
                           fill={metricIconFill} />
              </svg>
              <span className="truncate" title={item.title}>
                {item.title}
              </span>
            </div>
            <div className="flex gap-2 w-1/2 justify-end items-center">
              <span className="font-semibold text-xl">
                {item.value}
              </span>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="28" height="28" rx="14" 
                  fill={item.type === "critical" ? metricBadgeRectFillTeal : metricBadgeRectFillTeal} 
                  fillOpacity={item.type === "critical" ? metricBadgeRectFillOpacityTeal : metricBadgeRectFillOpacityTeal} 
                />
                <path 
                  d={item.type === "critical" ? "M18.4987 15.3889L13.9987 19.8334M13.9987 19.8334L9.49866 15.3889M13.9987 19.8334V8.16671" : "M18.4987 15.3889L13.9987 19.8334M13.9987 19.8334L9.49866 15.3889M13.9987 19.8334V8.16671"} 
                  stroke={item.type === "critical" ? metricBadgeArrowStrokeTeal : metricBadgeArrowStrokeTeal} 
                  strokeWidth="2" strokeLinecap="square" />
              </svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
