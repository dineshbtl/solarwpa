-- Add project_id to surveys so surveys can be attached to a project
ALTER TABLE public.surveys
  ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_surveys_project_id ON public.surveys(project_id);

COMMENT ON COLUMN public.surveys.project_id IS 'Project this survey belongs to (e.g. Kurnool).';
