import Razorpay from 'razorpay';

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
    let body: { plan?: string; scanId?: string } = {};
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const plan = body.plan;
    if (plan !== 'pay_per_scan' && plan !== 'pro_monthly') {
      return new Response(JSON.stringify({ error: 'Invalid plan' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Determine amount IN PAISE server-side only
    const amount = plan === 'pay_per_scan' ? 14900 : 99900;
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return new Response(
        JSON.stringify({ error: 'Payment service credentials missing on server' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `scan_${Date.now()}`,
      notes: {
        plan,
        scanId: body.scanId || '',
      },
    });

    return new Response(
      JSON.stringify({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    return new Response(JSON.stringify({ error: 'Failed to create order' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
