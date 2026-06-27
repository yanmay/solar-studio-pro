-- Row Level Security (RLS) policies for Solar Studio Pro
-- Idempotent: each policy is dropped (IF EXISTS) before being recreated.

-- 1. profiles table RLS policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_policy ON profiles;
CREATE POLICY profiles_select_policy ON profiles
  FOR SELECT
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS profiles_update_policy ON profiles;
CREATE POLICY profiles_update_policy ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


-- 2. analysis_sessions (scans) table RLS policies
ALTER TABLE analysis_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sessions_select_policy ON analysis_sessions;
CREATE POLICY sessions_select_policy ON analysis_sessions
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS sessions_insert_policy ON analysis_sessions;
CREATE POLICY sessions_insert_policy ON analysis_sessions
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR user_id IS NULL
  );

DROP POLICY IF EXISTS sessions_update_policy ON analysis_sessions;
CREATE POLICY sessions_update_policy ON analysis_sessions
  FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );


-- 3. lead_requests table RLS policies
ALTER TABLE lead_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leads_select_policy ON lead_requests;
CREATE POLICY leads_select_policy ON lead_requests
  FOR SELECT
  USING (
    auth.uid() = homeowner_user_id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS leads_insert_policy ON lead_requests;
CREATE POLICY leads_insert_policy ON lead_requests
  FOR INSERT
  WITH CHECK (
    auth.uid() = homeowner_user_id
  );


-- 4. lead_assignments table RLS policies
ALTER TABLE lead_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assignments_select_policy ON lead_assignments;
CREATE POLICY assignments_select_policy ON lead_assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM installer_profiles ip
      WHERE ip.id = installer_id AND ip.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );


-- 5. payments table RLS policies
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_select_policy ON payments;
CREATE POLICY payments_select_policy ON payments
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
