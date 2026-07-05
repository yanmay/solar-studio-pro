-- =============================================================================
-- Migration 002: Auth foundation (T1-1)
-- - Auto-create a profiles row for every new auth user (role from metadata,
--   admin never assignable from client metadata)
-- - Prevent role self-escalation via trigger (RLS UPDATE policy alone allows
--   a user to set role='admin' on their own row)
-- - customer_email on payments + analysis_sessions for claim-by-email of
--   anonymous purchases
-- - lead_requests SELECT policy for the owning homeowner (was: no policy)
-- - updated_at maintenance trigger for profiles
-- =============================================================================

-- 1. Auto-create profile on signup ------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role TEXT := COALESCE(NEW.raw_user_meta_data->>'role', 'homeowner');
BEGIN
  -- 'admin' can never be self-assigned through signup metadata
  IF requested_role NOT IN ('homeowner', 'installer') THEN
    requested_role := 'homeowner';
  END IF;

  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    requested_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Prevent role self-escalation --------------------------------------------
-- auth.uid() IS NULL means the change comes from the service role (server) —
-- allowed. An authenticated user may only change their own role if admin.
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND auth.uid() IS NOT NULL
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'role changes require admin privileges';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_role_guard ON public.profiles;
CREATE TRIGGER profiles_role_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();

-- 3. Claim-by-email support ---------------------------------------------------
ALTER TABLE public.payments          ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE public.analysis_sessions ADD COLUMN IF NOT EXISTS customer_email TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_customer_email
  ON public.payments (LOWER(customer_email));
CREATE INDEX IF NOT EXISTS idx_sessions_customer_email
  ON public.analysis_sessions (LOWER(customer_email));

-- 4. lead_requests: owner visibility -----------------------------------------
DROP POLICY IF EXISTS lead_requests_owner ON public.lead_requests;
CREATE POLICY lead_requests_owner ON public.lead_requests
  FOR SELECT USING (homeowner_user_id = auth.uid() OR public.is_admin());

-- 5. profiles.updated_at maintenance -----------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_touch_updated_at ON public.profiles;
CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
