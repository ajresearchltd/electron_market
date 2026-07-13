-- Run manually in Supabase SQL Editor.
-- This file contains executable SQL only.
-- Do NOT paste Codex prompts, reports, file names, or markdown into Supabase SQL Editor.
-- Do NOT run without RLS.
-- Electron Market - Customer profile photo and document storage buckets.

INSERT INTO storage.buckets (id, name, public)
VALUES ('customer-profile-documents', 'customer-profile-documents', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('customer-profile-photos', 'customer-profile-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Customers can view own profile document files" ON storage.objects;
CREATE POLICY "Customers can view own profile document files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'customer-profile-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Customers can upload own profile document files" ON storage.objects;
CREATE POLICY "Customers can upload own profile document files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'customer-profile-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Customers can update own profile document files" ON storage.objects;
CREATE POLICY "Customers can update own profile document files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'customer-profile-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'customer-profile-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Customers can delete own profile document files" ON storage.objects;
CREATE POLICY "Customers can delete own profile document files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'customer-profile-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Customers can view own profile photo files" ON storage.objects;
CREATE POLICY "Customers can view own profile photo files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'customer-profile-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Customers can upload own profile photo files" ON storage.objects;
CREATE POLICY "Customers can upload own profile photo files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'customer-profile-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Customers can update own profile photo files" ON storage.objects;
CREATE POLICY "Customers can update own profile photo files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'customer-profile-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'customer-profile-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Customers can delete own profile photo files" ON storage.objects;
CREATE POLICY "Customers can delete own profile photo files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'customer-profile-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
