import * as Sentry from '@sentry/node';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getSupabaseAdmin, ensureSession } from '../_utils/supabase.js';

if (process.env.VITE_SENTRY_DSN) {
  Sentry.init({ dsn: process.env.VITE_SENTRY_DSN, environment: process.env.NODE_ENV || 'production' });
}

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
      scan_hash?: string;
    } = {};

    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, scanId, plan, scan_hash } = body;

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

    // Verify HMAC signature (timing-safe comparison)
    const text = razorpay_order_id + '|' + razorpay_payment_id;
    const expected = createHmac('sha256', keySecret).update(text).digest('hex');

    let isValid = false;
    try {
      const expectedBuf = Buffer.from(expected, 'hex');
      const receivedBuf = Buffer.from(razorpay_signature, 'hex');
      isValid =
        expectedBuf.length === receivedBuf.length &&
        timingSafeEqual(expectedBuf, receivedBuf);
    } catch {
      isValid = false;
    }

    if (!isValid) {
      // Record the failed verification attempt
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          await supabase
            .from('payments')
            .update({ status: 'failed' })
            .eq('razorpay_order_id', razorpay_order_id)
            .eq('status', 'pending');
        }
      } catch (dbError) {
        console.error('DB error recording failed payment:', dbError);
      }
      return new Response(JSON.stringify({ error: 'Invalid payment signature' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Signature valid — persist success and unlock the session in the DB
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { error: insertError } = await supabase
          .from('payments')
          .insert({
            order_id: razorpay_order_id,
            payment_id: razorpay_payment_id,
            status: 'captured',
            scan_hash: scan_hash || scanId,
          });

        if (insertError) {
          console.error('Failed to insert verified payment record:', insertError.message);
        }

        // Backwards compatibility: also unlock the analysis session in analysis_sessions table
        const targetScanId = scan_hash || scanId;
        if (targetScanId) {
          const { error: unlockError } = await supabase
            .from('analysis_sessions')
            .update({ is_full_unlocked: true })
            .eq('site_id', targetScanId);
          if (unlockError) {
            console.error('Failed to unlock session in analysis_sessions:', unlockError.message);
          }
        }
      } else {
        console.error('Supabase admin client unavailable — unlock not persisted');
      }
    } catch (dbError) {
      console.error('DB error persisting verified payment:', dbError);
    }

    // Keep the HttpOnly cookie as a fast-path cache of unlock state
    const effectiveScanId = scanId || 'default';
    const cookieHeader = `scan_unlocked_${effectiveScanId}=true; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`;

    return new Response(JSON.stringify({ verified: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookieHeader,
      },
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    return new Response(JSON.stringify({ error: 'Verification failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
