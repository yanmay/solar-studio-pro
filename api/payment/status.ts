import { getSupabaseAdmin } from '../_utils/supabase.js';

export const config = {
  runtime: 'nodejs',
};

// Helper to parse cookies from header
function getCookie(cookieHeader: string, name: string): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [cName, cVal] = cookie.trim().split('=');
    if (cName === name) return decodeURIComponent(cVal);
  }
  return null;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { searchParams } = new URL(req.url);
  const scanId = searchParams.get('scanId') || 'default';

  // Source of truth: the database. A scan is unlocked if its session has
  // is_full_unlocked = true (set only by verified/restored payments).
  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      const { data: session } = await supabase
        .from('analysis_sessions')
        .select('is_full_unlocked')
        .eq('site_id', scanId)
        .maybeSingle();

      if (session?.is_full_unlocked) {
        return new Response(JSON.stringify({ unlocked: true, source: 'db' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (err) {
      console.error('status: DB lookup failed, falling back to cookie:', err);
    }
  }

  // Fallback: legacy cookie (device-local only)
  const cookieHeader = req.headers.get('cookie') || '';
  const cookieName = `scan_unlocked_${scanId}`;
  const isUnlocked = getCookie(cookieHeader, cookieName) === 'true';

  return new Response(JSON.stringify({ unlocked: isUnlocked, source: 'cookie' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
