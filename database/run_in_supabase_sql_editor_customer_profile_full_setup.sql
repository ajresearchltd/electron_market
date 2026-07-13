-- Run manually in Supabase SQL Editor.
-- This file contains executable SQL only.
-- Do NOT paste Codex prompts, reports, file names, or markdown into Supabase SQL Editor.
-- Do NOT run without RLS.
-- Electron Market - Full customer profile setup.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.customer_company_profiles
ADD COLUMN IF NOT EXISTS contact_person text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS website text,
ADD COLUMN IF NOT EXISTS country text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS address_line1 text,
ADD COLUMN IF NOT EXISTS address_line2 text,
ADD COLUMN IF NOT EXISTS postal_code text,
ADD COLUMN IF NOT EXISTS state_region text,
ADD COLUMN IF NOT EXISTS registration_number text,
ADD COLUMN IF NOT EXISTS tax_vat_number text,
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS profile_photo_url text,
ADD COLUMN IF NOT EXISTS profile_photo_path text,
ADD COLUMN IF NOT EXISTS profile_photo_file_name text,
ADD COLUMN IF NOT EXISTS profile_photo_uploaded_at timestamptz,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.customer_company_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own customer company profile" ON public.customer_company_profiles;
CREATE POLICY "Users can view own customer company profile"
ON public.customer_company_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own customer company profile" ON public.customer_company_profiles;
CREATE POLICY "Users can insert own customer company profile"
ON public.customer_company_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own customer company profile" ON public.customer_company_profiles;
CREATE POLICY "Users can update own customer company profile"
ON public.customer_company_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.customer_profile_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  customer_profile_id uuid NULL,
  document_type text NOT NULL,
  file_name text NOT NULL,
  file_url text,
  file_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_profile_documents_user_type_uidx
ON public.customer_profile_documents(user_id, document_type);

ALTER TABLE public.customer_profile_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view own profile documents" ON public.customer_profile_documents;
CREATE POLICY "Customers can view own profile documents"
ON public.customer_profile_documents
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can insert own profile documents" ON public.customer_profile_documents;
CREATE POLICY "Customers can insert own profile documents"
ON public.customer_profile_documents
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can update own profile documents" ON public.customer_profile_documents;
CREATE POLICY "Customers can update own profile documents"
ON public.customer_profile_documents
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can delete own profile documents" ON public.customer_profile_documents;
CREATE POLICY "Customers can delete own profile documents"
ON public.customer_profile_documents
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

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
