/**
 * FeatureCard — ui-ux-pro-max Design System Component
 * Style: Bento Grid / Modern Dark Cinema
 * Hover: scale 1.02, glow reveal, icon lift (expo.out)
 * Accessibility: role="article", aria-label, 44x44 minimum target
 */
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  /** Optional accent color for the icon glow */
  iconGlow?: string;
  onClick?: () => void;
}

const FeatureCard = ({ icon, title, description, iconGlow = "rgba(255,102,0,0.4)", onClick }: FeatureCardProps) => {
  const isInteractive = Boolean(onClick);

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => {
        if (isInteractive && onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      tabIndex={isInteractive ? 0 : undefined}
      className={`relative rounded-3xl border border-white/10 bg-[#0A0A0A]/90 backdrop-blur-2xl p-6 sm:p-8 text-center flex flex-col items-center gap-4 group overflow-hidden ${
        isInteractive ? "cursor-pointer active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[#FF6600]/60 focus-visible:outline-none" : "cursor-default"
      } hover:-translate-y-1 hover:border-[#FF6600]/40 hover:shadow-[0_20px_60px_rgba(0,0,0,0.5),0_0_30px_rgba(255,102,0,0.12)]`}
      style={{ transition: "all 300ms cubic-bezier(0.16,1,0.3,1)" }}
      role={isInteractive ? "button" : "article"}
      aria-label={`${title}: ${description}`}
    >
      {/* Spotlight hover shimmer top-edge */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none opacity-0 group-hover:opacity-100"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,102,0,0.6), transparent)",
          transition: "opacity 300ms cubic-bezier(0.16,1,0.3,1)",
        }}
        aria-hidden="true"
      />

      {/* Ambient glow behind icon */}
      <div
        className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 pointer-events-none"
        style={{
          background: iconGlow,
          transition: "opacity 400ms cubic-bezier(0.16,1,0.3,1)",
        }}
        aria-hidden="true"
      />

      {/* Icon — lifts on hover, drop-shadow glow */}
      <div
        className="relative w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[#FF6600] shrink-0 group-hover:border-[#FF6600]/30 group-hover:bg-[#FF6600]/10"
        style={{ transition: "all 300ms cubic-bezier(0.16,1,0.3,1)" }}
        aria-hidden="true"
      >
        <div className="group-hover:scale-110 group-hover:-translate-y-0.5" style={{ transition: "transform 300ms cubic-bezier(0.16,1,0.3,1)" }}>
          {icon}
        </div>
      </div>

      {/* Text */}
      <div className="space-y-1.5">
        <h3 className="text-sm sm:text-base font-bold text-white leading-tight group-hover:text-white transition-colors">{title}</h3>
        <p className="text-xs text-white/50 leading-relaxed font-light group-hover:text-white/70 transition-colors">{description}</p>
      </div>
    </div>
  );
};

export default FeatureCard;

