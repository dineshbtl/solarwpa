-- Explicit anon policies for storage.objects (solar_bucket).
-- The app uses the anon key for uploads; "TO public" may not allow anon in all setups.
-- Fixes: "new row violates row-level security policy" when uploading survey documents.

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
