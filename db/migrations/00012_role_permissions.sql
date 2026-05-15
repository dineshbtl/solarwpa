-- Per-role permission sets (editable from Roles admin UI). Falls back to app defaults when a row is missing.

CREATE TABLE public.role_permissions (
  role text PRIMARY KEY CHECK (
    role IN ('admin', 'manager', 'engineer', 'surveyor', 'government')
  ),
  permissions text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.role_permissions DISABLE ROW LEVEL SECURITY;
