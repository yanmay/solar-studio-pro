-- =============================================================================
-- Combined Migration Script for Supabase (SolarScan / SolarStudio Pro)
-- Run this script in Supabase Dashboard -> SQL Editor
-- =============================================================================

-- Enable uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- Helper Functions
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- -----------------------------------------------------------------------------
-- Table 1: profiles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  phone       TEXT,
  role        TEXT NOT NULL DEFAULT 'homeowner'
              CHECK (role IN ('homeowner', 'installer', 'admin')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Table 2: analysis_sessions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analysis_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         TEXT UNIQUE,

  user_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  session_token   TEXT,
  customer_email  TEXT,

  address         TEXT,
  plus_code       TEXT,
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,

  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  rooftop_area_m2 DOUBLE PRECISION,
  installed_kw    DOUBLE PRECISION,
  annual_kwh      DOUBLE PRECISION,
  system_cost_inr DOUBLE PRECISION,
  payback_years   DOUBLE PRECISION,

  city            TEXT,
  state           TEXT,
  pincode         TEXT,
  discom          TEXT,

  structure_tilt        FLOAT   NOT NULL DEFAULT 15,
  boundary_setback      FLOAT   NOT NULL DEFAULT 0.5,
  maintenance_walkways  BOOLEAN NOT NULL DEFAULT TRUE,
  panel_wattage         INTEGER NOT NULL DEFAULT 450,
  panel_alignment       TEXT NOT NULL DEFAULT 'roof'
                        CHECK (panel_alignment IN ('roof', 'south')),
  panel_orientation     TEXT NOT NULL DEFAULT 'auto'
                        CHECK (panel_orientation IN ('portrait', 'landscape', 'auto')),
  shading               TEXT NOT NULL DEFAULT 'none'
                        CHECK (shading IN ('none', 'partial', 'heavy')),

  status  TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending','traced','analyzing','ready','expired')),

  is_preview_unlocked BOOLEAN NOT NULL DEFAULT TRUE,
  is_full_unlocked    BOOLEAN NOT NULL DEFAULT FALSE,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  analyzed_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id        ON public.analysis_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_site_id        ON public.analysis_sessions(site_id);
CREATE INDEX IF NOT EXISTS idx_sessions_session_token  ON public.analysis_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_customer_email ON public.analysis_sessions(LOWER(customer_email));

-- -----------------------------------------------------------------------------
-- Table 3: rooftop_sections
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rooftop_sections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES public.analysis_sessions(id) ON DELETE CASCADE,
  section_number  INTEGER NOT NULL,
  polygon_coordinates JSONB NOT NULL,
  area_sqm        FLOAT,
  usable_area_sqm FLOAT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, section_number)
);

-- -----------------------------------------------------------------------------
-- Table 4: solar_reports
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.solar_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL UNIQUE REFERENCES public.analysis_sessions(id) ON DELETE CASCADE,

  total_roof_area_sqm   FLOAT,
  usable_roof_area_sqm  FLOAT,
  panel_count           INTEGER,
  system_size_kwp       FLOAT,

  annual_ghi_kwh_m2_day FLOAT,
  annual_production_kwh FLOAT,

  azimuth_degrees       FLOAT,
  horizon_shading_loss  FLOAT,
  albedo                FLOAT,
  sky_view_factor       FLOAT,

  lcoe_per_kwh        FLOAT,
  irr                 FLOAT,
  roe                 FLOAT,
  npv                 FLOAT,
  payback_years       FLOAT,
  lifetime_savings    FLOAT,
  utility_cost_25yr   FLOAT,
  capex_estimate      FLOAT,
  pm_surya_subsidy    FLOAT,

  suitability_score        INTEGER,
  investment_grade         TEXT CHECK (investment_grade IN ('A+','A','B','C','D')),
  solar_orientation_score  INTEGER,
  roof_area_score          INTEGER,
  shading_loss_score       INTEGER,
  structural_score         INTEGER,
  roof_utilization_pct     FLOAT,

  ai_summary       TEXT,
  ai_roof_insights TEXT,

  panel_degradation   FLOAT DEFAULT 0.0055,
  inverter_efficiency FLOAT DEFAULT 0.975,
  system_losses       FLOAT DEFAULT 0.14,
  tariff_escalation   FLOAT DEFAULT 0.045,
  discount_rate       FLOAT DEFAULT 0.085,
  om_escalation       FLOAT DEFAULT 0.01,

  module_specs     TEXT,
  inverter_specs   TEXT,
  monitoring_specs TEXT,

  cashflow_projection JSONB,
  panel_layout        JSONB,

  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Table 5: installer_profiles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.installer_profiles (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,

  company_name     TEXT NOT NULL,
  gstin            TEXT CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{3}$'),
  city             TEXT NOT NULL,
  state            TEXT NOT NULL,
  service_pincodes TEXT[],
  mnre_certified   BOOLEAN DEFAULT FALSE,

  subscription_tier   TEXT NOT NULL DEFAULT 'trial'
                      CHECK (subscription_tier IN ('trial','basic','pro','enterprise')),
  subscription_status TEXT NOT NULL DEFAULT 'active'
                      CHECK (subscription_status IN ('active','paused','cancelled')),
  subscription_expires_at TIMESTAMPTZ,
  trial_scans_remaining   INTEGER DEFAULT 10,

  leads_received_count  INTEGER DEFAULT 0,
  leads_contacted_count INTEGER DEFAULT 0,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);

