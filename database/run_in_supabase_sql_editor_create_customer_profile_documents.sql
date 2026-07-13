-- Run manually in Supabase SQL Editor.
-- This file contains executable SQL only.
-- Do NOT paste Codex prompts, reports, file names, or markdown into Supabase SQL Editor.
-- Do NOT run without RLS.
-- Electron Market - Customer profile document metadata.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
