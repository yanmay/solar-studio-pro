import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LEAD_STATUS_META, type LeadStatus } from "@/lib/installer-leads";

interface LeadStatusBadgeProps {
  status: LeadStatus;
  className?: string;
}

/**
 * Pipeline-status pill. The 4 default Badge variants don't cover the 7-stage
 * palette, so we pass the per-status recipe from `LEAD_STATUS_META` as
 * `className` (the single source of truth shared with the Kanban) rather than
 * bloating `badgeVariants`.
 */
export function LeadStatusBadge({ status, className }: LeadStatusBadgeProps) {
  const meta = LEAD_STATUS_META[status];
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-semibold px-2 py-0.5", meta.badgeClass, className)}
    >
      {meta.label}
    </Badge>
  );
}
