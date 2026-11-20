import { AnimatePresence, motion, type Variants } from "framer-motion";
import { ArrowLeft, Home, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Globe } from "@/components/ui/cosmic-404";

// ui-ux-pro-max — expo.out easing: cubic-bezier(0.16,1,0.3,1)
const EXPO_OUT = [0.16, 1, 0.3, 1] as const;

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.7, ease: EXPO_OUT }
  },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const globeVariants: Variants = {
  hidden: { scale: 0.85, opacity: 0, y: 12 },
  visible: {
    scale: 1, opacity: 1, y: 0,
    transition: { duration: 0.9, ease: EXPO_OUT }
  },
  floating: {
    y: [-4, 4],
    transition: { duration: 5, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" },
  },
};

export interface NotFoundProps {
  title?: string;
  description?: string;
  backText?: string;
  onBack?: () => void;
}

export default function NotFound({
  title = "Lost in the void",
  description = "We couldn't find the page you're looking for. It may have been moved, deleted, or the URL is incorrect.",
  backText = "Go Back",
  onBack,
}: NotFoundProps) {
  const navigate = useNavigate();

  const handleBack = onBack || (() => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  });

  return (
    <div className="relative min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center px-4 overflow-hidden selection:bg-[#FF6600]/30">
      {/* Ambient Glow Blobs — ui-ux-pro-max cinematic dark */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div
          className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full blur-[130px] opacity-[0.08]"
          style={{ background: "#FF6600", animation: "blob404-1 20s ease-in-out infinite alternate" }}
        />
        <div
          className="absolute bottom-[-15%] right-[-5%] w-[500px] h-[500px] rounded-full blur-[110px] opacity-[0.05]"
          style={{ background: "#FF8B3D", animation: "blob404-2 24s ease-in-out infinite alternate" }}
        />
      </div>
      <style>{`
        @keyframes blob404-1 { to { transform: translate(50px, 70px) scale(1.15); } }
        @keyframes blob404-2 { to { transform: translate(-40px, -30px) scale(1.1); } }
      `}</style>

      <AnimatePresence mode="wait">
        <motion.div
          className="relative z-10 text-center flex flex-col items-center justify-center max-w-lg"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={stagger}
        >
          {/* 404 row — Calistoga display font */}
          <motion.div
            className="flex items-center justify-center gap-4 sm:gap-8 mb-10"
            variants={fadeUp}
          >
            <span
              className="text-7xl sm:text-9xl font-bold select-none"
              style={{ fontFamily: "'Outfit', sans-serif", color: "#FF6600", textShadow: "0 0 60px rgba(255,102,0,0.3)" }}
            >
              4
            </span>

            <motion.div
              className="relative w-20 h-20 sm:w-32 sm:h-32 flex items-center justify-center"
              variants={globeVariants}
              animate={["visible", "floating"]}
            >
              <Globe className="w-full h-full scale-110 sm:scale-125" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,102,0,0.12)_0%,transparent_70%)]" />
            </motion.div>

            <span
              className="text-7xl sm:text-9xl font-bold select-none"
              style={{ fontFamily: "'Outfit', sans-serif", color: "#FF6600", textShadow: "0 0 60px rgba(255,102,0,0.3)" }}
            >
              4
            </span>
          </motion.div>

          {/* Bento status badge */}
          <motion.div variants={fadeUp}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-[10px] font-mono font-bold text-white/40 uppercase tracking-[0.12em] mb-5">
              <MapPin className="w-3 h-3 text-[#FF6600]" />
              <span>Route Not Found</span>
            </div>
          </motion.div>

          {/* Headline — Calistoga for human warmth */}
          <motion.h1
            className="mb-4 text-3xl sm:text-5xl text-white leading-tight"
            style={{ fontFamily: "'Calistoga', serif", fontWeight: 400 }}
            variants={fadeUp}
          >
            {title}
          </motion.h1>

          {/* Description — Inter body */}
          <motion.p
            className="mb-10 text-sm sm:text-base text-white/50 max-w-sm leading-relaxed font-light"
            variants={fadeUp}
          >
            {description}
          </motion.p>

          {/* CTA Buttons */}
          <motion.div variants={fadeUp} className="flex items-center gap-3 flex-wrap justify-center">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-xs font-mono font-bold uppercase tracking-wider hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer active:scale-[0.97]"
              style={{ transition: "all 200ms cubic-bezier(0.16,1,0.3,1)" }}
            >
              <ArrowLeft className="w-4 h-4" />
              {backText}
            </button>
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl text-black text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer active:scale-[0.97] border-none"
              style={{
                background: "linear-gradient(135deg, #FF6600 0%, #FF8C38 100%)",
                boxShadow: "0 0 28px rgba(255,102,0,0.3)",
                transition: "all 200ms cubic-bezier(0.16,1,0.3,1)",
              }}
            >
              <Home className="w-4 h-4" />
              Take Me Home
            </button>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
