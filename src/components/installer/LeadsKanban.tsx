import { MapPin, Info, Phone } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LEAD_STATUS_META,
  LEAD_STATUS_ORDER,
  formatInrLakh,
  leadsByStatus,
  type Lead,
} from "@/lib/installer-leads";

interface LeadsKanbanProps {
  leads: Lead[];
  onView: (lead: Lead) => void;
}

/**
 * Pipeline Kanban — the second CRM tab. Rebuilt on shadcn `Card` with columns
 * derived from `LEAD_STATUS_ORDER`/`LEAD_STATUS_META` (the same source the table
 * badge reads), so the two views can never disagree on stage labels or colors.
 * Status moves flow through the detail Sheet, so a card only needs "View
 * details" — keeping the board read-first and the mutation path single.
 */
export function LeadsKanban({ leads, onView }: LeadsKanbanProps) {
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-4 min-w-[1200px] pb-4">
        {LEAD_STATUS_ORDER.map((status) => {
          const meta = LEAD_STATUS_META[status];
          const colLeads = leadsByStatus(leads, status);
          return (
            <div key={status} className="flex-1 min-w-[240px] max-w-[300px] flex flex-col">
              {/* Column header */}
              <div className="mb-3 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className={cn("h-1.5 w-1.5 rounded-full", meta.dotClass)} />
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-white/60">
                    {meta.label}
                  </span>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                    meta.badgeClass,
                  )}
                >
                  {colLeads.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[600px] pr-0.5">
                {colLeads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.06] py-10 text-[11px] text-white/20">
                    <span>No leads here</span>
                  </div>
                ) : (
                  colLeads.map((lead) => (
                    <Card
                      key={lead.id}
                      className="group rounded-2xl border-white/[0.07] bg-white/[0.03] p-4 shadow-[0_4px_24px_rgba(0,0,0,0.3)] transition-all duration-200 hover:border-[#FF6600]/30"
                    >
                      {/* Name + view */}
                      <div className="mb-3 flex items-start justify-between">
                        <div>
                          <div className="text-[13px] font-semibold text-white transition-colors duration-150 group-hover:text-[#FF6600]">
                            {lead.homeowner_name}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-white/35">
                            <Phone className="h-3 w-3" />
                            {lead.homeowner_phone}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onView(lead)}
                          className="h-7 w-7 rounded-lg bg-white/[0.05] text-white/30 hover:bg-white/[0.1] hover:text-white"
                          aria-label={`View details for ${lead.homeowner_name}`}
                        >
                          <Info className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Address */}
                      <div className="mb-3 flex items-start gap-1.5 text-[11px] leading-snug text-white/40">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-[#FF6600]" />
                        <span className="line-clamp-2">{lead.address ?? "Address unavailable"}</span>
                      </div>

                      {/* Metrics */}
                      <div className="mb-3 grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2 text-center">
                          <div className="font-mono text-[9px] uppercase text-white/30">Roof Area</div>
                          <div className="mt-0.5 text-[12px] font-semibold text-white">
                            {lead.total_roof_area_sqm != null ? `${lead.total_roof_area_sqm} m²` : "—"}
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2 text-center">
                          <div className="font-mono text-[9px] uppercase text-white/30">Est. Solar</div>
                          <div className="mt-0.5 text-[12px] font-semibold text-[#FF6600]">
                            {lead.system_size_kwp != null ? `${lead.system_size_kwp} kWp` : "—"}
                          </div>
                        </div>
                      </div>

                      {/* Value */}
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-white/35">Project Value</span>
                        <span className="font-mono font-bold text-emerald-400">
                          {formatInrLakh(lead.capex_estimate)}
                        </span>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
