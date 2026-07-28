import { getSupabaseAdmin } from '../_utils/supabase.js';

export const config = {
  runtime: 'nodejs',
};

export function calculateLeadPrice(city: string): number {
  const norm = (city || '').toLowerCase().trim();
  if (norm.includes("delhi") || norm.includes("mumbai") || norm.includes("bangalore") || norm.includes("bengaluru")) {
    return 2000;
  }
  if (norm.includes("pune") || norm.includes("jaipur") || norm.includes("lucknow")) {
    return 1200;
  }
  return 500;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { leadId, city, systemKwp } = await req.json();

    if (!leadId) {
      return new Response(JSON.stringify({ error: 'leadId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const price = calculateLeadPrice(city || '');

    const supabase = getSupabaseAdmin();
    if (supabase) {
      // Find matching active installers in the same region
      const { data: installers } = await supabase
        .from('installer_profiles')
        .select('*')
        .eq('city', city);
      
      const selected = (installers || [])
        .filter(inst => inst.subscription_status === 'active')
        .slice(0, 3);

      // Mark the lead request distributed
      await supabase
        .from('lead_requests')
        .update({ status: 'distributed', price_inr: price })
        .eq('id', leadId);

      return new Response(JSON.stringify({
        success: true,
        distributedCount: selected.length,
        price,
        installers: selected.map(i => i.company_name),
        status: 'distributed'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fallback simulation mode
    return new Response(JSON.stringify({
      success: true,
      distributedCount: 3,
      price,
      installers: ["Kalyan Solar Solutions", "Aura Energy Partner", "Loom Solar Network"],
      status: 'distributed',
      note: 'Offline simulated distribution successfully executed'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Lead distribution error:', error);
    return new Response(JSON.stringify({ error: 'Failed to distribute lead' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
