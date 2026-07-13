-- Electron Market - Private storage bucket for supplier Excel/CSV stock upload files.
-- Run manually in Supabase SQL Editor before using Supplier Product List Upload.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'supplier-stock-uploads',
  'supplier-stock-uploads',
  false,
  20971520,
  ARRAY[
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = 20971520,
      allowed_mime_types = ARRAY[
        'text/csv',
        'application/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];

DROP POLICY IF EXISTS "Suppliers can upload own stock files" ON storage.objects;
CREATE POLICY "Suppliers can upload own stock files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'supplier-stock-uploads'
    AND (storage.foldername(name))[1] = 'supplier-stock-uploads'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Suppliers can read own stock files" ON storage.objects;
CREATE POLICY "Suppliers can read own stock files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'supplier-stock-uploads'
    AND (storage.foldername(name))[1] = 'supplier-stock-uploads'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

NOTIFY pgrst, 'reload schema';
