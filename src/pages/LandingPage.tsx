import { Sun, Zap, BarChart3, Leaf } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import FeatureCard from "@/components/FeatureCard";
import TechCard from "@/components/TechCard";
import { useEffect } from "react";

const LandingPage = () => {
  const navigate = useNavigate();

  // SEO: Set document title
  useEffect(() => {
    document.title = "URJA LINK — Rooftop Solar Potential Analyser for India";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        "content",
        "AI-powered rooftop solar analysis for Indian homes. Instantly estimate your solar energy potential, financial savings, and CO₂ impact from a satellite view of your roof."
      );
    }
  }, []);

  return (
    <div className="min-h-screen" role="main">
      {/* Hero Section */}
      <section
        className="hero-gradient min-h-screen flex items-center justify-center px-4"
        aria-label="Hero — Analyze your rooftop solar potential"
      >
        <div className="text-center max-w-3xl mx-auto flex flex-col items-center gap-6">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Sun className="w-12 h-12 text-urja-accent" aria-hidden="true" />
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
            AI-powered rooftop analysis that instantly estimates your solar energy potential, savings,
            and environmental impact — all from a satellite view of your roof.
          </p>

          {/* CTA */}
          <Button
            variant="hero"
            onClick={() => navigate("/map")}
            className="mt-2 w-full sm:w-auto"
            id="hero-cta"
            aria-label="Start analyzing your rooftop solar potential"
          >
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
      <section className="py-20 px-4 bg-background" aria-label="SolarNet Technology">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="font-display text-4xl gradient-text mb-3">SolarNet Technology</h2>
          <p className="text-[15px] text-urja-text-secondary max-w-[600px] mx-auto mb-12">
            Our proprietary AI model combines satellite imagery analysis with local solar irradiance
            data to deliver precise rooftop solar assessments.
          </p>

          {/* TechCards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16" role="list" aria-label="Technology features">
            <TechCard
              icon={
                <svg className="w-12 h-12" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                  <rect x="8" y="8" width="32" height="32" rx="4" stroke="currentColor" strokeWidth="2" />
                  <path d="M8 24h32M24 8v32" stroke="currentColor" strokeWidth="2" />
                </svg>
              }
              title="Satellite Analysis"
              description="High-resolution imagery processed by neural networks"
            />
            <TechCard
              icon={
                <svg className="w-12 h-12" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                  <circle cx="24" cy="24" r="16" stroke="currentColor" strokeWidth="2" />
                  <path d="M24 8v32M8 24h32M12 12l24 24M36 12L12 36" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
                </svg>
              }
              title="Irradiance Mapping"
              description="NASA POWER satellite-derived solar radiation data"
            />
            <TechCard
              icon={
                <svg className="w-12 h-12" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                  <path d="M12 36V24l6-8 6 6 6-10 6 8v16H12z" stroke="currentColor" strokeWidth="2" fill="none" />
                </svg>
              }
              title="Yield Prediction"
              description="Machine learning models trained on 10,000+ installations"
            />
            <TechCard
              icon={
                <svg className="w-12 h-12" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                  <rect x="6" y="14" width="36" height="24" rx="3" stroke="currentColor" strokeWidth="2" />
                  <path d="M16 14V10a8 8 0 0116 0v4" stroke="currentColor" strokeWidth="2" />
                  <circle cx="24" cy="26" r="3" fill="currentColor" />
                </svg>
              }
              title="Secure & Private"
              description="Your data is encrypted and never shared with third parties"
            />
          </div>

          {/* How SolarNet Works */}
          <h3 className="font-display text-2xl text-urja-text-primary mb-10">How SolarNet Works</h3>
          <div
            className="flex flex-col md:flex-row items-start md:items-center justify-center gap-8 md:gap-4 max-w-3xl mx-auto"
            role="list"
            aria-label="Steps to use URJA LINK"
          >
            {[
              {
                num: 1,
                title: "Search Location",
                desc: "Enter your address to locate your rooftop on the satellite map",
              },
              {
                num: 2,
                title: "Draw Rooftop",
                desc: "Trace the outline of your rooftop using the polygon drawing tool",
              },
              {
                num: 3,
                title: "Get Results",
                desc: "Receive instant solar potential analysis with energy and savings data",
              },
            ].map((step, i) => (
              <div key={step.num} className="flex md:flex-col items-center md:items-center gap-4 md:gap-3 flex-1" role="listitem">
                {/* Connector line (desktop) */}
                {i > 0 && (
                  <div className="hidden md:block w-full h-[2px] bg-gradient-to-r from-urja-accent/30 to-urja-accent/10 -mt-6 mb-6" aria-hidden="true" />
                )}
                <div className="w-10 h-10 rounded-full bg-urja-accent text-urja-accent-text flex items-center justify-center text-sm font-semibold shrink-0 shadow-card transition-transform duration-200 hover:scale-110" aria-hidden="true">
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
            <Button
              variant="cta"
              onClick={() => navigate("/map")}
              className="w-full sm:w-auto"
              id="bottom-cta"
              aria-label="Get started with free rooftop solar analysis"
            >
              Get Started — It's Free →
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground/[0.03] border-t border-foreground/[0.06] py-8 px-4" role="contentinfo">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-urja-text-muted">
          <div className="flex items-center gap-2">
            <Sun className="w-4 h-4 text-urja-accent" aria-hidden="true" />
            <span>URJA LINK</span>
          </div>
          <span>© {new Date().getFullYear()} URJA LINK. Rooftop solar analysis for India.</span>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
