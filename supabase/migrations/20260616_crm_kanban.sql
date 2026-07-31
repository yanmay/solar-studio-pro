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
