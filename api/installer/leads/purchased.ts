import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const installerUserId = url.searchParams.get('installerUserId');
  if (!installerUserId) {
    return new Response(JSON.stringify({ error: 'installerUserId query parameter is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Database configuration missing' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Retrieve installer profile
    const { data: installer, error: instErr } = await supabase
      .from('installer_profiles')
      .select('*')
      .eq('user_id', installerUserId)
      .single();

    if (instErr || !installer) {
      return new Response(JSON.stringify({ error: 'Installer profile not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Query assignments for this installer
    const { data: assignments, error: assignErr } = await supabase
      .from('lead_assignments')
      .select('*')
      .eq('installer_id', installer.id);

    if (assignErr) {
      return new Response(JSON.stringify({ error: 'Failed to query assignments', details: assignErr.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const hydratedPurchases = [];
    for (const assign of (assignments || [])) {
      const { data: lead } = await supabase
        .from('lead_requests')
        .select('*')
        .eq('id', assign.lead_request_id)
        .single();

      if (lead) {
        const { data: report } = await supabase
          .from('solar_reports')
          .select('*')
          .eq('session_id', lead.session_id)
          .single();

        const { data: session } = await supabase
          .from('analysis_sessions')
          .select('*')
          .eq('id', lead.session_id)
          .single();

        hydratedPurchases.push({
          ...lead,
          price_charged_paise: assign.price_charged_paise,
          assignment_status: assign.status,
          assignment_id: assign.id,
          reminder_date: assign.reminder_date || null,
          reminder_note: assign.reminder_note || null,
          project_stage: assign.project_stage || null,
          project_assignee: assign.project_assignee || null,
          project_due_date: assign.project_due_date || null,
          project_notes: assign.project_notes || null,
          
          latitude: session?.latitude || null,
          longitude: session?.longitude || null,
          address: session?.address || null,
          
          total_roof_area_sqm: report?.total_roof_area_sqm || null,
          usable_roof_area_sqm: report?.usable_roof_area_sqm || null,
          system_size_kwp: report?.system_size_kwp || null,
          capex_estimate: report?.capex_estimate || null,
          pm_surya_subsidy: report?.pm_surya_subsidy || null,
          payback_years: report?.payback_years || null,
          annual_production_kwh: report?.annual_production_kwh || null,
          confidence_level: report?.confidence_level || null,
          confidence_reason: report?.confidence_reason || null
        });
      }
    }

    return new Response(JSON.stringify({
      leads: hydratedPurchases,
      profile: {
        subscription_tier: installer.subscription_tier,
        subscription_status: installer.subscription_status,
        trial_scans_remaining: installer.trial_scans_remaining,
        white_label: installer.white_label,
        custom_logo_url: installer.custom_logo_url,
        custom_domain: installer.custom_domain,
        company_name: installer.company_name
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
