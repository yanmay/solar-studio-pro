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
        "bg-sunpower-bg-card rounded-lg shadow-card p-5 animate-fade-slide-up",
        "transition-all duration-200 hover:shadow-float hover:-translate-y-1",
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
      role="article"
      aria-label={`${label}: ${value}`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-9 h-9 rounded-md flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
          style={{ backgroundColor: iconBg }}
          aria-hidden="true"
        >
          {icon}
        </div>
        <span className="text-sm text-sunpower-text-secondary">{label}</span>
      </div>
      <div className="font-mono text-[32px] font-semibold leading-tight" style={{ color: valueColor }}>
        {value}
      </div>
      <div className="text-[13px] text-sunpower-text-muted mt-1">{subLabel}</div>
    </div>
  );
};

export default MetricCard;
