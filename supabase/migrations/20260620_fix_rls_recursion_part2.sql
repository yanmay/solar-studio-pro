-- Fix (part 2): the base schema (20260101_001_schema.sql) created a SECOND,
-- differently-named set of RLS policies that also embed the recursive
-- `EXISTS (SELECT 1 FROM profiles WHERE role='admin')` admin check. Postgres
-- ORs all policies of the same command together, so these still recurse even
-- after 20260619 fixed the 20260615-named set. Replace them all with the
-- non-recursive public.is_admin() helper. Idempotent.

-- profiles
DROP POLICY IF EXISTS profiles_self ON profiles;
CREATE POLICY profiles_self ON profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

-- analysis_sessions
DROP POLICY IF EXISTS sessions_owner ON analysis_sessions;
CREATE POLICY sessions_owner ON analysis_sessions
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- rooftop_sections (inherited via session; admin check was nested)
DROP POLICY IF EXISTS sections_via_session ON rooftop_sections;
CREATE POLICY sections_via_session ON rooftop_sections
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM analysis_sessions s
    WHERE s.id = session_id AND (s.user_id = auth.uid() OR public.is_admin())));

-- solar_reports (inherited via session)
DROP POLICY IF EXISTS reports_via_session ON solar_reports;
CREATE POLICY reports_via_session ON solar_reports
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM analysis_sessions s
    WHERE s.id = session_id AND (s.user_id = auth.uid() OR public.is_admin())));

-- payments
DROP POLICY IF EXISTS payments_owner ON payments;
CREATE POLICY payments_owner ON payments
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- installer_profiles (FOR ALL)
DROP POLICY IF EXISTS installer_self ON installer_profiles;
CREATE POLICY installer_self ON installer_profiles
  FOR ALL USING (auth.uid() = user_id OR public.is_admin());

NOTIFY pgrst, 'reload schema';
