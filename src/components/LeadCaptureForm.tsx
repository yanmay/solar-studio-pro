import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Loader2, PhoneCall, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { track } from "@/lib/analytics";

// ─── Schema ─────────────────────────────────────────────────
const leadSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(60),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian WhatsApp number (starts 6-9)"),
  city: z.string().min(2, "City required").max(60),
  preferredTime: z.string().min(1, "Please select preferred contact time"),
  ownsProperty: z.literal(true, { errorMap: () => ({ message: "You must own the property to proceed" }) }),
  consent: z.literal(true, { errorMap: () => ({ message: "Required to share your details" }) }),
});

type LeadForm = z.infer<typeof leadSchema>;

interface LeadCaptureFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Context attached to the lead (analysis id, kw, location). */
  context?: {
    analysisId?: string;
    kw?: number;
    location?: string;
  };
}

function persistLead(lead: LeadForm & { context?: LeadCaptureFormProps["context"]; ts: string; status: string }) {
  try {
    const existing = JSON.parse(localStorage.getItem("sunpower-leads") || "[]");
    existing.push(lead);
    localStorage.setItem("sunpower-leads", JSON.stringify(existing));
    
    // Also append directly to installer-leads cache for immediate Kanban simulation visibility!
    const installerLeads = JSON.parse(localStorage.getItem("solarsan-installer-leads") || "[]");
    const nextLeadId = `lead-${Date.now()}`;
    installerLeads.unshift({
      id: nextLeadId,
      name: lead.name,
      phone: lead.phone,
      address: lead.context?.location || lead.city,
      roofArea: lead.context?.kw ? Math.round(lead.context.kw * 9.6) : 100,
      estimatedKw: lead.context?.kw || 10,
      roiLakh: lead.context?.kw ? lead.context.kw * 1.2 : 12,
      source: "SolarScan B2C",
      status: "new",
      date: new Date().toISOString().split('T')[0],
      preferredTime: lead.preferredTime,
      ownsProperty: true
    });
    localStorage.setItem("solarsan-installer-leads", JSON.stringify(installerLeads));

  } catch {
    /* ignore */
  }
}

