-- Fix: infinite recursion (42P17) in RLS policies.
-- The admin check `EXISTS (SELECT 1 FROM profiles WHERE role='admin')` embedded
-- in profiles' own SELECT policy re-triggers that same policy, recursing forever.
-- Every table that reused the same subquery inherited the fault.
--
-- Fix: a SECURITY DEFINER helper that reads profiles with RLS bypassed. Calling
-- it from a policy does not re-enter RLS, so the recursion is broken.
-- Idempotent — safe to re-run.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- profiles
DROP POLICY IF EXISTS profiles_select_policy ON profiles;
CREATE POLICY profiles_select_policy ON profiles
  FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

-- analysis_sessions
DROP POLICY IF EXISTS sessions_select_policy ON analysis_sessions;
CREATE POLICY sessions_select_policy ON analysis_sessions
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS sessions_update_policy ON analysis_sessions;
CREATE POLICY sessions_update_policy ON analysis_sessions
  FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin());

-- lead_requests
DROP POLICY IF EXISTS leads_select_policy ON lead_requests;
CREATE POLICY leads_select_policy ON lead_requests
  FOR SELECT
  USING (auth.uid() = homeowner_user_id OR public.is_admin());

-- lead_assignments
DROP POLICY IF EXISTS assignments_select_policy ON lead_assignments;
CREATE POLICY assignments_select_policy ON lead_assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM installer_profiles ip
      WHERE ip.id = installer_id AND ip.user_id = auth.uid()
    )
    OR public.is_admin()
  );

-- payments
DROP POLICY IF EXISTS payments_select_policy ON payments;
CREATE POLICY payments_select_policy ON payments
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

NOTIFY pgrst, 'reload schema';
