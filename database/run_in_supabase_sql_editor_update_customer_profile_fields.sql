-- Run manually in Supabase SQL Editor.
-- This file contains executable SQL only.
-- Do NOT paste Codex prompts, reports, file names, or markdown into Supabase SQL Editor.
-- Do NOT run without RLS.
-- Electron Market - Customer profile fields.

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
