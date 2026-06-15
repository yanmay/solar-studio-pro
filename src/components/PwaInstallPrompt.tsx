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
    <div className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:w-[340px] z-[9999] animate-fade-in">
      <div className="bg-sunpower-bg-card/95 backdrop-blur-xl border border-foreground/[0.08] rounded-2xl shadow-float p-4">
        <button
          onClick={dismiss}
          className="absolute top-2 right-2 p-1 text-sunpower-text-muted hover:text-sunpower-text-primary"
          aria-label="Dismiss install prompt"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-start gap-3 pr-5">
          <div className="w-10 h-10 rounded-lg bg-sunpower-accent/10 flex items-center justify-center shrink-0">
            <Download className="w-5 h-5 text-sunpower-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-sunpower-text-primary">Install SUNPOWER LINK</div>
            <div className="text-xs text-sunpower-text-muted mt-0.5 leading-snug">
              Add to home screen — works offline, opens like an app, faster start.
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={install}
                className="flex-1 bg-sunpower-accent text-sunpower-accent-text text-sm font-medium py-2 rounded-lg hover:opacity-95 active:scale-95 transition-all"
              >
                Install
              </button>
              <button
                onClick={dismiss}
                className="text-xs text-sunpower-text-muted px-2"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PwaInstallPrompt;
