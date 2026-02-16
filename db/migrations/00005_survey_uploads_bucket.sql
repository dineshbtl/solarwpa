-- Survey uploads storage bucket for survey document images (Aadhar, PAN, etc.)
-- Run this in Supabase (Storage uses storage.buckets / storage.objects).
-- If you already created the bucket in Dashboard (e.g. solar_bucket, Public: on), skip the INSERT and run only the policies below.
-- If upload still fails with RLS, run 00007_anon_storage_policies.sql or 00009_fix_rls_and_storage_for_anon.sql.

INSERT INTO storage.buckets (id, name, public)
VALUES ('solar_bucket', 'solar_bucket', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow anyone to read files (public bucket)
CREATE POLICY "Survey uploads are publicly readable"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'solar_bucket');

-- Allow authenticated and anon to upload (app uses anon for client uploads)
CREATE POLICY "Anyone can upload survey documents"
ON storage.objects FOR INSERT TO public
WITH CHECK (bucket_id = 'solar_bucket');

-- Allow update/upsert for replace
CREATE POLICY "Anyone can update survey documents"
ON storage.objects FOR UPDATE TO public
USING (bucket_id = 'solar_bucket')
WITH CHECK (bucket_id = 'solar_bucket');
