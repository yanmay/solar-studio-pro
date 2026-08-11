import { MapPin, Zap, Home, Wallet, CalendarClock, Gauge } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  LEAD_STATUS_META,
  LEAD_STATUS_ORDER,
  formatInrLakh,
  type Lead,
  type LeadStatus,
} from "@/lib/installer-leads";
import { LeadStatusBadge } from "./LeadStatusBadge";

interface LeadDetailSheetProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMoveStatus: (id: string, status: LeadStatus) => void;
}

interface Metric {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
}

/**
 * Lead detail drawer — the single replacement for the old in-dashboard modal AND
 * the broken `/installer/lead/:leadId` page. Ports the CRM's richer drawer ideas
 * (metrics grid, activity timeline, reminder, status control) onto a shadcn
 * `Sheet`. Controlled by the dashboard so status changes stay in one state tree.
 */
export function LeadDetailSheet({ lead, open, onOpenChange, onMoveStatus }: LeadDetailSheetProps) {
  if (!lead) return null;

  const metrics: Metric[] = [
    { label: "System Size", value: lead.system_size_kwp != null ? `${lead.system_size_kwp} kWp` : "—", icon: <Zap className="h-3.5 w-3.5" />, accent: "text-[#FF6600]" },
    { label: "Roof Area", value: lead.total_roof_area_sqm != null ? `${lead.total_roof_area_sqm} m²` : "—", icon: <Home className="h-3.5 w-3.5" />, accent: "text-white" },
    { label: "Project Value", value: formatInrLakh(lead.capex_estimate), icon: <Wallet className="h-3.5 w-3.5" />, accent: "text-emerald-400" },
    { label: "Payback", value: lead.payback_years != null ? `${lead.payback_years} yrs` : "—", icon: <Gauge className="h-3.5 w-3.5" />, accent: "text-cyan-400" },
    { label: "Annual Yield", value: lead.annual_production_kwh != null ? `${lead.annual_production_kwh.toLocaleString("en-IN")} kWh` : "—", icon: <Zap className="h-3.5 w-3.5" />, accent: "text-white" },
    { label: "PM Surya Subsidy", value: formatInrLakh(lead.pm_surya_subsidy), icon: <Wallet className="h-3.5 w-3.5" />, accent: "text-emerald-400" },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto border-white/[0.08] bg-[#0a0a0c] text-white"
      >
        <SheetHeader className="text-left">
          <div className="flex items-center gap-2">
            <SheetTitle className="font-['Calistoga',serif] text-xl text-white">
              {lead.homeowner_name}
            </SheetTitle>
            <LeadStatusBadge status={lead.assignment_status} />
          </div>
          <SheetDescription className="flex items-center gap-1.5 text-white/40">
            <MapPin className="h-3.5 w-3.5 text-[#FF6600] shrink-0" />
            {lead.address ?? "Address unavailable"}
          </SheetDescription>
          <a
            href={`tel:${lead.homeowner_phone}`}
            className="mt-1 inline-block font-mono text-[13px] text-white/60 hover:text-[#FF6600] transition-colors"
          >
            {lead.homeowner_phone}
          </a>
        </SheetHeader>

        <Separator className="my-5 bg-white/[0.06]" />

        {/* Status control */}
        <div className="space-y-2">
          <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">
            Pipeline stage
          </span>
          <Select
            value={lead.assignment_status}
            onValueChange={(value) => onMoveStatus(lead.id, value as LeadStatus)}
          >
            <SelectTrigger className="h-10 bg-white/[0.03] border-white/[0.08] text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_STATUS_ORDER.map((status) => (
                <SelectItem key={status} value={status} className="text-[13px]">
                  {LEAD_STATUS_META[status].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Metrics grid */}
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3"
            >
              <div className="mb-1 flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-white/30 font-mono">
                {m.icon}
                {m.label}
              </div>
              <div className={`text-[15px] font-semibold font-mono ${m.accent}`}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Confidence */}
        {lead.confidence_level && (
          <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">
              Confidence · {lead.confidence_level}
            </div>
            {lead.confidence_reason && (
              <p className="mt-1 text-[12px] text-white/55 leading-snug">{lead.confidence_reason}</p>
            )}
          </div>
        )}

        {/* Reminder */}
        {lead.reminder_date && (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-[#FF6600]/20 bg-[#FF6600]/[0.06] p-3">
            <CalendarClock className="h-4 w-4 text-[#FF6600] shrink-0 mt-0.5" />
            <div>
              <div className="text-[12px] font-semibold text-white">
                Reminder · {lead.reminder_date}
              </div>
              {lead.reminder_note && (
                <p className="mt-0.5 text-[12px] text-white/50">{lead.reminder_note}</p>
              )}
            </div>
          </div>
        )}

        {/* Activity timeline */}
        {lead.activities && lead.activities.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 text-[10px] uppercase tracking-widest text-white/40 font-semibold">
              Activity timeline
            </div>
            <div className="space-y-2">
              {lead.activities.map((act, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.03] p-2.5"
                >
                  <span className="text-[12px] text-white/60">{act.description}</span>
                  <span className="ml-3 shrink-0 font-mono text-[9px] text-white/25">{act.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