-- -----------------------------------------------------------------------------
-- Table 6: lead_requests
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES public.analysis_sessions(id),
  homeowner_user_id UUID REFERENCES public.profiles(id),
  homeowner_phone   TEXT NOT NULL,
  homeowner_name    TEXT,

  status TEXT NOT NULL DEFAULT 'open'
         CHECK (status IN ('open','assigned','fulfilled','cancelled')),

  installers_assigned_count INTEGER NOT NULL DEFAULT 0
                            CHECK (installers_assigned_count <= 3),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_lead_requests_session_id ON public.lead_requests(session_id);

-- -----------------------------------------------------------------------------
-- Table 7: lead_assignments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_request_id UUID NOT NULL REFERENCES public.lead_requests(id),
  installer_id    UUID NOT NULL REFERENCES public.installer_profiles(id),

  price_charged_paise INTEGER,
  status TEXT NOT NULL DEFAULT 'delivered'
         CHECK (status IN ('delivered','viewed','contacted','quoted','won','lost')),

  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  viewed_at    TIMESTAMPTZ,
  contacted_at TIMESTAMPTZ,

  UNIQUE (lead_request_id, installer_id)
);

-- -----------------------------------------------------------------------------
-- Table 8: payments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID REFERENCES public.analysis_sessions(id),
  user_id     UUID REFERENCES public.profiles(id),
  lead_assignment_id UUID REFERENCES public.lead_assignments(id),
  customer_email TEXT,

  amount_paise INTEGER,
  currency     TEXT NOT NULL DEFAULT 'INR',
  payment_type TEXT CHECK (payment_type IN ('report_unlock','installer_subscription','lead_purchase')),

  razorpay_order_id   TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature  TEXT,

  order_id            TEXT,
  payment_id          TEXT,
  amount              INTEGER,
  scan_hash           TEXT,

  status TEXT NOT NULL DEFAULT 'pending'
         CHECK (status IN ('pending','success','failed','refunded','captured')),

  gateway_response JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_session_id        ON public.payments(session_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id ON public.payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_email    ON public.payments(LOWER(customer_email));

-- -----------------------------------------------------------------------------
-- Table 9: tariff_configs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tariff_configs (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discom TEXT NOT NULL,
  state  TEXT NOT NULL,
  city   TEXT,

  tariff_slabs JSONB NOT NULL,

  net_metering_rate FLOAT,
  tou_applicable    BOOLEAN DEFAULT FALSE,

  effective_from DATE NOT NULL,
  effective_to   DATE,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tariff_discom ON public.tariff_configs(discom, is_active);

-- -----------------------------------------------------------------------------
-- Table 10: subsidy_schemes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subsidy_schemes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_name TEXT NOT NULL,
  category    TEXT NOT NULL CHECK (category IN ('central','state','local')),
  applicable_states TEXT[],

  subsidy_logic JSONB NOT NULL,

  valid_from DATE NOT NULL,
  valid_to   DATE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Table 11: nasa_power_cache
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nasa_power_cache (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE,

  latitude  FLOAT,
  longitude FLOAT,

  lat       FLOAT,
  lng       FLOAT,
  payload   JSONB,

  monthly_ghi          JSONB,
  monthly_dhi          JSONB,
  monthly_temperature  JSONB,
  monthly_wind_speed_10m JSONB,
  monthly_wind_speed_50m JSONB,

  elevation_m FLOAT,

  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_nasa_cache_key     ON public.nasa_power_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_nasa_cache_expires ON public.nasa_power_cache(expires_at);

-- -----------------------------------------------------------------------------
-- Triggers and Auth Handlers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role TEXT := COALESCE(NEW.raw_user_meta_data->>'role', 'homeowner');
BEGIN
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

-- -----------------------------------------------------------------------------
-- Row Level Security (RLS) Policies
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooftop_sections    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_reports       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installer_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_requests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_assignments    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_self ON public.profiles;
CREATE POLICY profiles_self ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS sessions_owner ON public.analysis_sessions;
CREATE POLICY sessions_owner ON public.analysis_sessions
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS sessions_insert ON public.analysis_sessions;
CREATE POLICY sessions_insert ON public.analysis_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS sections_via_session ON public.rooftop_sections;
CREATE POLICY sections_via_session ON public.rooftop_sections
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.analysis_sessions s
    WHERE s.id = session_id AND (s.user_id = auth.uid() OR public.is_admin())));

DROP POLICY IF EXISTS sections_insert ON public.rooftop_sections;
CREATE POLICY sections_insert ON public.rooftop_sections
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.analysis_sessions s
    WHERE s.id = session_id AND (s.user_id = auth.uid() OR s.user_id IS NULL)
  ));

DROP POLICY IF EXISTS reports_via_session ON public.solar_reports;
CREATE POLICY reports_via_session ON public.solar_reports
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.analysis_sessions s
    WHERE s.id = session_id AND (s.user_id = auth.uid() OR public.is_admin())));

DROP POLICY IF EXISTS reports_insert ON public.solar_reports;
CREATE POLICY reports_insert ON public.solar_reports
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.analysis_sessions s
    WHERE s.id = session_id AND (s.user_id = auth.uid() OR s.user_id IS NULL)
  ));

DROP POLICY IF EXISTS payments_owner ON public.payments;
CREATE POLICY payments_owner ON public.payments
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS installer_self ON public.installer_profiles;
CREATE POLICY installer_self ON public.installer_profiles
  FOR ALL USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS lead_requests_owner ON public.lead_requests;
CREATE POLICY lead_requests_owner ON public.lead_requests
  FOR SELECT USING (homeowner_user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS assignments_for_installer ON public.lead_assignments;
CREATE POLICY assignments_for_installer ON public.lead_assignments
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.installer_profiles ip
    WHERE ip.id = installer_id AND ip.user_id = auth.uid()));
