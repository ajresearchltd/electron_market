CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Electron Market - Supplier company profile, contacts, document metadata, and private storage bucket.
-- Run manually in Supabase SQL Editor. This file only creates new supplier profile structures.

-- =========================================================
-- TABLE: supplier_company_profiles
-- =========================================================
CREATE TABLE IF NOT EXISTS public.supplier_company_profiles (
  profile_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text,
  business_registration_number text,
  tax_vat_number text,
  country_iso2 text,
  country_name text,
  legal_address text,
  office_address text,
  website text,
  company_phone text,
  company_email text,
  main_contact_name text,
  main_contact_position text,
  main_contact_email text,
  main_contact_phone text,
  company_description text,
  product_categories_text text,
  years_in_business integer,
  bank_account_holder_name text,
  bank_name text,
  bank_country_iso2 text,
  bank_country_name text,
  bank_address text,
  account_number text,
  iban text,
  swift_bic text,
  payment_currency text DEFAULT 'USD',
  payment_notes text,
  verification_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_company_profiles_verification_status_check
    CHECK (verification_status IN ('pending', 'in_review', 'approved', 'rejected', 'needs_update'))
);

ALTER TABLE public.supplier_company_profiles ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_supplier_company_profiles_user_id
  ON public.supplier_company_profiles(user_id);

-- =========================================================
-- TABLE: supplier_company_contacts
-- =========================================================
CREATE TABLE IF NOT EXISTS public.supplier_company_contacts (
  contact_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.supplier_company_profiles(profile_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_index integer NOT NULL,
  contact_name text,
  contact_position text,
  contact_email text,
  contact_phone text,
  contact_whatsapp text,
  contact_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_company_contacts_profile_index_unique UNIQUE (profile_id, contact_index)
);

ALTER TABLE public.supplier_company_contacts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_supplier_company_contacts_profile_id
  ON public.supplier_company_contacts(profile_id);
CREATE INDEX IF NOT EXISTS idx_supplier_company_contacts_user_id
  ON public.supplier_company_contacts(user_id);

-- =========================================================
-- TABLE: supplier_company_documents
-- =========================================================
CREATE TABLE IF NOT EXISTS public.supplier_company_documents (
  document_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.supplier_company_profiles(profile_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_slot integer NOT NULL,
  document_type text NOT NULL,
  document_title text,
  file_name text,
  file_mime_type text,
  file_size_bytes bigint,
  storage_bucket text NOT NULL DEFAULT 'supplier-company-documents',
  storage_path text,
  document_status text NOT NULL DEFAULT 'uploaded',
  uploaded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_company_documents_profile_slot_unique UNIQUE (profile_id, document_slot),
  CONSTRAINT supplier_company_documents_type_check
    CHECK (document_type IN ('company_registration', 'articles_of_association', 'tax_certificate', 'company_photo', 'product_photo', 'bank_confirmation', 'other')),
  CONSTRAINT supplier_company_documents_status_check
    CHECK (document_status IN ('missing', 'uploaded', 'in_review', 'approved', 'rejected'))
);

ALTER TABLE public.supplier_company_documents ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_supplier_company_documents_profile_id
  ON public.supplier_company_documents(profile_id);
CREATE INDEX IF NOT EXISTS idx_supplier_company_documents_user_id
  ON public.supplier_company_documents(user_id);

-- =========================================================
-- UPDATED_AT TRIGGERS
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_supplier_company_profile_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS supplier_company_profiles_set_updated_at ON public.supplier_company_profiles;
CREATE TRIGGER supplier_company_profiles_set_updated_at
BEFORE UPDATE ON public.supplier_company_profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_supplier_company_profile_updated_at();

DROP TRIGGER IF EXISTS supplier_company_contacts_set_updated_at ON public.supplier_company_contacts;
CREATE TRIGGER supplier_company_contacts_set_updated_at
BEFORE UPDATE ON public.supplier_company_contacts
FOR EACH ROW
EXECUTE FUNCTION public.set_supplier_company_profile_updated_at();

DROP TRIGGER IF EXISTS supplier_company_documents_set_updated_at ON public.supplier_company_documents;
CREATE TRIGGER supplier_company_documents_set_updated_at
BEFORE UPDATE ON public.supplier_company_documents
FOR EACH ROW
EXECUTE FUNCTION public.set_supplier_company_profile_updated_at();

-- =========================================================
-- TABLE RLS POLICIES
-- =========================================================
DROP POLICY IF EXISTS "Users can select own supplier company profile" ON public.supplier_company_profiles;
CREATE POLICY "Users can select own supplier company profile"
  ON public.supplier_company_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own supplier company profile" ON public.supplier_company_profiles;
CREATE POLICY "Users can insert own supplier company profile"
  ON public.supplier_company_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own supplier company profile" ON public.supplier_company_profiles;
CREATE POLICY "Users can update own supplier company profile"
  ON public.supplier_company_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can select own supplier company contacts" ON public.supplier_company_contacts;
CREATE POLICY "Users can select own supplier company contacts"
  ON public.supplier_company_contacts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own supplier company contacts" ON public.supplier_company_contacts;
CREATE POLICY "Users can insert own supplier company contacts"
  ON public.supplier_company_contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own supplier company contacts" ON public.supplier_company_contacts;
CREATE POLICY "Users can update own supplier company contacts"
  ON public.supplier_company_contacts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own supplier company contacts" ON public.supplier_company_contacts;
CREATE POLICY "Users can delete own supplier company contacts"
  ON public.supplier_company_contacts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can select own supplier company documents" ON public.supplier_company_documents;
CREATE POLICY "Users can select own supplier company documents"
  ON public.supplier_company_documents
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own supplier company documents" ON public.supplier_company_documents;
CREATE POLICY "Users can insert own supplier company documents"
  ON public.supplier_company_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own supplier company documents" ON public.supplier_company_documents;
CREATE POLICY "Users can update own supplier company documents"
  ON public.supplier_company_documents
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own supplier company documents" ON public.supplier_company_documents;
CREATE POLICY "Users can delete own supplier company documents"
  ON public.supplier_company_documents
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- =========================================================
-- PRIVATE STORAGE BUCKET AND STORAGE RLS POLICIES
-- =========================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'supplier-company-documents',
  'supplier-company-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = 10485760,
      allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png'];

-- Storage path format:
-- supplier-documents/{user_id}/{document_slot}-{timestamp}-{safe_file_name}
-- Policies below require authenticated users to operate only in their own user_id folder.
DROP POLICY IF EXISTS "Users can upload own supplier company documents" ON storage.objects;
CREATE POLICY "Users can upload own supplier company documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'supplier-company-documents'
    AND (storage.foldername(name))[1] = 'supplier-documents'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can read own supplier company documents" ON storage.objects;
CREATE POLICY "Users can read own supplier company documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'supplier-company-documents'
    AND (storage.foldername(name))[1] = 'supplier-documents'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update own supplier company documents" ON storage.objects;
CREATE POLICY "Users can update own supplier company documents"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'supplier-company-documents'
    AND (storage.foldername(name))[1] = 'supplier-documents'
    AND (storage.foldername(name))[2] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'supplier-company-documents'
    AND (storage.foldername(name))[1] = 'supplier-documents'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own supplier company documents" ON storage.objects;
CREATE POLICY "Users can delete own supplier company documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'supplier-company-documents'
    AND (storage.foldername(name))[1] = 'supplier-documents'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

NOTIFY pgrst, 'reload schema';
