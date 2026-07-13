CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Electron Market - Supplier product stock upload documents and parsed upload rows.
-- Run manually in Supabase SQL Editor before using Supplier Product List Upload.

CREATE TABLE IF NOT EXISTS public.supplier_stock_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  supplier_id uuid REFERENCES public.suppliers(supplier_id) ON DELETE SET NULL,
  uploaded_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  document_name text,
  supplier_company_name text,
  contact_person text,
  contact_email text,
  contact_phone text,
  supplier_country text,
  shipping_from_country text,
  default_currency text DEFAULT 'USD',
  default_incoterms text,
  nktrs_classification text,
  default_lead_time text,
  additional_notes text,
  original_file_name text,
  file_url text,
  file_type text,
  total_rows integer DEFAULT 0,
  valid_rows integer DEFAULT 0,
  error_rows integer DEFAULT 0,
  status text DEFAULT 'draft',
  ai_processing_status text DEFAULT 'not_started',
  ai_processing_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supplier_stock_upload_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid NOT NULL REFERENCES public.supplier_stock_uploads(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  part_number text,
  manufacturer text,
  supplier_sku text,
  product_name text,
  description text,
  package_case text,
  condition text,
  available_quantity integer,
  moq integer,
  unit text DEFAULT 'pcs',
  unit_price numeric,
  currency text DEFAULT 'USD',
  compare_at_price numeric,
  lead_time text,
  stock_location text,
  country_of_origin text,
  shipping_from text,
  incoterms text,
  datasheet_url text,
  product_image_url_1 text,
  product_image_url_2 text,
  product_image_url_3 text,
  product_image_url_4 text,
  product_image_url_5 text,
  product_image_url_6 text,
  product_image_url_7 text,
  product_image_url_8 text,
  product_image_url_9 text,
  product_video_url text,
  product_video_description text,
  warranty text,
  notes text,
  active boolean DEFAULT true,
  validation_status text DEFAULT 'pending',
  validation_errors jsonb DEFAULT '[]'::jsonb,
  ai_confidence jsonb DEFAULT '{}'::jsonb,
  raw_row_json jsonb,
  import_status text DEFAULT 'pending',
  created_product_id uuid REFERENCES public.products(product_id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.supplier_stock_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_stock_upload_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_supplier_stock_uploads_supplier_id
  ON public.supplier_stock_uploads(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_stock_uploads_uploaded_by_user_id
  ON public.supplier_stock_uploads(uploaded_by_user_id);
CREATE INDEX IF NOT EXISTS idx_supplier_stock_upload_items_upload_id
  ON public.supplier_stock_upload_items(upload_id);

DROP POLICY IF EXISTS "Suppliers can select own stock uploads" ON public.supplier_stock_uploads;
CREATE POLICY "Suppliers can select own stock uploads"
  ON public.supplier_stock_uploads
  FOR SELECT
  TO authenticated
  USING (uploaded_by_user_id = auth.uid());

DROP POLICY IF EXISTS "Suppliers can insert own stock uploads" ON public.supplier_stock_uploads;
CREATE POLICY "Suppliers can insert own stock uploads"
  ON public.supplier_stock_uploads
  FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by_user_id = auth.uid());

DROP POLICY IF EXISTS "Suppliers can update own stock uploads" ON public.supplier_stock_uploads;
CREATE POLICY "Suppliers can update own stock uploads"
  ON public.supplier_stock_uploads
  FOR UPDATE
  TO authenticated
  USING (uploaded_by_user_id = auth.uid())
  WITH CHECK (uploaded_by_user_id = auth.uid());

DROP POLICY IF EXISTS "Suppliers can select own stock upload items" ON public.supplier_stock_upload_items;
CREATE POLICY "Suppliers can select own stock upload items"
  ON public.supplier_stock_upload_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.supplier_stock_uploads
      WHERE supplier_stock_uploads.id = supplier_stock_upload_items.upload_id
        AND supplier_stock_uploads.uploaded_by_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Suppliers can insert own stock upload items" ON public.supplier_stock_upload_items;
CREATE POLICY "Suppliers can insert own stock upload items"
  ON public.supplier_stock_upload_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.supplier_stock_uploads
      WHERE supplier_stock_uploads.id = supplier_stock_upload_items.upload_id
        AND supplier_stock_uploads.uploaded_by_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Suppliers can update own stock upload items" ON public.supplier_stock_upload_items;
CREATE POLICY "Suppliers can update own stock upload items"
  ON public.supplier_stock_upload_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.supplier_stock_uploads
      WHERE supplier_stock_uploads.id = supplier_stock_upload_items.upload_id
        AND supplier_stock_uploads.uploaded_by_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.supplier_stock_uploads
      WHERE supplier_stock_uploads.id = supplier_stock_upload_items.upload_id
        AND supplier_stock_uploads.uploaded_by_user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
