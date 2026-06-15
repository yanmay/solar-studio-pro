import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface MetricCardProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  subLabel: string;
  valueColor: string; // Kept for backwards compatibility but we will rely on clean theme colors
  className?: string;
  delay?: number;
}

const MetricCard = ({ icon, iconBg, label, value, subLabel, className }: MetricCardProps) => {
  return (
    <Card
      className={cn(
        "bg-card/60 backdrop-blur-md border border-border rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:hover:shadow-primary/5 hover:border-primary/25",
        className
      )}
      role="article"
      aria-label={`${label}: ${value}`}
    >
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground/80 shrink-0"
            style={{ backgroundColor: iconBg }}
            aria-hidden="true"
          >
            {icon}
          </div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
        <div className="font-mono text-2xl font-bold tracking-tight text-foreground">
          {value}
        </div>
      </div>
      <div className="text-[11px] text-muted-foreground mt-3 pt-2 border-t border-border/50">
        {subLabel}
      </div>
    </Card>
  );
};

export default MetricCard;