const LeadCaptureForm = ({ open, onOpenChange, context }: LeadCaptureFormProps) => {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<LeadForm>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: "",
      phone: "",
      city: context?.location?.split(",")[0]?.trim() || "",
      preferredTime: "morning",
      ownsProperty: undefined as unknown as true,
      consent: undefined as unknown as true
    },
  });

  const onSubmit = async (values: LeadForm) => {
    try {
      // 1. Submit lead request
      const leadId = `lead-${Date.now()}`;
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          name: values.name,
          phone: values.phone,
          city: values.city,
          systemKwp: context?.kw,
          scanId: context?.analysisId,
          preferredTime: values.preferredTime,
          ownsProperty: true,
          status: 'new'
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to submit request");
      }

      // 2. Trigger automatic lead distribution
      await fetch("/api/leads/distribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          city: values.city,
          systemKwp: context?.kw
        })
      }).catch(() => {
        // distribute fails are non-fatal to user experience
      });

      persistLead({ ...values, context, ts: new Date().toISOString(), status: 'distributed' });
      track("Lead Submitted", { kw: context?.kw ?? 0, city: values.city });
      setSubmitted(true);
      toast({
        title: "Request Received",
        description: "Your quote request has been distributed to 3 verified installers.",
      });
    } catch (err) {
      toast({
        title: "Could not submit request",
        description: err instanceof Error ? err.message : "Please try again in a moment.",
        variant: "destructive",
      });
    }
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      setTimeout(() => {
        setSubmitted(false);
        reset();
      }, 200);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md bg-[#0A0A0A] border border-white/10 rounded-3xl text-white p-6 sm:p-8 backdrop-blur-2xl shadow-2xl">
        {!submitted ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5 text-lg font-bold text-white">
                <div className="w-8 h-8 rounded-xl bg-[#FF6600]/10 border border-[#FF6600]/20 text-[#FF6600] flex items-center justify-center">
                  <PhoneCall className="w-4 h-4" />
                </div>
                <span>Get 3 Verified Installer Quotes</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-white/50 leading-relaxed font-light mt-1">
                We match your layout coordinates with top MNRE-empanelled installers in your area. Get custom quotes in minutes.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4 text-xs font-mono">
              <div>
                <label htmlFor="lead-name" className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">
                  Full Name *
                </label>
                <input
                  id="lead-name"
                  type="text"
                  autoComplete="name"
                  {...register("name")}
                  className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder:text-white/20 outline-none focus:border-[#FF6600]/60 focus:ring-2 focus:ring-[#FF6600]/20 transition-all font-mono"
                  placeholder="Your full name"
                />
                {errors.name && <p className="text-[10px] text-red-400 mt-1 font-mono">{errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="lead-phone" className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">
                    WhatsApp Number *
                  </label>
                  <div className="flex">
                    <span className="px-3 py-3 rounded-l-xl border border-r-0 border-white/10 bg-white/5 text-xs text-white/40 font-mono">+91</span>
                    <input
                      id="lead-phone"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      maxLength={10}
                      {...register("phone")}
                      className="flex-1 p-3 rounded-r-xl border border-white/10 bg-white/[0.04] text-white placeholder:text-white/20 outline-none focus:border-[#FF6600]/60 focus:ring-2 focus:ring-[#FF6600]/20 transition-all font-mono"
                      placeholder="98765 43210"
                    />
                  </div>
                  {errors.phone && <p className="text-[10px] text-red-400 mt-1 font-mono">{errors.phone.message}</p>}
                </div>

                <div>
                  <label htmlFor="lead-city" className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">
                    City *
                  </label>
                  <input
                    id="lead-city"
                    type="text"
                    autoComplete="address-level2"
                    {...register("city")}
                    className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder:text-white/20 outline-none focus:border-[#FF6600]/60 focus:ring-2 focus:ring-[#FF6600]/20 transition-all font-mono"
                    placeholder="e.g. Mumbai"
                  />
                  {errors.city && <p className="text-[10px] text-red-400 mt-1 font-mono">{errors.city.message}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="preferred-time" className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">
                  Preferred Contact Time
                </label>
                <select
                  id="preferred-time"
                  {...register("preferredTime")}
                  className="w-full p-3 rounded-xl bg-neutral-900 border border-white/10 text-white outline-none focus:border-[#FF6600]/60 transition-all font-mono"
                >
                  <option value="morning">Morning (9 AM - 12 PM)</option>
                  <option value="afternoon">Afternoon (12 PM - 4 PM)</option>
                  <option value="evening">Evening (4 PM - 8 PM)</option>
                </select>
                {errors.preferredTime && <p className="text-[10px] text-red-400 mt-1 font-mono">{errors.preferredTime.message}</p>}
              </div>

              <div className="space-y-2.5 pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register("ownsProperty")}
                    className="mt-0.5 w-3.5 h-3.5 accent-[#FF6600] shrink-0 cursor-pointer"
                  />
                  <span className="text-[10px] text-white/50 leading-snug font-mono">
                    I verify that I own this property and have authority to install solar panels.
                  </span>
                </label>
                {errors.ownsProperty && <p className="text-[10px] text-red-400 font-mono">{errors.ownsProperty.message}</p>}

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register("consent")}
                    className="mt-0.5 w-3.5 h-3.5 accent-[#FF6600] shrink-0 cursor-pointer"
                  />
                  <span className="text-[10px] text-white/50 leading-snug font-mono">
                    I consent to share my layout coordinates and contact with 3 verified partners.
                  </span>
                </label>
                {errors.consent && <p className="text-[10px] text-red-400 font-mono">{errors.consent.message}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-xl bg-[#FF6600] hover:bg-orange-500 text-black text-xs font-bold font-mono uppercase tracking-wider transition-all cursor-pointer border-none shadow-lg shadow-[#FF6600]/20 flex items-center justify-center gap-2 mt-4 active:scale-95"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin text-black" /> Submitting…</>
                ) : (
                  <>Request Quotes — Free</>
                )}
              </button>

              <div className="flex items-center gap-2 text-[10px] text-white/40 justify-center font-mono pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Only MNRE-empanelled partners · Spam-free guarantee
              </div>
            </form>
          </>
        ) : (
          <div className="py-6 text-center space-y-4 font-mono">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <DialogTitle className="text-lg font-bold text-white">Quotes Requested Successfully</DialogTitle>
            <DialogDescription className="text-xs text-white/50 leading-relaxed font-mono">
              Your rooftop model has been dispatched. Up to three matched installers in your area will contact you during your preferred time window.
            </DialogDescription>
            <button
              onClick={() => handleClose(false)}
              className="mt-4 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-mono uppercase tracking-wider transition-all cursor-pointer border border-white/10"
            >
              Back to Analysis
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

};

export default LeadCaptureForm;
