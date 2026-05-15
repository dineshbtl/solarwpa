-- Single-query KPI for installations per project (avoids 4 round-trips from PostgREST).
-- project_id on installations is TEXT (see 00001_solar_epc_schema.sql).
DROP FUNCTION IF EXISTS public.installation_kpi_counts(uuid);

CREATE OR REPLACE FUNCTION public.installation_kpi_counts(p_project_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'pending', COALESCE(COUNT(*) FILTER (WHERE status = 'pending'), 0),
    'in_progress', COALESCE(COUNT(*) FILTER (WHERE status = 'in_progress'), 0),
    'completed', COALESCE(COUNT(*) FILTER (WHERE status = 'completed'), 0),
    'inspection_pending', COALESCE(COUNT(*) FILTER (WHERE status = 'inspection_pending'), 0)
  )
  FROM public.installations
  WHERE project_id = p_project_id;
$$;

COMMENT ON FUNCTION public.installation_kpi_counts(text) IS 'Aggregated installation counts by status for KPI cards';

REVOKE ALL ON FUNCTION public.installation_kpi_counts(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.installation_kpi_counts(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.installation_kpi_counts(text) TO authenticated;
