-- Bucket для видео товаров: публичный, до 20 МБ, только mp4/webm.
-- Direct upload с клиента через signedUploadUrl (видео > serverless body limit).
-- Политики копируют паттерн product-images: пишут админы (JWT-claim is_admin), читают все (bucket public).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-videos', 'product-videos', true, 20971520, ARRAY['video/mp4', 'video/webm'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admins can upload product-videos" ON storage.objects;
CREATE POLICY "Admins can upload product-videos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-videos'
    AND COALESCE((auth.jwt() ->> 'is_admin')::boolean, false)
  );

DROP POLICY IF EXISTS "Admins can update product-videos" ON storage.objects;
CREATE POLICY "Admins can update product-videos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'product-videos'
    AND COALESCE((auth.jwt() ->> 'is_admin')::boolean, false)
  )
  WITH CHECK (
    bucket_id = 'product-videos'
    AND COALESCE((auth.jwt() ->> 'is_admin')::boolean, false)
  );

DROP POLICY IF EXISTS "Admins can delete product-videos" ON storage.objects;
CREATE POLICY "Admins can delete product-videos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product-videos'
    AND COALESCE((auth.jwt() ->> 'is_admin')::boolean, false)
  );
