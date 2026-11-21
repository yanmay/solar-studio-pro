import { getSupabaseAdmin } from '../_utils/supabase.js';

export const config = {
  runtime: 'nodejs',
};


export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { searchParams } = new URL(req.url);
  const scanId = searchParams.get('scanId') || '';
  const orderId = searchParams.get('orderId') || searchParams.get('order_id') || '';
  const paymentId = searchParams.get('paymentId') || searchParams.get('payment_id') || '';

  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      const filters = [];
      if (paymentId) filters.push(`payment_id.eq.${paymentId}`);
      if (orderId) filters.push(`order_id.eq.${orderId}`);
      if (scanId && scanId !== 'default') {
        filters.push(`scan_hash.eq.${scanId}`);
        filters.push(`payment_id.eq.${scanId}`);
        filters.push(`order_id.eq.${scanId}`);
      }

      if (filters.length > 0) {
        const { data: dbData, error } = await supabase
          .from('payments')
          .select('status')
          .or(filters.join(','));

        if (error) throw error;

        const isUnlocked = dbData?.some(p => p.status === 'captured') || false;
        if (isUnlocked) {
          return new Response(JSON.stringify({ unlocked: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      // BUG-007 fix: payments table may not have a record yet (verify sets
      // analysis_sessions.is_full_unlocked directly). Check that table as a fallback.
      if (scanId && scanId !== 'default') {
        const { data: sessionData, error: sessionError } = await supabase
          .from('analysis_sessions')
          .select('is_full_unlocked')
          .eq('site_id', scanId)
          .maybeSingle();

        if (!sessionError && sessionData?.is_full_unlocked === true) {
          return new Response(JSON.stringify({ unlocked: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
    } catch (err) {
      console.error('status: DB query failed:', err);
    }
  }

  return new Response(JSON.stringify({ unlocked: false }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
