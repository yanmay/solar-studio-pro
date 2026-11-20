-- BUG-007 security fix: analysis_sessions UPDATE policy must block
-- self-escalation of is_full_unlocked via the client-side Supabase SDK.
--
-- BEFORE: sessions_update_policy had no WITH CHECK clause, meaning any
-- authenticated user who owns their row could PATCH is_full_unlocked=true
-- directly from the browser — bypassing Razorpay entirely.
--
-- FIX: Add WITH CHECK that explicitly prevents clients from setting
-- is_full_unlocked=true. Only the service role (used by api/payment/verify.ts)
-- can set this column; the service role bypasses RLS entirely.
--
-- Note: the service-role key is never sent to the browser and is only used
-- in Vercel edge functions via getSupabaseAdmin() in api/_utils/supabase.ts.

DROP POLICY IF EXISTS sessions_update_policy ON analysis_sessions;
CREATE POLICY sessions_update_policy ON analysis_sessions
  FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    -- Users may only update their own rows AND must not escalate is_full_unlocked.
    -- is_full_unlocked can only be set TRUE by the service role (api/payment/verify.ts).
    (auth.uid() = user_id AND is_full_unlocked = FALSE)
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
