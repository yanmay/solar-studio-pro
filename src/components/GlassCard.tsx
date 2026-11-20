import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * GlassCard — ui-ux-pro-max Design System Component
 * Style: Modern Dark Cinema / Bento Grid
 * OLED-safe obsidian glass panel with expo.out hover transitions
 * Supports: ambient glow, hover border reveal, spotlight effect
 */
interface GlassCardProps {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  /** Elevate on hover with a slight Y-translate */
  hover?: boolean;
  /** Make the card interactive (clickable) with cursor-pointer */
  interactive?: boolean;
  onClick?: () => void;
  role?: string;
  "aria-label"?: string;
  tabIndex?: number;
}

export function GlassCard({
  children,
  className,
  glow = false,
  hover = false,
  interactive = false,
  onClick,
  role,
  "aria-label": ariaLabel,
  tabIndex,
}: GlassCardProps) {
  return (
    <div
      role={role || (interactive ? "button" : undefined)}
      aria-label={ariaLabel}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onClick={onClick}
      onKeyDown={(e) => {
        if (interactive && onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        // Base bento card — OLED-safe dark surface
        "relative rounded-3xl border border-white/10",
        "bg-[#0A0A0A]/90 backdrop-blur-2xl p-6",
        // expo.out easing — matches ui-ux-pro-max spec
        "transition-all duration-300 ease-out",
        "shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]",
        // Focus state for accessibility
        interactive && "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6600]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]",
        // Optional hover lift
        hover && "hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_20px_60px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]",
        // Subtle orange accent reveal on hover
        hover && "hover:border-[#FF6600]/40",
        // Orange glow variant
        glow && "shadow-[0_0_40px_rgba(255,102,0,0.2),0_8px_32px_rgba(0,0,0,0.4)] border-[#FF6600]/30",
        // Interactive state
        interactive && "cursor-pointer active:scale-[0.985] active:transition-transform active:duration-100",
        className
      )}
    >
      {/* Top-edge gradient accent — subtle bento style highlight */}
      <div
        className="absolute top-0 left-0 right-0 h-px rounded-t-3xl pointer-events-none opacity-60"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)" }}
        aria-hidden="true"
      />
      {children}
    </div>
  );
}

