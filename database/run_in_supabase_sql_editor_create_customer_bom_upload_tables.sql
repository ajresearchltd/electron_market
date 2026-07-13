-- Run manually in Supabase SQL Editor.
-- This file contains executable SQL only.
-- Do NOT paste Codex prompts, reports, file names, or markdown into Supabase SQL Editor.
-- Electron Market - Customer BOM upload documents and normalized BOM rows.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.customer_bom_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  user_id uuid NOT NULL,
  customer_profile_id uuid NULL,
  rfq_id uuid NULL,
  document_name text NOT NULL,
  customer_company_name text,
  contact_person text,
  contact_email text,
  contact_phone text,
  project_name text,
  project_description text,
  destination_country text,
  required_delivery_date date,
  target_budget numeric,
  budget_currency text DEFAULT 'USD',
  preferred_incoterms text,
  preferred_origin_country text,
  authorized_suppliers_only boolean DEFAULT false,
  allow_substitutes boolean DEFAULT false,
  manufacturers_only boolean DEFAULT false,
  original_file_name text,
  file_url text,
  file_path text,
  file_type text,
  total_rows integer DEFAULT 0,
  valid_rows integer DEFAULT 0,
  warning_rows integer DEFAULT 0,
  error_rows integer DEFAULT 0,
  status text DEFAULT 'uploaded',
  ai_processing_status text DEFAULT 'not_started',
  column_mapping jsonb DEFAULT '{}'::jsonb,
  main_column_mapping jsonb DEFAULT '{}'::jsonb,
  secondary_column_mapping jsonb DEFAULT '{}'::jsonb,
  unmapped_columns jsonb DEFAULT '[]'::jsonb,
  column_mapping_confidence jsonb DEFAULT '{}'::jsonb,
  column_mapping_warnings jsonb DEFAULT '[]'::jsonb,
  ai_summary text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_bom_upload_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid NOT NULL REFERENCES public.customer_bom_uploads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  row_number integer NOT NULL,
  line_number text,
  part_number text,
  normalized_part_number text,
  manufacturer text,
  manufacturer_part_number text,
  product_name text,
  description text,
  specification text,
  package_case text,
  quantity numeric,
  unit text DEFAULT 'pcs',
  target_unit_price numeric,
  target_currency text DEFAULT 'USD',
  acceptable_alternatives text,
  allow_substitute boolean,
  authorized_suppliers_only boolean,
  preferred_origin_country text,
  date_code_requirement text,
  rohs_required boolean,
  reach_required boolean,
  datasheet_url text,
  notes text,
  customer_comment text,
  ai_normalized_json jsonb DEFAULT '{}'::jsonb,
  ai_detected_issues jsonb DEFAULT '[]'::jsonb,
  suggested_corrections jsonb DEFAULT '{}'::jsonb,
  validation_status text DEFAULT 'pending',
  validation_errors jsonb DEFAULT '[]'::jsonb,
  validation_warnings jsonb DEFAULT '[]'::jsonb,
  part_number_check_status text,
  part_number_check_message text,
  part_number_check_source text,
  import_status text DEFAULT 'pending',
  created_rfq_item_id uuid NULL,
  raw_row_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_bom_uploads_user_id
  ON public.customer_bom_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_bom_upload_items_upload_id
  ON public.customer_bom_upload_items(upload_id);
CREATE INDEX IF NOT EXISTS idx_customer_bom_upload_items_user_id
  ON public.customer_bom_upload_items(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_bom_upload_items_normalized_part_number
  ON public.customer_bom_upload_items(normalized_part_number);

ALTER TABLE public.customer_bom_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_bom_upload_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can select own bom uploads" ON public.customer_bom_uploads;
CREATE POLICY "Customers can select own bom uploads"
  ON public.customer_bom_uploads
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can insert own bom uploads" ON public.customer_bom_uploads;
CREATE POLICY "Customers can insert own bom uploads"
  ON public.customer_bom_uploads
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can update own bom uploads" ON public.customer_bom_uploads;
CREATE POLICY "Customers can update own bom uploads"
  ON public.customer_bom_uploads
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can delete own bom uploads" ON public.customer_bom_uploads;
CREATE POLICY "Customers can delete own bom uploads"
  ON public.customer_bom_uploads
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can select own bom upload items" ON public.customer_bom_upload_items;
CREATE POLICY "Customers can select own bom upload items"
  ON public.customer_bom_upload_items
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can insert own bom upload items" ON public.customer_bom_upload_items;
CREATE POLICY "Customers can insert own bom upload items"
  ON public.customer_bom_upload_items
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can update own bom upload items" ON public.customer_bom_upload_items;
CREATE POLICY "Customers can update own bom upload items"
  ON public.customer_bom_upload_items
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can delete own bom upload items" ON public.customer_bom_upload_items;
CREATE POLICY "Customers can delete own bom upload items"
  ON public.customer_bom_upload_items
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
