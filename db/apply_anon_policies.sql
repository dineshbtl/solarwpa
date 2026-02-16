-- =============================================================================
-- Run this in Supabase SQL Editor (same project as your app).
-- App URL must match: NEXT_PUBLIC_SUPABASE_URL (e.g. http://YOUR_PUBLIC_IP:8000)
-- =============================================================================
-- Fixes: "new row violates row-level security policy" on survey update/create
-- and on file uploads. Ensures anon role can use app tables and storage.
-- =============================================================================

-- 1) App tables: anon can SELECT, INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Anon surveys" ON public.surveys;
CREATE POLICY "Anon surveys" ON public.surveys
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon projects" ON public.projects;
CREATE POLICY "Anon projects" ON public.projects
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon installations" ON public.installations;
CREATE POLICY "Anon installations" ON public.installations
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon inspections" ON public.inspections;
CREATE POLICY "Anon inspections" ON public.inspections
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- 2) Storage (solar_bucket): anon can read, upload, and update (for upsert)
DROP POLICY IF EXISTS "Anon read survey uploads" ON storage.objects;
CREATE POLICY "Anon read survey uploads" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'solar_bucket');

DROP POLICY IF EXISTS "Anon upload survey documents" ON storage.objects;
CREATE POLICY "Anon upload survey documents" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'solar_bucket');

DROP POLICY IF EXISTS "Anon update survey documents" ON storage.objects;
CREATE POLICY "Anon update survey documents" ON storage.objects
  FOR UPDATE TO anon
  USING (bucket_id = 'solar_bucket')
  WITH CHECK (bucket_id = 'solar_bucket');
