interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureCard = ({ icon, title, description }: FeatureCardProps) => {
  return (
    <div className="glass-card rounded-xl p-6 text-center transition-all duration-200 hover:-translate-y-1 hover:bg-white/[0.18] flex-1 min-w-[200px]">
      <div className="flex justify-center mb-3 text-urja-accent">{icon}</div>
      <h3 className="text-lg font-medium text-white mb-1 font-body">{title}</h3>
      <p className="text-sm text-white/70">{description}</p>
    </div>
  );
};

export default FeatureCard;
