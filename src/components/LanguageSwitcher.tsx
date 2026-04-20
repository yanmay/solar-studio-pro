import { useTranslation } from "react-i18next";
import { Globe, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { SUPPORTED_LANGS } from "@/i18n";
import { track } from "@/lib/analytics";

const LanguageSwitcher = ({ className = "" }: { className?: string }) => {
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
        className="w-10 h-10 rounded-lg bg-sunpower-bg-card shadow-card flex items-center justify-center hover:bg-secondary active:scale-95 transition-all"
        aria-label="Change language"
        aria-expanded={open}
      >
        <Globe className="w-4 h-4 text-sunpower-text-primary" />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 mt-2 w-44 bg-sunpower-bg-card border border-foreground/[0.08] rounded-xl shadow-float overflow-hidden z-[2000] animate-fade-in"
        >
          {SUPPORTED_LANGS.map((l) => (
            <button
              key={l.code}
              role="option"
              aria-selected={l.code === current.code}
              onClick={() => change(l.code)}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-foreground/[0.04] transition-colors ${
                l.code === current.code ? "text-sunpower-accent font-medium" : "text-sunpower-text-primary"
              }`}
            >
              <div className="flex flex-col items-start">
                <span>{l.native}</span>
                <span className="text-[10px] text-sunpower-text-muted">{l.label}</span>
              </div>
              {l.code === current.code && <Check className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
