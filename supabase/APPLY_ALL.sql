-- ============================================================
-- SolarScan / SUNPOWER LINK — full schema (consolidated, re-runnable)
-- Paste into Supabase Dashboard → SQL Editor → Run.
-- ============================================================

-- >>> supabase/migrations/20260101_001_schema.sql
-- Supabase Database Schema Migration
-- Matches Section 5 & 6 of Technical Architecture Specification

-- Enable uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table 1: profiles
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  phone       TEXT,
  role        TEXT NOT NULL DEFAULT 'homeowner'
              CHECK (role IN ('homeowner', 'installer', 'admin')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 2: analysis_sessions
CREATE TABLE IF NOT EXISTS analysis_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         TEXT UNIQUE NOT NULL,

  user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_token   TEXT,

  address         TEXT NOT NULL,
  plus_code       TEXT,
  latitude        DOUBLE PRECISION NOT NULL,
  longitude       DOUBLE PRECISION NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_sessions_user_id       ON analysis_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_site_id       ON analysis_sessions(site_id);
CREATE INDEX IF NOT EXISTS idx_sessions_session_token ON analysis_sessions(session_token);

-- Table 3: rooftop_sections
CREATE TABLE IF NOT EXISTS rooftop_sections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
  section_number  INTEGER NOT NULL,
  polygon_coordinates JSONB NOT NULL,
  area_sqm        FLOAT,
  usable_area_sqm FLOAT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, section_number)
);

-- Table 4: solar_reports
CREATE TABLE IF NOT EXISTS solar_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL UNIQUE REFERENCES analysis_sessions(id) ON DELETE CASCADE,

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

-- Table 6: installer_profiles (referenced by Table 5)
CREATE TABLE IF NOT EXISTS installer_profiles (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,

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

-- Table 7: lead_requests (referenced by Table 5)
CREATE TABLE IF NOT EXISTS lead_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES analysis_sessions(id),
  homeowner_user_id UUID REFERENCES profiles(id),
  homeowner_phone   TEXT NOT NULL,
  homeowner_name    TEXT,

  status TEXT NOT NULL DEFAULT 'open'
         CHECK (status IN ('open','assigned','fulfilled','cancelled')),

  installers_assigned_count INTEGER NOT NULL DEFAULT 0
                            CHECK (installers_assigned_count <= 3),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_lead_requests_session_id ON lead_requests(session_id);

-- Table 8: lead_assignments (referenced by Table 5)
CREATE TABLE IF NOT EXISTS lead_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_request_id UUID NOT NULL REFERENCES lead_requests(id),
  installer_id    UUID NOT NULL REFERENCES installer_profiles(id),

  price_charged_paise INTEGER,
  status TEXT NOT NULL DEFAULT 'delivered'
         CHECK (status IN ('delivered','viewed','contacted','quoted','won','lost')),

  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  viewed_at    TIMESTAMPTZ,
  contacted_at TIMESTAMPTZ,

  UNIQUE (lead_request_id, installer_id)
);

