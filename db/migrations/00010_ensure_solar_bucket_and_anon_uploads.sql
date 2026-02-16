-- Ensure storage bucket solar_bucket exists and anon can upload (fix RLS on storage.objects).
-- Safe to run multiple times. Run in Supabase SQL Editor or via psql.

INSERT INTO storage.buckets (id, name, public)
VALUES ('solar_bucket', 'solar_bucket', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Survey uploads are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload survey documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update survey documents" ON storage.objects;
DROP POLICY IF EXISTS "Anon read survey uploads" ON storage.objects;
DROP POLICY IF EXISTS "Anon upload survey documents" ON storage.objects;
DROP POLICY IF EXISTS "Anon update survey documents" ON storage.objects;
DROP POLICY IF EXISTS "Anon delete survey documents" ON storage.objects;

CREATE POLICY "Anon read survey uploads" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'solar_bucket');

CREATE POLICY "Anon upload survey documents" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'solar_bucket');

CREATE POLICY "Anon update survey documents" ON storage.objects
  FOR UPDATE TO anon
  USING (bucket_id = 'solar_bucket')
  WITH CHECK (bucket_id = 'solar_bucket');

CREATE POLICY "Anon delete survey documents" ON storage.objects
  FOR DELETE TO anon USING (bucket_id = 'solar_bucket');
