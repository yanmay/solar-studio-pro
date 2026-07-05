import Razorpay from 'razorpay';
import { getSupabaseAdmin, ensureSession } from '../_utils/supabase.js';

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
      plan?: string;
      scanId?: string;
      address?: string;
      lat?: number;
      lng?: number;
    } = {};
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

    // Persist a pending payment record (server-authoritative source of truth).
    // A DB failure must not block checkout, but is logged loudly.
    try {
      const supabase = getSupabaseAdmin();
      if (supabase && body.scanId) {
        const sessionId = await ensureSession(supabase, body.scanId, {
          address: body.address,
          lat: body.lat,
          lng: body.lng,
        });
        if (sessionId) {
          const { error: payError } = await supabase.from('payments').insert({
            session_id: sessionId,
            amount_paise: amount,
            currency: 'INR',
            payment_type:
              plan === 'pay_per_scan' ? 'report_unlock' : 'installer_subscription',
            razorpay_order_id: order.id,
            status: 'pending',
          });
          if (payError) {
            console.error('Failed to persist pending payment:', payError.message);
          }
        }
      } else if (!supabase) {
        console.error('Supabase admin client unavailable — payment not persisted');
      }
    } catch (dbError) {
      console.error('DB error persisting pending payment:', dbError);
    }

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
