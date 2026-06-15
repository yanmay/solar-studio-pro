import { Resend } from 'resend';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { name, phone, city, systemKwp } = await req.json();

    if (!name || name.trim() === '') {
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

    const resendApiKey = process.env.RESEND_API_KEY;
    const leadsEmail = process.env.LEADS_EMAIL;

    if (!resendApiKey || !leadsEmail) {
      return new Response(JSON.stringify({ error: 'Mail service misconfigured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const resend = new Resend(resendApiKey);

    const { error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: leadsEmail,
      subject: `New installer lead — ${city} — ${systemKwp}kWp system`,
      text: `Name: ${name}\nPhone: ${phone}\nCity: ${city}\nSystem capacity: ${systemKwp} kWp\n`,
    });

    if (error) {
      console.error('Resend email error:', error);
      return new Response(JSON.stringify({ error: 'Failed to send lead email', details: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Lead handler error:', error);
    return new Response(JSON.stringify({ error: 'Verification failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
