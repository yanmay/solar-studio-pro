"use client";

import { AnimatePresence, motion, type Variants } from "framer-motion";
import { ArrowLeftIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Globe } from "@/components/ui/cosmic-404";

// 🎞️ Animation Variants
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.9, ease: "easeOut" } },
};

const globeVariants: Variants = {
  hidden: { scale: 0.85, opacity: 0, y: 10 },
  visible: {
    scale: 1,
    opacity: 1,
    y: 0,
    transition: { duration: 1, ease: "easeOut" },
  },
  floating: {
    y: [-4, 4],
    transition: {
      duration: 5,
      ease: "easeInOut",
      repeat: Infinity,
      repeatType: "reverse",
    },
  },
};

export interface NotFoundProps {
  title?: string;
  description?: string;
  backText?: string;
  onBack?: () => void;
}

export default function NotFound({
  title = "Ups! Lost in space",
  description = "We couldn’t find the page you’re looking for. It might have been moved or deleted.",
  backText = "Go Back",
  onBack,
}: NotFoundProps) {
  const navigate = useNavigate();

  const handleBack = onBack || (() => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  });

  return (
    <div className="flex flex-col justify-center items-center px-4 h-[100vh] bg-background text-foreground overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          className="text-center flex flex-col items-center justify-center max-w-lg"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={fadeUp}
        >
          {/* 404 Globe Row */}
          <div className="flex items-center justify-center gap-6 mb-8">
            <motion.span
              className="text-7xl md:text-8xl font-bold text-[#ffb87b] select-none font-display"
              variants={fadeUp}
              style={{ fontFamily: "Sora, sans-serif" }}
            >
              4
            </motion.span>

            <motion.div
              className="relative w-24 h-24 md:w-32 md:h-32 flex items-center justify-center"
              variants={globeVariants}
              animate={["visible", "floating"]}
            >
              <Globe className="w-full h-full scale-125 md:scale-150" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,143,0,0.08)_0%,transparent_70%)]" />
            </motion.div>

            <motion.span
              className="text-7xl md:text-8xl font-bold text-[#ffb87b] select-none font-display"
              variants={fadeUp}
              style={{ fontFamily: "Sora, sans-serif" }}
            >
              4
            </motion.span>
          </div>

          {/* Heading */}
          <motion.h1
            className="mb-4 text-2xl md:text-4xl font-semibold tracking-tight text-white font-display"
            variants={fadeUp}
            style={{ fontFamily: "Sora, sans-serif" }}
          >
            {title}
          </motion.h1>

          {/* Description */}
          <motion.p
            className="mb-10 text-sm md:text-base text-neutral-400 max-w-sm leading-relaxed"
            variants={fadeUp}
          >
            {description}
          </motion.p>

          {/* Action Button */}
          <motion.div variants={fadeUp}>
            <Button
              onClick={handleBack}
              className="gap-2 hover:scale-105 transition-all duration-500 cursor-pointer bg-[#ff8f00] text-black hover:bg-orange-500 px-6 py-2.5 font-bold rounded-full font-mono uppercase text-[11px] tracking-wider"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              {backText}
            </Button>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