-- Table 5: payments
CREATE TABLE IF NOT EXISTS payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES analysis_sessions(id),
  user_id     UUID REFERENCES profiles(id),
  lead_assignment_id UUID REFERENCES lead_assignments(id),

  amount_paise INTEGER NOT NULL,
  currency     TEXT NOT NULL DEFAULT 'INR',
  payment_type TEXT NOT NULL
               CHECK (payment_type IN ('report_unlock','installer_subscription','lead_purchase')),

  razorpay_order_id   TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature  TEXT,

  status TEXT NOT NULL DEFAULT 'pending'
         CHECK (status IN ('pending','success','failed','refunded')),

  gateway_response JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_session_id        ON payments(session_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id ON payments(razorpay_order_id);

-- Table 9: tariff_configs
CREATE TABLE IF NOT EXISTS tariff_configs (
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

CREATE INDEX IF NOT EXISTS idx_tariff_discom ON tariff_configs(discom, is_active);

-- Table 10: subsidy_schemes
CREATE TABLE IF NOT EXISTS subsidy_schemes (
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

-- Table 11: nasa_power_cache
CREATE TABLE IF NOT EXISTS nasa_power_cache (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL,

  latitude  FLOAT NOT NULL,
  longitude FLOAT NOT NULL,

  monthly_ghi          JSONB,
  monthly_dhi          JSONB,
  monthly_temperature  JSONB,
  monthly_wind_speed_10m JSONB,
  monthly_wind_speed_50m JSONB,

  elevation_m FLOAT,

  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_nasa_cache_key     ON nasa_power_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_nasa_cache_expires ON nasa_power_cache(expires_at);

-- Enable RLS on all tables
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooftop_sections    ENABLE ROW LEVEL SECURITY;
ALTER TABLE solar_reports       ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE installer_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_requests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_assignments    ENABLE ROW LEVEL SECURITY;

-- Profiles: read-only to owner / admin; update-only to self
DROP POLICY IF EXISTS profiles_self ON profiles;
CREATE POLICY profiles_self ON profiles
  FOR SELECT USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS profiles_update_self ON profiles;
CREATE POLICY profiles_update_self ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Analysis Sessions: read to owner / admin; insert by anyone (anonymous scans)
DROP POLICY IF EXISTS sessions_owner ON analysis_sessions;
CREATE POLICY sessions_owner ON analysis_sessions
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS sessions_insert ON analysis_sessions;
CREATE POLICY sessions_insert ON analysis_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Rooftop Sections: inherited via analysis session
DROP POLICY IF EXISTS sections_via_session ON rooftop_sections;
CREATE POLICY sections_via_session ON rooftop_sections
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM analysis_sessions s
    WHERE s.id = session_id AND (s.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role='admin'))));

-- Solar Reports: inherited via analysis session
DROP POLICY IF EXISTS reports_via_session ON solar_reports;
CREATE POLICY reports_via_session ON solar_reports
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM analysis_sessions s
    WHERE s.id = session_id AND (s.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role='admin'))));

-- Payments: read-only to owner / admin
DROP POLICY IF EXISTS payments_owner ON payments;
CREATE POLICY payments_owner ON payments
  FOR SELECT USING (auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role='admin'));

-- Installer Profiles: read/update self or admin
DROP POLICY IF EXISTS installer_self ON installer_profiles;
CREATE POLICY installer_self ON installer_profiles
  FOR ALL USING (auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role='admin'));

-- Lead Assignments: read-only for assigned installer
DROP POLICY IF EXISTS assignments_for_installer ON lead_assignments;
CREATE POLICY assignments_for_installer ON lead_assignments
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM installer_profiles ip
    WHERE ip.id = installer_id AND ip.user_id = auth.uid()));


-- >>> supabase/migrations/20260615_add_monthly_yields.sql
-- Migration to support accuracy modules: altitude, wind surcharge, and monthly generation profiling.

ALTER TABLE solar_reports ADD COLUMN IF NOT EXISTS monthly_yields JSONB;
ALTER TABLE solar_reports ADD COLUMN IF NOT EXISTS wind_surcharge_inr FLOAT DEFAULT 0.0;
ALTER TABLE solar_reports ADD COLUMN IF NOT EXISTS elevation_m FLOAT DEFAULT 0.0;


-- >>> supabase/migrations/20260615_security_rls.sql
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


-- >>> supabase/migrations/20260616_crm_kanban.sql
-- Migration to support CRM Lead Pipeline and Kanban Project Management
-- Matches the design specifications for Installer Sales & Workflow Layer

-- 1. Extend lead_assignments status check constraint to allow 'site_visit'
ALTER TABLE lead_assignments DROP CONSTRAINT IF EXISTS lead_assignments_status_check;
ALTER TABLE lead_assignments ADD CONSTRAINT lead_assignments_status_check
  CHECK (status IN ('delivered', 'viewed', 'contacted', 'site_visit', 'quoted', 'won', 'lost'));

