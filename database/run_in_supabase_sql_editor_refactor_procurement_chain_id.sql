-- Run manually in Supabase SQL Editor.
-- This file contains executable SQL only.
-- Do NOT paste Codex prompts, reports, file names, or markdown into Supabase SQL Editor.
-- Electron Market - Canonical procurement chain UUID refactor.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SEQUENCE IF NOT EXISTS public.procurement_number_seq START WITH 1;

CREATE OR REPLACE FUNCTION public.generate_procurement_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_number bigint;
BEGIN
  next_number := nextval('public.procurement_number_seq');
  RETURN 'PR-' || to_char(now(), 'YYYY') || '-' || lpad(next_number::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.set_procurement_chain_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.procurement_chains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procurement_number text NOT NULL UNIQUE DEFAULT public.generate_procurement_number(),
  customer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_company_name text,
  supplier_company_name text,
  document_name text,
  customer_reference text,
  source_type text,
  source_record_id uuid,
  source_bom_upload_id uuid NULL,
  source_rfq_id uuid NULL,
  source_quote_id uuid NULL,
  source_invoice_id uuid NULL,
  source_waybill_id uuid NULL,
  source_receive_order_id uuid NULL,
  current_stage text DEFAULT 'bom_received',
  current_stage_label text DEFAULT 'BOM received',
  status text DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS procurement_chains_source_unique
  ON public.procurement_chains(source_type, source_record_id)
  WHERE source_type IS NOT NULL AND source_record_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_procurement_chains_customer_user_id
  ON public.procurement_chains(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_procurement_chains_supplier_user_id
  ON public.procurement_chains(supplier_user_id);
CREATE INDEX IF NOT EXISTS idx_procurement_chains_procurement_number
  ON public.procurement_chains(procurement_number);

DROP TRIGGER IF EXISTS procurement_chains_set_updated_at ON public.procurement_chains;
CREATE TRIGGER procurement_chains_set_updated_at
BEFORE UPDATE ON public.procurement_chains
FOR EACH ROW
EXECUTE FUNCTION public.set_procurement_chain_updated_at();

ALTER TABLE public.procurement_chains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can select own procurement chains" ON public.procurement_chains;
CREATE POLICY "Customers can select own procurement chains"
  ON public.procurement_chains
  FOR SELECT
  TO authenticated
  USING (customer_user_id = auth.uid());

DROP POLICY IF EXISTS "Customers can insert own procurement chains" ON public.procurement_chains;
CREATE POLICY "Customers can insert own procurement chains"
  ON public.procurement_chains
  FOR INSERT
  TO authenticated
  WITH CHECK (customer_user_id = auth.uid());

DROP POLICY IF EXISTS "Customers can update own procurement chains" ON public.procurement_chains;
CREATE POLICY "Customers can update own procurement chains"
  ON public.procurement_chains
  FOR UPDATE
  TO authenticated
  USING (customer_user_id = auth.uid())
  WITH CHECK (customer_user_id = auth.uid());

DROP POLICY IF EXISTS "Suppliers can select assigned procurement chains" ON public.procurement_chains;
CREATE POLICY "Suppliers can select assigned procurement chains"
  ON public.procurement_chains
  FOR SELECT
  TO authenticated
  USING (supplier_user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage procurement chains" ON public.procurement_chains;
CREATE POLICY "Admins can manage procurement chains"
  ON public.procurement_chains
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'));

ALTER TABLE public.customer_bom_uploads ADD COLUMN IF NOT EXISTS procurement_chain_id uuid NULL;
ALTER TABLE public.customer_bom_upload_items ADD COLUMN IF NOT EXISTS procurement_chain_id uuid NULL;
ALTER TABLE public.rfq ADD COLUMN IF NOT EXISTS procurement_chain_id uuid NULL;
ALTER TABLE public.rfq_items ADD COLUMN IF NOT EXISTS procurement_chain_id uuid NULL;
ALTER TABLE public.rfq_quotes ADD COLUMN IF NOT EXISTS procurement_chain_id uuid NULL;
ALTER TABLE public.rfq_quote_items ADD COLUMN IF NOT EXISTS procurement_chain_id uuid NULL;
ALTER TABLE public.rfq_orders0 ADD COLUMN IF NOT EXISTS procurement_chain_id uuid NULL;
ALTER TABLE public.rfq_order_items0 ADD COLUMN IF NOT EXISTS procurement_chain_id uuid NULL;
ALTER TABLE public.supplier_quotes0 ADD COLUMN IF NOT EXISTS procurement_chain_id uuid NULL;
ALTER TABLE public.supplier_quote_items0 ADD COLUMN IF NOT EXISTS procurement_chain_id uuid NULL;
ALTER TABLE public.active_orders ADD COLUMN IF NOT EXISTS procurement_chain_id uuid NULL;
ALTER TABLE public.active_order_items ADD COLUMN IF NOT EXISTS procurement_chain_id uuid NULL;
ALTER TABLE public.procurement_progress ADD COLUMN IF NOT EXISTS procurement_chain_id uuid NULL;
ALTER TABLE public.procurement_progress ADD COLUMN IF NOT EXISTS customer_reference text NULL;
ALTER TABLE public.procurement_invoices ADD COLUMN IF NOT EXISTS procurement_chain_id uuid NULL;
ALTER TABLE public.procurement_invoice_items ADD COLUMN IF NOT EXISTS procurement_chain_id uuid NULL;
ALTER TABLE public.procurement_waybills ADD COLUMN IF NOT EXISTS procurement_chain_id uuid NULL;
ALTER TABLE public.procurement_waybill_items ADD COLUMN IF NOT EXISTS procurement_chain_id uuid NULL;
ALTER TABLE public.procurement_receive_orders ADD COLUMN IF NOT EXISTS procurement_chain_id uuid NULL;
ALTER TABLE public.procurement_receive_order_items ADD COLUMN IF NOT EXISTS procurement_chain_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_customer_bom_uploads_procurement_chain_id ON public.customer_bom_uploads(procurement_chain_id);
CREATE INDEX IF NOT EXISTS idx_customer_bom_upload_items_procurement_chain_id ON public.customer_bom_upload_items(procurement_chain_id);
CREATE INDEX IF NOT EXISTS idx_rfq_procurement_chain_id ON public.rfq(procurement_chain_id);
CREATE INDEX IF NOT EXISTS idx_rfq_items_procurement_chain_id ON public.rfq_items(procurement_chain_id);
CREATE INDEX IF NOT EXISTS idx_rfq_quotes_procurement_chain_id ON public.rfq_quotes(procurement_chain_id);
CREATE INDEX IF NOT EXISTS idx_rfq_quote_items_procurement_chain_id ON public.rfq_quote_items(procurement_chain_id);
CREATE INDEX IF NOT EXISTS idx_rfq_orders0_procurement_chain_id ON public.rfq_orders0(procurement_chain_id);
CREATE INDEX IF NOT EXISTS idx_rfq_order_items0_procurement_chain_id ON public.rfq_order_items0(procurement_chain_id);
CREATE INDEX IF NOT EXISTS idx_supplier_quotes0_procurement_chain_id ON public.supplier_quotes0(procurement_chain_id);
CREATE INDEX IF NOT EXISTS idx_supplier_quote_items0_procurement_chain_id ON public.supplier_quote_items0(procurement_chain_id);
CREATE INDEX IF NOT EXISTS idx_active_orders_procurement_chain_id ON public.active_orders(procurement_chain_id);
CREATE INDEX IF NOT EXISTS idx_active_order_items_procurement_chain_id ON public.active_order_items(procurement_chain_id);
CREATE UNIQUE INDEX IF NOT EXISTS procurement_progress_chain_unique ON public.procurement_progress(procurement_chain_id) WHERE procurement_chain_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_procurement_invoices_procurement_chain_id ON public.procurement_invoices(procurement_chain_id);
CREATE INDEX IF NOT EXISTS idx_procurement_invoice_items_procurement_chain_id ON public.procurement_invoice_items(procurement_chain_id);
CREATE INDEX IF NOT EXISTS idx_procurement_waybills_procurement_chain_id ON public.procurement_waybills(procurement_chain_id);
CREATE INDEX IF NOT EXISTS idx_procurement_waybill_items_procurement_chain_id ON public.procurement_waybill_items(procurement_chain_id);
CREATE INDEX IF NOT EXISTS idx_procurement_receive_orders_procurement_chain_id ON public.procurement_receive_orders(procurement_chain_id);
CREATE INDEX IF NOT EXISTS idx_procurement_receive_order_items_procurement_chain_id ON public.procurement_receive_order_items(procurement_chain_id);

INSERT INTO public.procurement_chains (
  id,
  procurement_number,
  customer_user_id,
  supplier_user_id,
  admin_user_id,
  customer_company_name,
  supplier_company_name,
  document_name,
  customer_reference,
  source_type,
  source_record_id,
  source_bom_upload_id,
  source_rfq_id,
  source_quote_id,
  source_invoice_id,
  source_waybill_id,
  source_receive_order_id,
  current_stage,
  current_stage_label,
  created_at,
  updated_at
)
SELECT
  id,
  procurement_number,
  customer_user_id,
  supplier_user_id,
  admin_user_id,
  customer_company_name,
  supplier_company_name,
  document_name,
  document_name,
  source_type,
  COALESCE(source_bom_upload_id, source_rfq_id, source_quote_id, source_invoice_id, source_waybill_id, source_receive_order_id),
  source_bom_upload_id,
  source_rfq_id,
  source_quote_id,
  source_invoice_id,
  source_waybill_id,
  source_receive_order_id,
  current_stage,
  current_stage_label,
  created_at,
  updated_at
FROM public.procurement_cases
ON CONFLICT (id) DO NOTHING;

UPDATE public.customer_bom_uploads
SET procurement_chain_id = procurement_case_id
WHERE procurement_chain_id IS NULL AND procurement_case_id IS NOT NULL;
UPDATE public.customer_bom_upload_items
SET procurement_chain_id = procurement_case_id
WHERE procurement_chain_id IS NULL AND procurement_case_id IS NOT NULL;
UPDATE public.rfq
SET procurement_chain_id = procurement_case_id
WHERE procurement_chain_id IS NULL AND procurement_case_id IS NOT NULL;
UPDATE public.rfq_items
SET procurement_chain_id = procurement_case_id
WHERE procurement_chain_id IS NULL AND procurement_case_id IS NOT NULL;
UPDATE public.rfq_quotes
SET procurement_chain_id = procurement_case_id
WHERE procurement_chain_id IS NULL AND procurement_case_id IS NOT NULL;
UPDATE public.rfq_quote_items
SET procurement_chain_id = procurement_case_id
WHERE procurement_chain_id IS NULL AND procurement_case_id IS NOT NULL;
UPDATE public.rfq_orders0
SET procurement_chain_id = procurement_case_id
WHERE procurement_chain_id IS NULL AND procurement_case_id IS NOT NULL;
UPDATE public.rfq_order_items0
SET procurement_chain_id = procurement_case_id
WHERE procurement_chain_id IS NULL AND procurement_case_id IS NOT NULL;
UPDATE public.supplier_quotes0
SET procurement_chain_id = procurement_case_id
WHERE procurement_chain_id IS NULL AND procurement_case_id IS NOT NULL;
UPDATE public.supplier_quote_items0
SET procurement_chain_id = procurement_case_id
WHERE procurement_chain_id IS NULL AND procurement_case_id IS NOT NULL;
UPDATE public.active_orders
SET procurement_chain_id = procurement_case_id
WHERE procurement_chain_id IS NULL AND procurement_case_id IS NOT NULL;
UPDATE public.active_order_items
SET procurement_chain_id = procurement_case_id
WHERE procurement_chain_id IS NULL AND procurement_case_id IS NOT NULL;
UPDATE public.procurement_progress
SET procurement_chain_id = procurement_case_id,
    customer_reference = COALESCE(customer_reference, document_name)
WHERE procurement_chain_id IS NULL AND procurement_case_id IS NOT NULL;
UPDATE public.procurement_invoices
SET procurement_chain_id = procurement_case_id
WHERE procurement_chain_id IS NULL AND procurement_case_id IS NOT NULL;
UPDATE public.procurement_invoice_items
SET procurement_chain_id = procurement_case_id
WHERE procurement_chain_id IS NULL AND procurement_case_id IS NOT NULL;
UPDATE public.procurement_waybills
SET procurement_chain_id = procurement_case_id
WHERE procurement_chain_id IS NULL AND procurement_case_id IS NOT NULL;
UPDATE public.procurement_waybill_items
SET procurement_chain_id = procurement_case_id
WHERE procurement_chain_id IS NULL AND procurement_case_id IS NOT NULL;
UPDATE public.procurement_receive_orders
SET procurement_chain_id = procurement_case_id
WHERE procurement_chain_id IS NULL AND procurement_case_id IS NOT NULL;
UPDATE public.procurement_receive_order_items
SET procurement_chain_id = procurement_case_id
WHERE procurement_chain_id IS NULL AND procurement_case_id IS NOT NULL;

UPDATE public.customer_bom_uploads AS document
SET procurement_chain_id = chain.id
FROM public.procurement_chains AS chain
WHERE document.procurement_chain_id IS NULL
  AND document.procurement_number = chain.procurement_number;
UPDATE public.procurement_progress AS progress
SET procurement_chain_id = chain.id,
    customer_reference = COALESCE(progress.customer_reference, progress.document_name)
FROM public.procurement_chains AS chain
WHERE progress.procurement_chain_id IS NULL
  AND progress.procurement_number = chain.procurement_number;

DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'customer_bom_uploads',
    'customer_bom_upload_items',
    'rfq',
    'rfq_items',
    'rfq_quotes',
    'rfq_quote_items',
    'rfq_orders0',
    'rfq_order_items0',
    'supplier_quotes0',
    'supplier_quote_items0',
    'active_orders',
    'active_order_items',
    'procurement_progress',
    'procurement_invoices',
    'procurement_invoice_items',
    'procurement_waybills',
    'procurement_waybill_items',
    'procurement_receive_orders',
    'procurement_receive_order_items'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = target_table || '_procurement_chain_id_fkey'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (procurement_chain_id) REFERENCES public.procurement_chains(id) ON DELETE SET NULL',
        target_table,
        target_table || '_procurement_chain_id_fkey'
      );
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE VIEW public.procurement_chain_backfill_review AS
SELECT
  'procurement_progress'::text AS source_table,
  id AS source_id,
  progress_number::text AS source_number,
  procurement_number,
  document_name AS customer_reference,
  customer_user_id,
  created_at
FROM public.procurement_progress
WHERE procurement_chain_id IS NULL
UNION ALL
SELECT
  'customer_bom_uploads'::text AS source_table,
  id AS source_id,
  upload_number::text AS source_number,
  procurement_number,
  document_name AS customer_reference,
  user_id AS customer_user_id,
  created_at
FROM public.customer_bom_uploads
WHERE procurement_chain_id IS NULL
UNION ALL
SELECT
  'rfq_orders0'::text AS source_table,
  rfq_id AS source_id,
  order_number AS source_number,
  procurement_number,
  order_number AS customer_reference,
  customer_id AS customer_user_id,
  created_at
FROM public.rfq_orders0
WHERE procurement_chain_id IS NULL;

NOTIFY pgrst, 'reload schema';
