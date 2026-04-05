import { cn } from "@/lib/utils";

interface MetricCardProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  subLabel: string;
  valueColor: string;
  className?: string;
  delay?: number;
}

const MetricCard = ({ icon, iconBg, label, value, subLabel, valueColor, className, delay = 0 }: MetricCardProps) => {
  return (
    <div
      className={cn(
        "bg-urja-bg-card rounded-lg shadow-card p-5 animate-fade-slide-up",
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-9 h-9 rounded-md flex items-center justify-center"
          style={{ backgroundColor: iconBg }}
        >
          {icon}
        </div>
        <span className="text-sm text-urja-text-secondary">{label}</span>
      </div>
      <div className="font-mono text-[32px] font-semibold leading-tight" style={{ color: valueColor }}>
        {value}
      </div>
      <div className="text-[13px] text-urja-text-muted mt-1">{subLabel}</div>
    </div>
  );
};

export default MetricCard;
