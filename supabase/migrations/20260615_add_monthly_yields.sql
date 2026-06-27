-- Migration to support accuracy modules: altitude, wind surcharge, and monthly generation profiling.

ALTER TABLE solar_reports ADD COLUMN IF NOT EXISTS monthly_yields JSONB;
ALTER TABLE solar_reports ADD COLUMN IF NOT EXISTS wind_surcharge_inr FLOAT DEFAULT 0.0;
ALTER TABLE solar_reports ADD COLUMN IF NOT EXISTS elevation_m FLOAT DEFAULT 0.0;
