import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, MapPin, FileText, Loader2, Users } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { encodeScanToUrl } from "@/lib/scan-url";
import { PALETTE_ROUTES, filterRoutes } from "@/lib/nav-registry";

/** Minimal row shape the palette needs to reopen a saved scan. */
interface ReportRow {
  id: string;
  address: string | null;
  latitude: number;
  longitude: number;
  structure_tilt: number;
  boundary_setback: number;
  maintenance_walkways: boolean;
  panel_wattage: number;
  panel_alignment: string;
  panel_orientation: string;
  shading: string;
  created_at: string;
  solar_reports: {
    total_roof_area_sqm: number;
    panel_count: number;
    system_size_kwp: number;
  } | null;
  rooftop_sections: { polygon_coordinates: [number, number][][] }[];
}

const REPORTS_LIMIT = 6;

/** Rebuild the /results?scan= URL from a stored session (mirrors MyScansPage). */
function reportToScanUrl(row: ReportRow): string {
  const scanInput = {
    address: row.address ?? "",
    lat: row.latitude,
    lng: row.longitude,
    roofAreaM2: row.solar_reports?.total_roof_area_sqm || 0,
    roofPolygon:
      row.rooftop_sections?.map((sec) => ({
        type: "Polygon" as const,
        coordinates: sec.polygon_coordinates,
      })) || [],
  };
  const panelConfig = {
    tiltAngle: row.structure_tilt,
    setbackM: row.boundary_setback,
    walkwayM: row.maintenance_walkways ? 0.5 : 0,
    panelWattage: (row.panel_wattage as 450 | 550) || 450,
    orientation: (row.panel_orientation as "portrait" | "landscape") || "portrait",
    rowAlignment: (row.panel_alignment === "south"
      ? "geographical_south"
      : "roof_perimeter") as "geographical_south" | "roof_perimeter",
    panelCount: row.solar_reports?.panel_count || 15,
    systemKwp: row.solar_reports?.system_size_kwp || 6.75,
    shading: (row.shading as "none" | "partial" | "heavy") || "none",
  };
  return `/results?scan=${encodeScanToUrl(scanInput, panelConfig, { tariffPerKwh: 7.5 })}`;
}

/**
 * CommandPalette — global Cmd/Ctrl+K launcher. Mounted once inside the router
 * (App.tsx) so it can navigate, read auth, and query Supabase. Opens on the
 * keyboard shortcut or on a click of any `[data-solar-open-palette]` trigger
 * (the shell top-bar search button).
 *
 * Filtering is driven manually (`shouldFilter={false}` + `filterRoutes`) so the
 * always-available "Search location" action survives an arbitrary query.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [reports, setReports] = useState<ReportRow[] | null>(null);
  const [loadingReports, setLoadingReports] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Open on Cmd/Ctrl+K; the sidebar owns Cmd/Ctrl+B, so there's no collision.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Open when any shell "search" affordance is clicked.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-solar-open-palette]")) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Lazily fetch the signed-in user's latest reports the first time we open.
  useEffect(() => {
    if (!open || !user || reports !== null || loadingReports) return;
    if (!supabase) {
      setReports([]);
      return;
    }
    setLoadingReports(true);
    supabase
      .from("analysis_sessions")
      .select(
        `id, address, latitude, longitude, structure_tilt, boundary_setback, maintenance_walkways, panel_wattage, panel_alignment, panel_orientation, shading, created_at, solar_reports(total_roof_area_sqm, panel_count, system_size_kwp), rooftop_sections(polygon_coordinates)`,
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(REPORTS_LIMIT)
      .then(({ data, error }) => {
        if (error) {
          console.error("CommandPalette: failed to load reports", error);
          setReports([]);
        } else {
          setReports((data as unknown as ReportRow[]) ?? []);
        }
        setLoadingReports(false);
      });
  }, [open, user, reports, loadingReports]);

  // Reset the query whenever the dialog closes so it reopens clean.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const run = useCallback(
    (to: string) => {
      setOpen(false);
      navigate(to);
    },
    [navigate],
  );

  const routes = filterRoutes(PALETTE_ROUTES, query);
  const trimmed = query.trim();

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search or jump to…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No matching pages. Try “Search location” below.</CommandEmpty>

        {routes.length > 0 && (
          <CommandGroup heading="Go to">
            {routes.map((route) => (
              <CommandItem
                key={route.path}
                value={`goto:${route.path}`}
                onSelect={() => run(route.path)}
              >
                <route.icon className="mr-2 h-4 w-4" />
                {route.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {trimmed && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Search location">
              <CommandItem
                value={`location:${trimmed}`}
                onSelect={() => run(`/map?q=${encodeURIComponent(trimmed)}`)}
              >
                <MapPin className="mr-2 h-4 w-4 text-[#FF6600]" />
                Analyze “{trimmed}” on the map
                <ArrowRight className="ml-auto h-3.5 w-3.5 opacity-50" />
              </CommandItem>
            </CommandGroup>
          </>
        )}

        {user && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Your reports">
              {loadingReports && (
                <CommandItem disabled value="reports:loading">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading reports…
                </CommandItem>
              )}
              {!loadingReports && reports?.length === 0 && (
                <CommandItem disabled value="reports:empty">
                  <FileText className="mr-2 h-4 w-4 opacity-50" />
                  No saved reports yet
                </CommandItem>
              )}
              {!loadingReports &&
                reports?.map((row) => (
                  <CommandItem
                    key={row.id}
                    value={`report:${row.id}:${row.address ?? ""}`}
                    onSelect={() => run(reportToScanUrl(row))}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    <span className="truncate">
                      {row.address || "Rooftop scan"}
                    </span>
                    {row.solar_reports?.system_size_kwp != null && (
                      <span className="ml-auto font-mono text-[11px] text-[#FF6600]">
                        {row.solar_reports.system_size_kwp}kWp
                      </span>
                    )}
                  </CommandItem>
                ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Client portfolios">
          <CommandItem disabled value="crm:coming-soon">
            <Users className="mr-2 h-4 w-4 opacity-50" />
            Coming in the CRM phase
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
