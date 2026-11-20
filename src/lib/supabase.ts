import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Only initialize the client when credentials are present.
// If either value is absent the client is null and all DB operations silently no-op,
// which keeps the rest of the app fully functional without Supabase credentials.
let _supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  _supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.warn(
    "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — " +
      "DB persistence and auth are disabled in this environment."
  );
}

export const supabase = _supabase!; // typed as SupabaseClient but may be null at runtime


export async function saveScanToDb(
  scanId: string,
  scanInput: any,
  panelConfig: any,
  tariff: any,
  results: any,
  userId: string | null
) {
  if (!_supabase) return null;
  try {
    const { data: existingSession } = await supabase
      .from("analysis_sessions")
      .select("id")
      .eq("site_id", scanId)
      .maybeSingle();

    let sessionId = existingSession?.id;

    if (!sessionId) {
      const { data: newSession, error: sessionError } = await supabase
        .from("analysis_sessions")
        .insert({
          site_id: scanId,
          user_id: userId,
          address: scanInput.address || "Unknown Address",
          latitude: scanInput.lat,
          longitude: scanInput.lng,
          structure_tilt: panelConfig.tiltAngle,
          boundary_setback: panelConfig.setbackM,
          maintenance_walkways: panelConfig.walkwayM > 0,
          panel_wattage: panelConfig.panelWattage,
          panel_alignment: panelConfig.rowAlignment === "geographical_south" ? "south" : "roof",
          panel_orientation: panelConfig.orientation === "landscape" ? "landscape" : "portrait",
          shading: panelConfig.shading || "none",
          status: "ready",
        })
        .select("id")
        .single();

      if (sessionError) throw sessionError;
      sessionId = newSession.id;
    } else {
      if (userId) {
        await supabase
          .from("analysis_sessions")
          .update({ user_id: userId })
          .eq("id", sessionId)
          .is("user_id", null);
      }
    }

    const { data: existingReport } = await supabase
      .from("solar_reports")
      .select("id")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (!existingReport) {
      const { error: reportError } = await supabase
        .from("solar_reports")
        .insert({
          session_id: sessionId,
          total_roof_area_sqm: scanInput.roofAreaM2,
          usable_roof_area_sqm: scanInput.roofAreaM2 * 0.75,
          panel_count: panelConfig.panelCount || 15,
          system_size_kwp: panelConfig.systemKwp || 1.0,
          annual_production_kwh: results?.annualYieldKwh || 0,
          payback_years: results?.paybackYears || 0,
          lifetime_savings: results?.netCostInr || 0,
          capex_estimate: results?.grossCostInr || 0,
          pm_surya_subsidy: results?.subsidyAmountInr || 0,
        });

      if (reportError) {
        console.error("Error inserting solar report:", reportError);
      }
    }

    const { data: existingSections } = await supabase
      .from("rooftop_sections")
      .select("id")
      .eq("session_id", sessionId);

    if (!existingSections || existingSections.length === 0) {
      const sections = scanInput.roofPolygon?.map((poly: any, idx: number) => ({
        session_id: sessionId,
        section_number: idx + 1,
        polygon_coordinates: poly.coordinates,
        area_sqm: scanInput.roofAreaM2 / (scanInput.roofPolygon.length || 1),
        usable_area_sqm: (scanInput.roofAreaM2 * 0.75) / (scanInput.roofPolygon.length || 1),
      })) || [];

      if (sections.length > 0) {
        const { error: sectionsError } = await supabase
          .from("rooftop_sections")
          .insert(sections);
        
        if (sectionsError) {
          console.error("Error inserting rooftop sections:", sectionsError);
        }
      }
    }

    return sessionId;
  } catch (error) {
    console.error("Failed to save scan to database:", error);
    return null;
  }
}
