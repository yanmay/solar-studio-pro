-- =============================================================================
-- Migration 003: Allow client-side inserts for rooftop_sections and solar_reports
-- - Allows inserting sections and reports linked to owned or anonymous sessions
-- =============================================================================

DROP POLICY IF EXISTS sections_insert ON public.rooftop_sections;
CREATE POLICY sections_insert ON public.rooftop_sections
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.analysis_sessions s
    WHERE s.id = session_id AND (s.user_id = auth.uid() OR s.user_id IS NULL)
  ));

DROP POLICY IF EXISTS reports_insert ON public.solar_reports;
CREATE POLICY reports_insert ON public.solar_reports
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.analysis_sessions s
    WHERE s.id = session_id AND (s.user_id = auth.uid() OR s.user_id IS NULL)
  ));
