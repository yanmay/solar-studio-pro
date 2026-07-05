import { createHmac } from 'node:crypto';

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
    let body: {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
      plan?: string;
      scanId?: string;
    } = {};
    
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, scanId } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return new Response(JSON.stringify({ error: 'Missing signature parameters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify HMAC signature
    const text = razorpay_order_id + '|' + razorpay_payment_id;
    const expected = createHmac('sha256', keySecret)
      .update(text)
      .digest('hex');

    const isValid = expected === razorpay_signature;

    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid payment signature' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const sId = scanId || 'default';
    const cookieHeader = `scan_unlocked_${sId}=true; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`;

    return new Response(
      JSON.stringify({ verified: true, paymentId: razorpay_payment_id }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': cookieHeader,
        },
      }
    );
  } catch (error) {
    console.error('Error verifying payment:', error);
    return new Response(JSON.stringify({ error: 'Verification failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
