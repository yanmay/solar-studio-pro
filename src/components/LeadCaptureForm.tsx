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
    .regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile (starts 6-9)"),
  city: z.string().min(2, "City required").max(60),
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

// Simple in-browser persistence — replace with API call later
function persistLead(lead: LeadForm & { context?: LeadCaptureFormProps["context"]; ts: string }) {
  try {
    const existing = JSON.parse(localStorage.getItem("sunpower-leads") || "[]");
    existing.push(lead);
    localStorage.setItem("sunpower-leads", JSON.stringify(existing));
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
    defaultValues: { name: "", phone: "", city: "", consent: undefined as unknown as true },
  });

  const onSubmit = async (values: LeadForm) => {
    // Simulate network latency — replace with real fetch('/api/leads', ...)
    await new Promise((r) => setTimeout(r, 600));
    persistLead({ ...values, context, ts: new Date().toISOString() });
    track("Lead Submitted", { kw: context?.kw ?? 0, city: values.city });
    setSubmitted(true);
    toast({
      title: "Request received",
      description: "An MNRE-empanelled installer will call you within 24 hours.",
    });
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      // Reset for next open
      setTimeout(() => {
        setSubmitted(false);
        reset();
      }, 200);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        {!submitted ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-sunpower-accent" />
                Get a free installation quote
              </DialogTitle>
              <DialogDescription>
                A verified solar installer in your city will call you with a custom quote
                {context?.kw ? ` for your ${context.kw} kWp system` : ""}. No spam, no obligation.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
              <div>
                <label htmlFor="lead-name" className="block text-sm font-medium text-sunpower-text-primary mb-1">
                  Full name
                </label>
                <input
                  id="lead-name"
                  type="text"
                  autoComplete="name"
                  {...register("name")}
                  className="w-full px-3 py-2.5 rounded-lg border border-foreground/[0.1] bg-background text-sunpower-text-primary outline-none focus:ring-2 focus:ring-sunpower-accent transition-all"
                  placeholder="Your name"
                />
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label htmlFor="lead-phone" className="block text-sm font-medium text-sunpower-text-primary mb-1">
                  Mobile number
                </label>
                <div className="flex">
                  <span className="px-3 py-2.5 rounded-l-lg border border-r-0 border-foreground/[0.1] bg-foreground/[0.04] text-sm text-sunpower-text-muted">+91</span>
                  <input
                    id="lead-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={10}
                    {...register("phone")}
                    className="flex-1 px-3 py-2.5 rounded-r-lg border border-foreground/[0.1] bg-background text-sunpower-text-primary outline-none focus:ring-2 focus:ring-sunpower-accent transition-all"
                    placeholder="98765 43210"
                  />
                </div>
                {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone.message}</p>}
              </div>

              <div>
                <label htmlFor="lead-city" className="block text-sm font-medium text-sunpower-text-primary mb-1">
                  City
                </label>
                <input
                  id="lead-city"
                  type="text"
                  autoComplete="address-level2"
                  {...register("city")}
                  defaultValue={context?.location?.split(",")[0]?.trim() || ""}
                  className="w-full px-3 py-2.5 rounded-lg border border-foreground/[0.1] bg-background text-sunpower-text-primary outline-none focus:ring-2 focus:ring-sunpower-accent transition-all"
                  placeholder="Pune, Bengaluru, Delhi…"
                />
                {errors.city && <p className="text-xs text-destructive mt-1">{errors.city.message}</p>}
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...register("consent")}
                  className="mt-1 w-4 h-4 accent-sunpower-accent shrink-0"
                />
                <span className="text-xs text-sunpower-text-muted leading-snug">
                  I agree to be contacted by SUNPOWER LINK and partner installers about
                  this solar quote. My number will not be sold or used for unrelated marketing.
                </span>
              </label>
              {errors.consent && <p className="text-xs text-destructive -mt-2">{errors.consent.message}</p>}

              <Button type="submit" variant="cta" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…</>
                ) : (
                  <>Get my free quote →</>
                )}
              </Button>

              <div className="flex items-center gap-2 text-[11px] text-sunpower-text-muted justify-center">
                <ShieldCheck className="w-3 h-3" />
                Only MNRE-empanelled installers · TRAI-compliant
              </div>
            </form>
          </>
        ) : (
          <div className="py-6 text-center">
            <div className="w-14 h-14 rounded-full bg-sunpower-success/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-sunpower-success" />
            </div>
            <DialogTitle className="text-xl mb-2">You're on the list</DialogTitle>
            <DialogDescription>
              A verified solar installer in your city will call you within 24 hours with a
              tailored quote. Meanwhile, you can download your detailed PDF report or share
              this analysis with family.
            </DialogDescription>
            <Button variant="ghost" className="mt-6" onClick={() => handleClose(false)}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default LeadCaptureForm;
