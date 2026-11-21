import { type ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, Info, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LEAD_STATUS_META,
  LEAD_STATUS_ORDER,
  formatInrLakh,
  type Lead,
  type LeadStatus,
} from "@/lib/installer-leads";
import { LeadStatusBadge } from "./LeadStatusBadge";

interface ColumnActions {
  onView: (lead: Lead) => void;
  onMoveStatus: (id: string, status: LeadStatus) => void;
}

/** A ghost sort toggle used in sortable column headers. */
function SortHeader({ label, toggle }: { label: string; toggle: (desc?: boolean) => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 px-2 text-[11px] uppercase tracking-wider text-white/50 hover:text-white"
      onClick={() => toggle()}
    >
      {label}
      <ArrowUpDown className="ml-1.5 h-3 w-3" />
    </Button>
  );
}

/**
 * Column definitions for the leads DataTable. A factory (not a const) so the
 * row-action menu can call back into the page's Sheet + status mutation without
 * the generic `data-table.tsx` needing to know anything about leads.
 */
export function makeLeadsColumns({ onView, onMoveStatus }: ColumnActions): ColumnDef<Lead>[] {
  return [
    {
      id: "name",
      accessorKey: "homeowner_name",
      header: ({ column }) => (
        <SortHeader label="Name" toggle={() => column.toggleSorting(column.getIsSorted() === "asc")} />
      ),
      cell: ({ row }) => (
        <span className="font-semibold text-white">{row.original.homeowner_name}</span>
      ),
    },
    {
      id: "phone",
      accessorKey: "homeowner_phone",
      header: "Phone",
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-white/50 font-mono text-[12px]">
          <Phone className="h-3 w-3" />
          {row.original.homeowner_phone}
        </span>
      ),
    },
    {
      id: "address",
      accessorKey: "address",
      header: "Address",
      cell: ({ row }) => (
        <span className="block max-w-[220px] truncate text-white/50">
          {row.original.address ?? "—"}
        </span>
      ),
    },
    {
      id: "roof",
      accessorFn: (row) => row.total_roof_area_sqm ?? 0,
      header: "Roof Area",
      cell: ({ row }) => (
        <span className="tabular-nums text-white/70">
          {row.original.total_roof_area_sqm != null ? `${row.original.total_roof_area_sqm} m²` : "—"}
        </span>
      ),
    },
    {
      id: "system",
      accessorFn: (row) => row.system_size_kwp ?? 0,
      header: "Est. System",
      cell: ({ row }) => (
        <span className="tabular-nums font-semibold text-[#FF6600]">
          {row.original.system_size_kwp != null ? `${row.original.system_size_kwp} kWp` : "—"}
        </span>
      ),
    },
    {
      id: "value",
      accessorFn: (row) => row.capex_estimate ?? 0,
      header: ({ column }) => (
        <SortHeader label="Project Value" toggle={() => column.toggleSorting(column.getIsSorted() === "asc")} />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums font-semibold text-emerald-400 font-mono">
          {formatInrLakh(row.original.capex_estimate)}
        </span>
      ),
    },
    {
      id: "status",
      accessorKey: "assignment_status",
      header: "Status",
      enableSorting: false,
      cell: ({ row }) => <LeadStatusBadge status={row.original.assignment_status} />,
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const lead = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 border-none bg-transparent hover:bg-white/[0.06]"
                aria-label={`Actions for ${lead.homeowner_name}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onView(lead)} className="cursor-pointer text-[13px]">
                <Info className="mr-2 h-3.5 w-3.5" />
                View details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-white/40">
                Move to
              </DropdownMenuLabel>
              {LEAD_STATUS_ORDER.filter((s) => s !== lead.assignment_status).map((status) => (
                <DropdownMenuItem
                  key={status}
                  onClick={() => onMoveStatus(lead.id, status)}
                  className="cursor-pointer text-[13px]"
                >
                  {LEAD_STATUS_META[status].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
