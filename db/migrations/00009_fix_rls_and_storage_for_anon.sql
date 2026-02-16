-- Fix "new row violates row-level security policy" for survey create.
-- Run this in Supabase SQL Editor. It does three things:
-- 1) Disable RLS on app tables (surveys, projects, installations, inspections)
-- 2) Ensure storage bucket solar_bucket exists
-- 3) Allow anon to read/upload/update/delete files in solar_bucket

-- ========== 1. Disable RLS on app tables ==========
ALTER TABLE public.surveys DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.installations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspections DISABLE ROW LEVEL SECURITY;

-- ========== 2. Ensure bucket exists ==========
INSERT INTO storage.buckets (id, name, public)
VALUES ('solar_bucket', 'solar_bucket', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ========== 3. Storage: allow anon to use solar_bucket ==========
-- Drop existing policies that might restrict anon (by name), then create anon-friendly ones.

DROP POLICY IF EXISTS "Anon read survey uploads" ON storage.objects;
DROP POLICY IF EXISTS "Anon upload survey documents" ON storage.objects;
DROP POLICY IF EXISTS "Anon update survey documents" ON storage.objects;
DROP POLICY IF EXISTS "Survey uploads are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload survey documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update survey documents" ON storage.objects;

CREATE POLICY "Anon read survey uploads" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'solar_bucket');

CREATE POLICY "Anon upload survey documents" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'solar_bucket');

CREATE POLICY "Anon update survey documents" ON storage.objects
  FOR UPDATE TO anon
  USING (bucket_id = 'solar_bucket')
  WITH CHECK (bucket_id = 'solar_bucket');

-- Optional: allow anon to delete (for replace/remove)
DROP POLICY IF EXISTS "Anon delete survey documents" ON storage.objects;
CREATE POLICY "Anon delete survey documents" ON storage.objects
  FOR DELETE TO anon USING (bucket_id = 'solar_bucket');