-- 2. Add structured canonical columns to solar_reports
ALTER TABLE solar_reports ADD COLUMN IF NOT EXISTS confidence_level TEXT CHECK (confidence_level IN ('High', 'Medium', 'Low'));
ALTER TABLE solar_reports ADD COLUMN IF NOT EXISTS confidence_reason TEXT;

-- 3. Add project management workflow columns to lead_assignments
ALTER TABLE lead_assignments ADD COLUMN IF NOT EXISTS project_stage TEXT CHECK (project_stage IN ('lead', 'survey', 'design', 'install', 'commissioned'));
ALTER TABLE lead_assignments ADD COLUMN IF NOT EXISTS project_assignee TEXT;
ALTER TABLE lead_assignments ADD COLUMN IF NOT EXISTS project_due_date TIMESTAMPTZ;
ALTER TABLE lead_assignments ADD COLUMN IF NOT EXISTS project_notes TEXT;

-- 4. Add backup reminder fields just in case they are not in lead_assignments schema yet
ALTER TABLE lead_assignments ADD COLUMN IF NOT EXISTS reminder_date TIMESTAMPTZ;
ALTER TABLE lead_assignments ADD COLUMN IF NOT EXISTS reminder_note TEXT;


-- >>> supabase/migrations/20260617_platform_upgrades.sql
-- Platform upgrades migration (F2/F3/F5/F10/F11)
-- Adds columns required by: GSTIN verification, custom-domain verification,
-- provider-agnostic subscriptions, weighted lead routing, and state subsidy.
-- All idempotent (ADD COLUMN IF NOT EXISTS) — safe to re-run.

-- Mock-auth mode: the app creates installer profiles WITHOUT Supabase Auth, so
-- profiles.id cannot reference auth.users. Drop that FK so signups can persist.
-- (Re-add it if/when real Supabase Auth (F1) is wired.)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- White-label branding columns (written by signup + branding update; absent
-- from the original base schema).
ALTER TABLE installer_profiles ADD COLUMN IF NOT EXISTS white_label BOOLEAN DEFAULT FALSE;
ALTER TABLE installer_profiles ADD COLUMN IF NOT EXISTS custom_logo_url TEXT;
ALTER TABLE installer_profiles ADD COLUMN IF NOT EXISTS custom_domain TEXT;

-- F2/F3: verification flags
ALTER TABLE installer_profiles ADD COLUMN IF NOT EXISTS gstin_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE installer_profiles ADD COLUMN IF NOT EXISTS domain_verified BOOLEAN DEFAULT FALSE;

-- F5: subscription linkage (subscription_tier/status/expires_at already exist)
ALTER TABLE installer_profiles ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT;

-- F11: rating-weighted lead routing inputs
ALTER TABLE installer_profiles ADD COLUMN IF NOT EXISTS rating NUMERIC DEFAULT 3.0;
ALTER TABLE installer_profiles ADD COLUMN IF NOT EXISTS response_rate NUMERIC DEFAULT 0.5;
ALTER TABLE installer_profiles ADD COLUMN IF NOT EXISTS recency_score NUMERIC DEFAULT 1.0;
ALTER TABLE installer_profiles ADD COLUMN IF NOT EXISTS leads_won INT DEFAULT 0;
ALTER TABLE installer_profiles ADD COLUMN IF NOT EXISTS leads_lost INT DEFAULT 0;
ALTER TABLE installer_profiles ADD COLUMN IF NOT EXISTS lead_cities TEXT[] DEFAULT '{}';
ALTER TABLE installer_profiles ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- F10: state subsidy breakdown persisted alongside the central PM Surya Ghar amount
ALTER TABLE solar_reports ADD COLUMN IF NOT EXISTS state_booster_subsidy FLOAT DEFAULT 0;
ALTER TABLE solar_reports ADD COLUMN IF NOT EXISTS total_subsidy_inr FLOAT;

-- Ensure PostgREST reloads its schema cache after applying.
NOTIFY pgrst, 'reload schema';

