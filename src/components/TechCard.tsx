interface TechCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const TechCard = ({ icon, title, description }: TechCardProps) => {
  return (
    <div
      className="bg-urja-bg-card rounded-lg shadow-card p-6 text-center transition-all duration-300 hover:-translate-y-1.5 hover:shadow-float cursor-default group"
      role="article"
      aria-label={`${title}: ${description}`}
    >
      <div className="flex justify-center mb-3 text-urja-text-muted transition-all duration-300 group-hover:text-urja-accent group-hover:scale-110" aria-hidden="true">
        {icon}
      </div>
      <h4 className="text-[15px] font-medium text-urja-text-primary mb-1">{title}</h4>
      <p className="text-sm text-urja-text-secondary">{description}</p>
    </div>
  );
};

export default TechCard;
