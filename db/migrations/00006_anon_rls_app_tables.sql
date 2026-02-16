-- Allow anon role to use app tables when the app uses anon key without sign-in.
-- Fixes: "new row violates row-level security policy" on survey update (and create/list).
-- Uses DROP IF EXISTS so this migration is safe to re-run.

-- Surveys: anon can SELECT, INSERT, UPDATE (so survey create/edit/view work)
DROP POLICY IF EXISTS "Anon surveys" ON public.surveys;
CREATE POLICY "Anon surveys" ON public.surveys
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Projects: anon can read and write (for dropdowns and assignments)
DROP POLICY IF EXISTS "Anon projects" ON public.projects;
CREATE POLICY "Anon projects" ON public.projects
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Installations: anon can full CRUD
DROP POLICY IF EXISTS "Anon installations" ON public.installations;
CREATE POLICY "Anon installations" ON public.installations
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Inspections: anon can full CRUD
DROP POLICY IF EXISTS "Anon inspections" ON public.inspections;
CREATE POLICY "Anon inspections" ON public.inspections
  FOR ALL TO anon USING (true) WITH CHECK (true);
