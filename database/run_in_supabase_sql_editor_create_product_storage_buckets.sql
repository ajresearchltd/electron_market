-- Electron Market - Public storage buckets for supplier product images and documents.
-- Run manually in Supabase SQL Editor before using Supplier Add Product uploads.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 10485760,
      allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-documents',
  'product-documents',
  true,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 10485760,
      allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS "Anyone can read product images" ON storage.objects;
CREATE POLICY "Anyone can read product images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Suppliers can upload own product images" ON storage.objects;
CREATE POLICY "Suppliers can upload own product images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = 'supplier-products'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Suppliers can update own product images" ON storage.objects;
CREATE POLICY "Suppliers can update own product images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = 'supplier-products'
    AND (storage.foldername(name))[2] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = 'supplier-products'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Anyone can read product documents" ON storage.objects;
CREATE POLICY "Anyone can read product documents"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'product-documents');

DROP POLICY IF EXISTS "Suppliers can upload own product documents" ON storage.objects;
CREATE POLICY "Suppliers can upload own product documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-documents'
    AND (storage.foldername(name))[1] = 'supplier-products'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

NOTIFY pgrst, 'reload schema';
