import { useState } from "react";
import { Check, X, Sparkles, Zap, RefreshCw } from "lucide-react";

export type SubscriptionPlan = "pro_monthly" | "pro_annual";

interface PricingModalProps {
  open: boolean;
  onClose: () => void;
  currentTier?: string;
  busy?: boolean;
  onSubscribe: (plan: SubscriptionPlan) => void;
}

const MONTHLY_INR = 3500;
const ANNUAL_INR = Math.round(MONTHLY_INR * 12 * 0.85); // ₹35,700 (15% off)

const FREE_FEATURES = [
  "10 leads delivered / month",
  "SolarScan-branded PDF reports",
  "Standard email support",
];

const PRO_FEATURES = [
  "Unlimited lead delivery",
  "White-label reports (your logo & domain)",
  "Priority rating-weighted lead routing",
  "Follow-up reminders & overdue alerts",
  "WhatsApp proposal sharing",
  "Cancel anytime — no annual lock-in",
];

export function PricingModal({ open, onClose, currentTier, busy, onSubscribe }: PricingModalProps) {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  if (!open) return null;

  const isPro = currentTier === "pro";
  const plan: SubscriptionPlan = billing === "annual" ? "pro_annual" : "pro_monthly";
  const priceLabel =
    billing === "annual"
      ? `₹${ANNUAL_INR.toLocaleString("en-IN")}/yr`
      : `₹${MONTHLY_INR.toLocaleString("en-IN")}/mo`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Choose a plan"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl border p-6 md:p-8"
        style={{ background: "#16140f", borderColor: "#3a352b" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-neutral-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-1 mb-6">
          <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "Sora, sans-serif" }}>
            Choose your plan
          </h2>
          <p className="text-xs text-neutral-400 font-mono">
            Upgrade for unlimited leads and white-label reports. Cancel anytime.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex rounded-lg border p-1 font-mono text-[11px]" style={{ borderColor: "#3a352b" }}>
            <button
              onClick={() => setBilling("monthly")}
              className={`px-4 py-1.5 rounded-md font-bold uppercase tracking-wider transition-all ${billing === "monthly" ? "text-black" : "text-neutral-400"}`}
              style={{ background: billing === "monthly" ? "#ffb87b" : "transparent" }}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("annual")}
              className={`px-4 py-1.5 rounded-md font-bold uppercase tracking-wider transition-all ${billing === "annual" ? "text-black" : "text-neutral-400"}`}
              style={{ background: billing === "annual" ? "#ffb87b" : "transparent" }}
            >
              Annual · save 15%
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Free card */}
          <div className="rounded-xl border p-5 flex flex-col" style={{ borderColor: "#3a352b", background: "#1c1a14" }}>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-orange-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-white">Free Trial</h3>
            </div>
            <div className="text-2xl font-bold text-white mb-4" style={{ fontFamily: "Sora, sans-serif" }}>
              ₹0<span className="text-xs text-neutral-400 font-mono">/mo</span>
            </div>
            <ul className="space-y-2 flex-1">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-neutral-300 font-mono">
                  <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-neutral-500" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              disabled
              className="mt-5 w-full py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl font-mono border"
              style={{ borderColor: "#3a352b", color: "#9a948a", cursor: "default" }}
            >
              {isPro ? "Downgrade via Cancel" : "Current Plan"}
            </button>
          </div>

          {/* Pro card */}
          <div className="rounded-xl border-2 p-5 flex flex-col relative" style={{ borderColor: "#ffb87b", background: "#1c1a14" }}>
            <span className="absolute -top-2.5 right-4 text-[9px] font-bold uppercase tracking-wider font-mono px-2 py-0.5 rounded-full text-black" style={{ background: "#ffb87b" }}>
              Recommended
            </span>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-white">Pro</h3>
            </div>
            <div className="text-2xl font-bold text-white mb-1" style={{ fontFamily: "Sora, sans-serif" }}>
              {priceLabel}
            </div>
            {billing === "annual" && (
              <div className="text-[10px] text-emerald-400 font-mono mb-3">
                ₹{Math.round(ANNUAL_INR / 12).toLocaleString("en-IN")}/mo effective · save ₹{(MONTHLY_INR * 12 - ANNUAL_INR).toLocaleString("en-IN")}/yr
              </div>
            )}
            <ul className="space-y-2 flex-1 mt-1">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-neutral-200 font-mono">
                  <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-400" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => onSubscribe(plan)}
              disabled={busy || isPro}
              className="mt-5 w-full py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl font-mono text-black hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
              style={{ background: "#ffb87b" }}
            >
              {busy ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Activating...
                </>
              ) : isPro ? (
                "You're on Pro"
              ) : (
                `Subscribe — ${priceLabel}`
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-[10px] text-neutral-500 font-mono mt-5">
          Sandbox checkout — no payment gateway connected. Activation is immediate for testing.
        </p>
      </div>
    </div>
  );
}

export default PricingModal;
