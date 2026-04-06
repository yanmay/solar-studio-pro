interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureCard = ({ icon, title, description }: FeatureCardProps) => {
  return (
    <div
      className="glass-card rounded-xl p-6 text-center transition-all duration-300 hover:-translate-y-1.5 hover:bg-white/[0.18] hover:shadow-[0_8px_32px_rgba(255,255,255,0.1)] flex-1 min-w-[200px] cursor-default group"
      role="article"
      aria-label={`${title}: ${description}`}
    >
      <div className="flex justify-center mb-3 text-urja-accent transition-transform duration-300 group-hover:scale-110" aria-hidden="true">
        {icon}
      </div>
      <h3 className="text-lg font-medium text-white mb-1 font-body">{title}</h3>
      <p className="text-sm text-white/70">{description}</p>
    </div>
  );
};

export default FeatureCard;
