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
