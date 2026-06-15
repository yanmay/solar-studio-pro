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
    let body: { paymentId?: string } = {};
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const paymentId = body.paymentId;
    if (!paymentId || !paymentId.startsWith('pay_') || paymentId.length < 14) {
      return new Response(JSON.stringify({ error: 'Invalid payment ID format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Call Razorpay API to retrieve payment info
    const authString = btoa(`${keyId}:${keySecret}`);
    const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Basic ${authString}`,
      },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Payment not found or not completed' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const paymentData = await response.json();
    if (paymentData.status !== 'captured') {
      return new Response(
        JSON.stringify({ error: 'Payment found but not successfully completed (captured)' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const scanId = paymentData.notes?.scanId || 'default';
    const cookieHeader = `scan_unlocked_${scanId}=true; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`;

    return new Response(JSON.stringify({ restored: true, paymentId }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookieHeader,
      },
    });
  } catch (error) {
    console.error('Error restoring payment:', error);
    return new Response(JSON.stringify({ error: 'Verification failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
