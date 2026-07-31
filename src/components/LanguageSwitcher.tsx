import { useTranslation } from "react-i18next";
import { Globe, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { SUPPORTED_LANGS } from "@/i18n";
import { track } from "@/lib/analytics";

const LanguageSwitcher = ({
  className = "",
  align = "right",
  transparent = false,
}: { className?: string; align?: "left" | "right"; transparent?: boolean }) => {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = SUPPORTED_LANGS.find((l) => l.code === i18n.language.split("-")[0]) || SUPPORTED_LANGS[0];

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const change = (code: string) => {
    i18n.changeLanguage(code);
    track("Language Changed", { lang: code });
    setOpen(false);
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-10 h-10 rounded-xl flex items-center justify-center active:scale-95 transition-all border ${
          transparent
            ? "bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20"
            : "bg-[#0A0A0A] border-white/10 text-white hover:bg-white/5"
        }`}
        aria-label="Change language"
        aria-expanded={open}
      >
        <Globe className="w-4 h-4 text-[#FF6600]" />
      </button>
      {open && (
        <div
          role="listbox"
          className={`absolute ${align === "left" ? "left-0" : "right-0"} mt-2 w-48 bg-[#0A0A0A]/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_20px_rgba(255,102,0,0.1)] p-1.5 overflow-hidden z-[2000] animate-in fade-in-0 slide-in-from-top-1 duration-150`}
        >
          {SUPPORTED_LANGS.map((l) => (
            <button
              key={l.code}
              role="option"
              aria-selected={l.code === current.code}
              onClick={() => change(l.code)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer border border-transparent ${
                l.code === current.code
                  ? "bg-[#FF6600]/10 text-[#FF6600] font-semibold border-[#FF6600]/20"
                  : "text-white/80 hover:bg-white/5 hover:text-white"
              }`}
            >
              <div className="flex flex-col items-start">
                <span className="font-sans font-medium">{l.native}</span>
                <span className="text-[10px] font-mono text-white/40">{l.label}</span>
              </div>
              {l.code === current.code && <Check className="w-3.5 h-3.5 text-[#FF6600]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;

