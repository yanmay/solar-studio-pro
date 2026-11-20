import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { track } from "@/lib/analytics";

// Browser BeforeInstallPromptEvent typing (not in lib.dom.d.ts)
interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "sunpower-pwa-dismissed-at";
const REPROMPT_DAYS = 30;

const PwaInstallPrompt = () => {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Suppress for users who dismissed recently
    const dismissedAt = parseInt(localStorage.getItem(DISMISSED_KEY) || "0", 10);
    const recentlyDismissed = dismissedAt && (Date.now() - dismissedAt) < REPROMPT_DAYS * 86400000;
    if (recentlyDismissed) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
      // Delay surfacing so it doesn't fire during initial page load
      setTimeout(() => { setOpen(true); track("PWA Install Shown"); }, 6000);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setOpen(false);
    setEvt(null);
  };

  const install = async () => {
    if (!evt) return;
    await evt.prompt();
    const choice = await evt.userChoice;
    if (choice.outcome === "accepted") track("PWA Install Accepted");
    setOpen(false);
    setEvt(null);
  };

  if (!open || !evt) return null;

  return (
    <div className="fixed bottom-5 left-4 right-4 sm:left-auto sm:right-6 sm:w-[360px] z-[9999] animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
      <div className="bg-[#0A0A0A]/95 backdrop-blur-3xl border border-white/15 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_30px_rgba(255,102,0,0.15)] p-4.5 text-white relative overflow-hidden">
        {/* Top glowing hairline */}
        <div
          className="absolute top-0 left-0 right-0 h-px rounded-t-3xl opacity-60 pointer-events-none"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,102,0,0.5), transparent)" }}
          aria-hidden="true"
        />

        <button
          onClick={dismiss}
          className="absolute top-3 right-3 p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors border-none bg-transparent cursor-pointer"
          aria-label="Dismiss install prompt"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3.5 pr-6">
          <div className="w-10 h-10 rounded-2xl bg-[#FF6600]/10 border border-[#FF6600]/20 text-[#FF6600] flex items-center justify-center shrink-0">
            <Download className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white tracking-tight">Install SUNPOWER LINK</div>
            <div className="text-xs text-white/50 mt-1 leading-normal font-light">
              Add to home screen — works offline with faster instant GIS spatial scans.
            </div>
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={install}
                className="flex-1 bg-[#FF6600] hover:bg-orange-500 text-black text-xs font-bold font-mono uppercase tracking-wider py-2.5 rounded-xl active:scale-95 transition-all border-none shadow-lg shadow-[#FF6600]/20 cursor-pointer"
              >
                Install App
              </button>
              <button
                onClick={dismiss}
                className="text-xs font-mono text-white/40 hover:text-white px-3 py-2 transition-colors cursor-pointer bg-transparent border-none"
              >
                Not Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PwaInstallPrompt;

