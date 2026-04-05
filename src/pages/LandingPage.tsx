import { Sun, Zap, BarChart3, Leaf } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import FeatureCard from "@/components/FeatureCard";
import TechCard from "@/components/TechCard";

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="hero-gradient min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-3xl mx-auto flex flex-col items-center gap-6">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Sun className="w-12 h-12 text-urja-accent" />
            <h1 className="font-display text-[clamp(36px,5vw,52px)] text-white tracking-tight">
              URJA LINK
            </h1>
          </div>

          {/* Subheading */}
          <p className="text-xl text-white/90 max-w-lg">
            Empowering Every Roof with Solar Intelligence
          </p>

          {/* Body copy */}
          <p className="text-[15px] text-white/75 max-w-[520px] leading-relaxed">
            AI-powered rooftop analysis that instantly estimates your solar energy potential, savings, and environmental impact — all from a satellite view of your roof.
          </p>

          {/* CTA */}
          <Button variant="hero" onClick={() => navigate("/map")} className="mt-2">
            Analyze Your Rooftop →
          </Button>

          {/* Feature Cards */}
          <div className="flex flex-col sm:flex-row gap-4 mt-8 w-full max-w-[760px]">
            <FeatureCard
              icon={<Zap className="w-8 h-8" />}
              title="Energy Estimation"
              description="Precise annual kWh generation forecast"
            />
            <FeatureCard
              icon={<BarChart3 className="w-8 h-8" />}
              title="Financial Savings"
              description="Monthly and yearly cost savings analysis"
            />
            <FeatureCard
              icon={<Leaf className="w-8 h-8" />}
              title="Green Impact"
              description="CO₂ reduction and environmental benefits"
            />
          </div>
        </div>
      </section>

      {/* SolarNet Technology Section */}
      <section className="py-20 px-4 bg-background">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="font-display text-4xl gradient-text mb-3">SolarNet Technology</h2>
          <p className="text-[15px] text-urja-text-secondary max-w-[600px] mx-auto mb-12">
            Our proprietary AI model combines satellite imagery analysis with local solar irradiance data to deliver precise rooftop solar assessments.
          </p>

          {/* TechCards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
            <TechCard
              icon={<svg className="w-12 h-12" viewBox="0 0 48 48" fill="none"><rect x="8" y="8" width="32" height="32" rx="4" stroke="currentColor" strokeWidth="2"/><path d="M8 24h32M24 8v32" stroke="currentColor" strokeWidth="2"/></svg>}
              title="Satellite Analysis"
              description="High-resolution imagery processed by neural networks"
            />
            <TechCard
              icon={<svg className="w-12 h-12" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="16" stroke="currentColor" strokeWidth="2"/><path d="M24 8v32M8 24h32M12 12l24 24M36 12L12 36" stroke="currentColor" strokeWidth="1.5" opacity="0.5"/></svg>}
              title="Irradiance Mapping"
              description="Local solar radiation data from weather stations"
            />
            <TechCard
              icon={<svg className="w-12 h-12" viewBox="0 0 48 48" fill="none"><path d="M12 36V24l6-8 6 6 6-10 6 8v16H12z" stroke="currentColor" strokeWidth="2" fill="none"/></svg>}
              title="Yield Prediction"
              description="Machine learning models trained on 10,000+ installations"
            />
            <TechCard
              icon={<svg className="w-12 h-12" viewBox="0 0 48 48" fill="none"><rect x="6" y="14" width="36" height="24" rx="3" stroke="currentColor" strokeWidth="2"/><path d="M16 14V10a8 8 0 0116 0v4" stroke="currentColor" strokeWidth="2"/><circle cx="24" cy="26" r="3" fill="currentColor"/></svg>}
              title="Secure & Private"
              description="Your data is encrypted and never shared with third parties"
            />
          </div>

          {/* How SolarNet Works */}
          <h3 className="font-display text-2xl text-urja-text-primary mb-10">How SolarNet Works</h3>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-center gap-8 md:gap-4 max-w-3xl mx-auto">
            {[
              { num: 1, title: "Search Location", desc: "Enter your address to locate your rooftop on the satellite map" },
              { num: 2, title: "Draw Rooftop", desc: "Trace the outline of your rooftop using the polygon drawing tool" },
              { num: 3, title: "Get Results", desc: "Receive instant solar potential analysis with energy and savings data" },
            ].map((step, i) => (
              <div key={step.num} className="flex md:flex-col items-center md:items-center gap-4 md:gap-3 flex-1">
                {/* Connector line (desktop only) */}
                {i > 0 && (
                  <div className="hidden md:block absolute" />
                )}
                <div className="w-8 h-8 rounded-full bg-urja-accent text-urja-accent-text flex items-center justify-center text-sm font-semibold shrink-0">
                  {step.num}
                </div>
                <div className="text-left md:text-center">
                  <div className="text-[15px] font-medium text-urja-text-primary">{step.title}</div>
                  <div className="text-sm text-urja-text-secondary mt-0.5">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="mt-16">
            <Button variant="cta" onClick={() => navigate("/map")}>
              Get Started — It's Free →
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
