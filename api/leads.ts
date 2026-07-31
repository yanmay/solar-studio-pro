import { getSupabaseAdmin, ensureSession } from './_utils/supabase.js';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { name, phone, city, systemKwp, scanId } = await req.json();

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
      return new Response(JSON.stringify({ error: 'Enter a valid 10-digit Indian mobile number' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // --- Persist the lead (source of truth) ---
    const supabase = getSupabaseAdmin();
    const siteId = typeof scanId === 'string' && scanId.trim() !== '' ? scanId.trim() : `lead-${Date.now()}`;
    const sessionId = await ensureSession(supabase, siteId, {
      address: typeof city === 'string' && city.trim() !== '' ? city.trim() : 'Unknown',
    });

    const { error: insertError } = await supabase.from('lead_requests').insert({
      session_id: sessionId,
      homeowner_phone: phone,
      homeowner_name: name.trim().slice(0, 120),
    });

    if (insertError) {
      console.error('Lead insert error:', insertError.message);
      return new Response(JSON.stringify({ error: 'Failed to save lead. Please try again.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // --- Notify by email (best-effort; never fails the request) ---
    const resendApiKey = process.env.RESEND_API_KEY;
    const leadsEmail = process.env.LEADS_EMAIL;
    if (resendApiKey && leadsEmail) {
      try {
        const { Resend } = await import('resend');
        const resend = new Resend(resendApiKey);
        const { error: emailError } = await resend.emails.send({
          from: 'onboarding@resend.dev',
          to: leadsEmail,
          subject: `New installer lead — ${city ?? 'Unknown city'} — ${systemKwp ?? '?'}kWp system`,
          text: `Name: ${name}\nPhone: ${phone}\nCity: ${city ?? '-'}\nSystem capacity: ${systemKwp ?? '-'} kWp\nScan: ${siteId}\n`,
        });
        if (emailError) console.error('Resend email error (non-fatal):', emailError.message);
      } catch (emailErr) {
        console.error('Resend send failed (non-fatal):', emailErr);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Lead handler error:', error);
    return new Response(JSON.stringify({ error: 'Failed to submit lead' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
