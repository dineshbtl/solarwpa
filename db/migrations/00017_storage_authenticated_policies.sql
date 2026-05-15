-- Ensure both anon and authenticated can use solar_bucket uploads.

INSERT INTO storage.buckets (id, name, public)
VALUES ('solar_bucket', 'solar_bucket', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated read solar uploads" ON storage.objects;
CREATE POLICY "Authenticated read solar uploads" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'solar_bucket');

DROP POLICY IF EXISTS "Authenticated upload solar uploads" ON storage.objects;
CREATE POLICY "Authenticated upload solar uploads" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'solar_bucket');

DROP POLICY IF EXISTS "Authenticated update solar uploads" ON storage.objects;
CREATE POLICY "Authenticated update solar uploads" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'solar_bucket')
  WITH CHECK (bucket_id = 'solar_bucket');

DROP POLICY IF EXISTS "Authenticated delete solar uploads" ON storage.objects;
CREATE POLICY "Authenticated delete solar uploads" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'solar_bucket');
