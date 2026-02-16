-- Disable RLS on app tables so anon key can create/update/delete without policies.
-- Use this when RBAC/row-level security is not required for the project.
-- Run after 00002_rls_and_auth.sql (or 00006 if you added anon policies).
-- Safe to run: DISABLE does not drop policies; you can re-enable RLS later if needed.

ALTER TABLE public.surveys DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.installations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspections DISABLE ROW LEVEL SECURITY;
