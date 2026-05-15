-- Read-only list shape for Assignments → Survey → installer: one row per survey
-- with the latest installation (by created_at) for status filtering and links.
--
-- Supabase SQL Editor: Dashboard → SQL → New query → paste this file → Run.
-- After success, wait a few seconds (or reload the app) so PostgREST refreshes its schema cache.

CREATE OR REPLACE VIEW public.surveys_with_latest_installation AS
SELECT
  s.*,
  li.id AS installation_id,
  li.status AS installation_status
FROM public.surveys s
LEFT JOIN LATERAL (
  SELECT i.id, i.status
  FROM public.installations i
  WHERE i.survey_id = s.id
  ORDER BY i.created_at DESC NULLS LAST, i.id DESC
  LIMIT 1
) li ON TRUE;

COMMENT ON VIEW public.surveys_with_latest_installation IS
  'Surveys plus latest linked installation id/status for assignment UI (read-only).';

-- Expose the view to the Supabase API roles (browser + service client).
GRANT SELECT ON public.surveys_with_latest_installation TO anon;
GRANT SELECT ON public.surveys_with_latest_installation TO authenticated;
GRANT SELECT ON public.surveys_with_latest_installation TO service_role;
