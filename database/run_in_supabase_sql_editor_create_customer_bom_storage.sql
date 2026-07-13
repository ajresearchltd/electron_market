-- Run manually in Supabase SQL Editor.
-- This file contains executable SQL only.
-- Do NOT paste Codex prompts, reports, file names, or markdown into Supabase SQL Editor.
-- Electron Market - Private customer BOM file storage bucket.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'customer-bom-files',
  'customer-bom-files',
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

DROP POLICY IF EXISTS "Customers can view own bom files" ON storage.objects;
CREATE POLICY "Customers can view own bom files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'customer-bom-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Customers can upload own bom files" ON storage.objects;
CREATE POLICY "Customers can upload own bom files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'customer-bom-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Customers can update own bom files" ON storage.objects;
CREATE POLICY "Customers can update own bom files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'customer-bom-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'customer-bom-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Customers can delete own bom files" ON storage.objects;
CREATE POLICY "Customers can delete own bom files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'customer-bom-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

NOTIFY pgrst, 'reload schema';
