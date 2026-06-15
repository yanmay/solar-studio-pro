interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureCard = ({ icon, title, description }: FeatureCardProps) => {
  return (
    <div
      className="rounded-xl sm:rounded-2xl p-3 sm:p-8 text-center transition-all duration-300 hover:-translate-y-1.5 bg-white/10 hover:bg-white/15 backdrop-blur-xl border border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_8px_32px_rgba(0,0,0,0.1)] flex-1 sm:min-w-[200px] cursor-default group relative overflow-hidden"
      role="article"
      aria-label={`${title}: ${description}`}
    >
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      <div className="flex justify-center mb-2 sm:mb-4 text-sunpower-accent drop-shadow-[0_0_8px_rgba(245,158,11,0.5)] transition-transform duration-300 group-hover:scale-110" aria-hidden="true">
        {icon}
      </div>
      <h3 className="text-[11px] sm:text-lg font-medium text-white mb-0.5 sm:mb-1 font-body leading-tight">{title}</h3>
      <p className="hidden sm:block text-sm text-white/70">{description}</p>
    </div>
  );
};

export default FeatureCard;
