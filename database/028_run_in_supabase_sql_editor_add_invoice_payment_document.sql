-- Manual Supabase SQL Editor migration. Do not run automatically.
-- Adds canonical Invoice payment-document status and metadata.

ALTER TABLE public.procurement_invoices
  ADD COLUMN IF NOT EXISTS paid_boolean boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS paid_document_path text NULL,
  ADD COLUMN IF NOT EXISTS paid_document_original_name text NULL,
  ADD COLUMN IF NOT EXISTS paid_document_mime_type text NULL,
  ADD COLUMN IF NOT EXISTS paid_document_size_bytes bigint NULL,
  ADD COLUMN IF NOT EXISTS paid_document_uploaded_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS paid_document_uploaded_by uuid NULL
    REFERENCES auth.users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.procurement_invoices'::regclass
      AND conname = 'procurement_invoices_paid_document_required_check'
  ) THEN
    ALTER TABLE public.procurement_invoices
      ADD CONSTRAINT procurement_invoices_paid_document_required_check
      CHECK (paid_boolean = false OR paid_document_path IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.procurement_invoices'::regclass
      AND conname = 'procurement_invoices_paid_document_size_check'
  ) THEN
    ALTER TABLE public.procurement_invoices
      ADD CONSTRAINT procurement_invoices_paid_document_size_check
      CHECK (paid_document_size_bytes IS NULL OR paid_document_size_bytes > 0);
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
