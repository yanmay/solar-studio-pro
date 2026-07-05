import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase admin client (service role).
 * NEVER import this from client-side code — it bypasses RLS.
 */
let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  if (cached) return cached;
  cached = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/**
 * Upsert an analysis session by site_id and return its UUID id.
 * Creates a minimal anonymous session row when one does not exist.
 */
export async function ensureSession(
  supabase: SupabaseClient,
  siteId: string,
  meta?: { address?: string; lat?: number; lng?: number }
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('analysis_sessions')
    .select('id')
    .eq('site_id', siteId)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: inserted, error } = await supabase
    .from('analysis_sessions')
    .insert({
      site_id: siteId,
      address: meta?.address ?? 'unknown',
      latitude: meta?.lat ?? 0,
      longitude: meta?.lng ?? 0,
      status: 'ready',
    })
    .select('id')
    .single();

  if (error) {
    console.error('ensureSession insert failed:', error.message);
    return null;
  }
  return inserted.id;
}
