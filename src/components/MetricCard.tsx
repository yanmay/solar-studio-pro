import { cn } from "@/lib/utils";

/**
 * MetricCard — ui-ux-pro-max Design System Component
 * Style: Data-Dense Dashboard (Bento Grid)
 * JetBrains Mono for values, Inter for labels
 * Hover: scale 1.02, orange border reveal (150-300ms expo.out)
 */
interface MetricCardProps {
  icon: React.ReactNode;
  iconBg?: string;
  label: string;
  value: string;
  subLabel: string;
  /** Deprecated: ignored — color is handled by design tokens */
  valueColor?: string;
  className?: string;
  delay?: number;
  /** Accent color for the value: 'orange' | 'green' | 'blue' | 'purple' | 'amber' */
  accent?: "orange" | "green" | "blue" | "purple" | "amber" | "white";
  badge?: string;
  badgeType?: "positive" | "neutral" | "highlight";
}

const accentMap = {
  orange: "text-[#FF6600]",
  green: "text-emerald-400",
  blue: "text-blue-400",
  purple: "text-purple-400",
  amber: "text-amber-400",
  white: "text-white",
};

const MetricCard = ({
  icon,
  iconBg,
  label,
  value,
  subLabel,
  className,
  delay = 0,
  accent = "white",
  badge,
  badgeType = "positive",
}: MetricCardProps) => {
  const valueClass = accentMap[accent] || "text-white";

  return (
    <div
      className={cn(
        // OLED-safe dark bento card
        "relative rounded-3xl border border-white/10 bg-[#0A0A0A]/90 backdrop-blur-2xl overflow-hidden",
        "p-5 flex flex-col justify-between shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
        // expo.out transition (0.16,1,0.3,1) — ui-ux-pro-max spec
        "transition-all duration-300 ease-out",
        "hover:-translate-y-1 hover:border-[#FF6600]/40 hover:shadow-[0_0_28px_rgba(255,102,0,0.14),0_20px_60px_rgba(0,0,0,0.5)]",
        "group",
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
      role="article"
      aria-label={`${label}: ${value}`}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-px rounded-t-3xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,102,0,0.5), transparent)" }}
        aria-hidden="true"
      />

      {/* Ambient background glow on hover */}
      <div
        className="absolute -top-12 -right-12 w-28 h-28 rounded-full bg-[#FF6600]/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        aria-hidden="true"
      />

      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 border border-white/10 group-hover:border-white/20 transition-colors"
              style={{ backgroundColor: iconBg || "rgba(255,255,255,0.05)" }}
              aria-hidden="true"
            >
              {icon}
            </div>
            {/* JetBrains Mono section badge */}
            <span className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-[0.12em]">
              {label}
            </span>
          </div>

          {badge && (
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold tracking-tight border",
                badgeType === "positive" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                badgeType === "neutral" && "bg-white/5 text-white/60 border-white/10",
                badgeType === "highlight" && "bg-[#FF6600]/10 text-[#FF6600] border-[#FF6600]/20"
              )}
            >
              {badge}
            </span>
          )}
        </div>

        {/* Value: JetBrains Mono for data precision */}
        <div className={cn("font-mono text-2xl sm:text-3xl font-bold tracking-tight", valueClass)}>
          {value}
        </div>
      </div>

      <div className="text-[11px] font-mono text-white/40 mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between">
        <span>{subLabel}</span>
      </div>
    </div>
  );
};

export default MetricCard;

