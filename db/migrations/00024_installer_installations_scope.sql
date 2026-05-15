-- Installer-scoped installation list: same predicate as KPI (engineer OR survey assignment)
-- without relying on PostgREST multi-filter `.or()` + paginated select (can return empty rows while counts succeed).

CREATE OR REPLACE FUNCTION public.installer_visible_installations_count(
  p_project_id text,
  p_profile_id text,
  p_survey_ids text[]
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::bigint
  FROM public.installations i
  WHERE i.project_id = p_project_id
    AND (
      i.engineer_id = p_profile_id
      OR (p_survey_ids IS NOT NULL AND cardinality(p_survey_ids) > 0 AND i.survey_id = ANY (p_survey_ids))
    );
$$;

CREATE OR REPLACE FUNCTION public.installer_visible_installations_page(
  p_project_id text,
  p_profile_id text,
  p_survey_ids text[],
  p_limit int,
  p_offset int
)
RETURNS TABLE (
  id text,
  project_id text,
  survey_id text,
  customer_name text,
  address text,
  engineer_name text,
  engineer_id text,
  status installation_status,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.project_id,
    i.survey_id,
    i.customer_name,
    i.address,
    i.engineer_name,
    i.engineer_id,
    i.status,
    i.started_at,
    i.completed_at,
    i.created_at
  FROM public.installations i
  WHERE i.project_id = p_project_id
    AND (
      i.engineer_id = p_profile_id
      OR (p_survey_ids IS NOT NULL AND cardinality(p_survey_ids) > 0 AND i.survey_id = ANY (p_survey_ids))
    )
  ORDER BY i.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

COMMENT ON FUNCTION public.installer_visible_installations_count(text, text, text[]) IS 'Row count for installations visible to an installer profile';
COMMENT ON FUNCTION public.installer_visible_installations_page(text, text, text[], int, int) IS 'Paginated installation rows for an installer (engineer on row OR assigned survey)';

REVOKE ALL ON FUNCTION public.installer_visible_installations_count(text, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.installer_visible_installations_page(text, text, text[], int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.installer_visible_installations_count(text, text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.installer_visible_installations_page(text, text, text[], int, int) TO service_role;
