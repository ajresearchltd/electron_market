-- Run manually in Supabase SQL Editor.
-- This file contains executable SQL only.
-- Do NOT paste Codex prompts, reports, file names, or markdown into Supabase SQL Editor.
-- Electron Market - Unified procurement document chain for BOM, RFQ, quote, invoice, waybill, and receive order.

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

CREATE OR REPLACE FUNCTION public.set_procurement_document_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.procurement_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procurement_number text NOT NULL UNIQUE DEFAULT public.generate_procurement_number(),
  customer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_company_name text,
  supplier_company_name text,
  document_name text,
  current_stage text DEFAULT 'bom_received',
  current_stage_label text DEFAULT 'BOM received',
  source_type text,
  source_bom_upload_id uuid NULL,
  source_rfq_id uuid NULL,
  source_quote_id uuid NULL,
  source_invoice_id uuid NULL,
  source_waybill_id uuid NULL,
  source_receive_order_id uuid NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.customer_bom_uploads
  ADD COLUMN IF NOT EXISTS procurement_case_id uuid NULL,
  ADD COLUMN IF NOT EXISTS procurement_number text NULL;

ALTER TABLE public.customer_bom_upload_items
  ADD COLUMN IF NOT EXISTS procurement_case_id uuid NULL,
  ADD COLUMN IF NOT EXISTS procurement_number text NULL;

ALTER TABLE public.rfq
  ADD COLUMN IF NOT EXISTS procurement_case_id uuid NULL,
  ADD COLUMN IF NOT EXISTS procurement_number text NULL;

ALTER TABLE public.rfq_items
  ADD COLUMN IF NOT EXISTS procurement_case_id uuid NULL,
  ADD COLUMN IF NOT EXISTS procurement_number text NULL;

ALTER TABLE public.rfq_quotes
  ADD COLUMN IF NOT EXISTS procurement_case_id uuid NULL,
  ADD COLUMN IF NOT EXISTS procurement_number text NULL;

ALTER TABLE public.rfq_quote_items
  ADD COLUMN IF NOT EXISTS procurement_case_id uuid NULL,
  ADD COLUMN IF NOT EXISTS procurement_number text NULL;

ALTER TABLE public.rfq_orders0
  ADD COLUMN IF NOT EXISTS procurement_case_id uuid NULL,
  ADD COLUMN IF NOT EXISTS procurement_number text NULL;

ALTER TABLE public.rfq_order_items0
  ADD COLUMN IF NOT EXISTS procurement_case_id uuid NULL,
  ADD COLUMN IF NOT EXISTS procurement_number text NULL;

ALTER TABLE public.supplier_quotes0
  ADD COLUMN IF NOT EXISTS procurement_case_id uuid NULL,
  ADD COLUMN IF NOT EXISTS procurement_number text NULL;

ALTER TABLE public.supplier_quote_items0
  ADD COLUMN IF NOT EXISTS procurement_case_id uuid NULL,
  ADD COLUMN IF NOT EXISTS procurement_number text NULL;

ALTER TABLE public.active_orders
  ADD COLUMN IF NOT EXISTS procurement_case_id uuid NULL,
  ADD COLUMN IF NOT EXISTS procurement_number text NULL;

ALTER TABLE public.active_order_items
  ADD COLUMN IF NOT EXISTS procurement_case_id uuid NULL,
  ADD COLUMN IF NOT EXISTS procurement_number text NULL;

ALTER TABLE public.procurement_progress
  ADD COLUMN IF NOT EXISTS procurement_case_id uuid NULL,
  ADD COLUMN IF NOT EXISTS procurement_number text NULL;

CREATE TABLE IF NOT EXISTS public.procurement_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procurement_case_id uuid NOT NULL REFERENCES public.procurement_cases(id) ON DELETE CASCADE,
  procurement_number text NOT NULL,
  invoice_number text,
  invoice_status text DEFAULT 'draft',
  customer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_company_name text,
  supplier_company_name text,
  invoice_date date,
  due_date date,
  currency text DEFAULT 'USD',
  subtotal numeric,
  tax_amount numeric,
  shipping_amount numeric,
  total_amount numeric,
  payment_status text DEFAULT 'unpaid',
  payment_reference text,
  payment_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.procurement_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.procurement_invoices(id) ON DELETE CASCADE,
  procurement_case_id uuid NOT NULL REFERENCES public.procurement_cases(id) ON DELETE CASCADE,
  procurement_number text NOT NULL,
  line_number integer,
  part_number text,
  manufacturer text,
  description text,
  quantity numeric,
  unit text DEFAULT 'pcs',
  unit_price numeric,
  currency text DEFAULT 'USD',
  line_total numeric,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.procurement_waybills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procurement_case_id uuid NOT NULL REFERENCES public.procurement_cases(id) ON DELETE CASCADE,
  procurement_number text NOT NULL,
  waybill_number text,
  waybill_status text DEFAULT 'draft',
  customer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  carrier text,
  tracking_number text,
  tracking_url text,
  ship_from_country text,
  ship_from_city text,
  ship_to_country text,
  ship_to_city text,
  ship_to_address text,
  shipped_date date,
  estimated_delivery_date date,
  actual_delivery_date date,
  package_count integer,
  gross_weight numeric,
  weight_unit text DEFAULT 'kg',
  shipment_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.procurement_waybill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waybill_id uuid NOT NULL REFERENCES public.procurement_waybills(id) ON DELETE CASCADE,
  procurement_case_id uuid NOT NULL REFERENCES public.procurement_cases(id) ON DELETE CASCADE,
  procurement_number text NOT NULL,
  line_number integer,
  part_number text,
  manufacturer text,
  description text,
  quantity numeric,
  unit text DEFAULT 'pcs',
  package_number text,
  hs_code text,
  country_of_origin text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.procurement_receive_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procurement_case_id uuid NOT NULL REFERENCES public.procurement_cases(id) ON DELETE CASCADE,
  procurement_number text NOT NULL,
  receive_order_number text,
  receive_status text DEFAULT 'draft',
  customer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  received_by_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  received_date date,
  warehouse_location text,
  delivery_condition text,
  all_items_received boolean DEFAULT false,
  damaged_items boolean DEFAULT false,
  missing_items boolean DEFAULT false,
  customer_notes text,
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.procurement_receive_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receive_order_id uuid NOT NULL REFERENCES public.procurement_receive_orders(id) ON DELETE CASCADE,
  procurement_case_id uuid NOT NULL REFERENCES public.procurement_cases(id) ON DELETE CASCADE,
  procurement_number text NOT NULL,
  line_number integer,
  part_number text,
  manufacturer text,
  description text,
  ordered_quantity numeric,
  received_quantity numeric,
  accepted_quantity numeric,
  rejected_quantity numeric,
  unit text DEFAULT 'pcs',
  condition_status text DEFAULT 'not_checked',
  discrepancy_note text,
  customer_comment text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_procurement_cases_number ON public.procurement_cases(procurement_number);
CREATE INDEX IF NOT EXISTS idx_procurement_cases_customer_user_id ON public.procurement_cases(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_procurement_cases_supplier_user_id ON public.procurement_cases(supplier_user_id);
CREATE INDEX IF NOT EXISTS idx_customer_bom_uploads_procurement_number ON public.customer_bom_uploads(procurement_number);
CREATE INDEX IF NOT EXISTS idx_customer_bom_upload_items_procurement_number ON public.customer_bom_upload_items(procurement_number);
CREATE INDEX IF NOT EXISTS idx_rfq_procurement_number ON public.rfq(procurement_number);
CREATE INDEX IF NOT EXISTS idx_rfq_items_procurement_number ON public.rfq_items(procurement_number);
CREATE INDEX IF NOT EXISTS idx_rfq_quotes_procurement_number ON public.rfq_quotes(procurement_number);
CREATE INDEX IF NOT EXISTS idx_rfq_quote_items_procurement_number ON public.rfq_quote_items(procurement_number);
CREATE INDEX IF NOT EXISTS idx_rfq_orders0_procurement_number ON public.rfq_orders0(procurement_number);
CREATE INDEX IF NOT EXISTS idx_rfq_order_items0_procurement_number ON public.rfq_order_items0(procurement_number);
CREATE INDEX IF NOT EXISTS idx_supplier_quotes0_procurement_number ON public.supplier_quotes0(procurement_number);
CREATE INDEX IF NOT EXISTS idx_supplier_quote_items0_procurement_number ON public.supplier_quote_items0(procurement_number);
CREATE INDEX IF NOT EXISTS idx_active_orders_procurement_number ON public.active_orders(procurement_number);
CREATE INDEX IF NOT EXISTS idx_active_order_items_procurement_number ON public.active_order_items(procurement_number);
CREATE INDEX IF NOT EXISTS idx_procurement_progress_procurement_number ON public.procurement_progress(procurement_number);
CREATE INDEX IF NOT EXISTS idx_procurement_invoices_procurement_number ON public.procurement_invoices(procurement_number);
CREATE INDEX IF NOT EXISTS idx_procurement_invoice_items_procurement_number ON public.procurement_invoice_items(procurement_number);
CREATE INDEX IF NOT EXISTS idx_procurement_invoice_items_invoice_id ON public.procurement_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_procurement_waybills_procurement_number ON public.procurement_waybills(procurement_number);
CREATE INDEX IF NOT EXISTS idx_procurement_waybill_items_procurement_number ON public.procurement_waybill_items(procurement_number);
CREATE INDEX IF NOT EXISTS idx_procurement_waybill_items_waybill_id ON public.procurement_waybill_items(waybill_id);
CREATE INDEX IF NOT EXISTS idx_procurement_receive_orders_procurement_number ON public.procurement_receive_orders(procurement_number);
CREATE INDEX IF NOT EXISTS idx_procurement_receive_order_items_procurement_number ON public.procurement_receive_order_items(procurement_number);
CREATE INDEX IF NOT EXISTS idx_procurement_receive_order_items_receive_order_id ON public.procurement_receive_order_items(receive_order_id);

DROP TRIGGER IF EXISTS procurement_cases_set_updated_at ON public.procurement_cases;
CREATE TRIGGER procurement_cases_set_updated_at
BEFORE UPDATE ON public.procurement_cases
FOR EACH ROW
EXECUTE FUNCTION public.set_procurement_document_updated_at();

DROP TRIGGER IF EXISTS procurement_invoices_set_updated_at ON public.procurement_invoices;
CREATE TRIGGER procurement_invoices_set_updated_at
BEFORE UPDATE ON public.procurement_invoices
FOR EACH ROW
EXECUTE FUNCTION public.set_procurement_document_updated_at();

DROP TRIGGER IF EXISTS procurement_waybills_set_updated_at ON public.procurement_waybills;
CREATE TRIGGER procurement_waybills_set_updated_at
BEFORE UPDATE ON public.procurement_waybills
FOR EACH ROW
EXECUTE FUNCTION public.set_procurement_document_updated_at();

DROP TRIGGER IF EXISTS procurement_receive_orders_set_updated_at ON public.procurement_receive_orders;
CREATE TRIGGER procurement_receive_orders_set_updated_at
BEFORE UPDATE ON public.procurement_receive_orders
FOR EACH ROW
EXECUTE FUNCTION public.set_procurement_document_updated_at();

ALTER TABLE public.procurement_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_waybills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_waybill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_receive_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_receive_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can select own procurement cases" ON public.procurement_cases;
CREATE POLICY "Customers can select own procurement cases"
  ON public.procurement_cases
  FOR SELECT
  TO authenticated
  USING (customer_user_id = auth.uid());

DROP POLICY IF EXISTS "Customers can insert own procurement cases" ON public.procurement_cases;
CREATE POLICY "Customers can insert own procurement cases"
  ON public.procurement_cases
  FOR INSERT
  TO authenticated
  WITH CHECK (customer_user_id = auth.uid());

DROP POLICY IF EXISTS "Customers can update own procurement cases" ON public.procurement_cases;
CREATE POLICY "Customers can update own procurement cases"
  ON public.procurement_cases
  FOR UPDATE
  TO authenticated
  USING (customer_user_id = auth.uid())
  WITH CHECK (customer_user_id = auth.uid());

DROP POLICY IF EXISTS "Suppliers can select assigned procurement cases" ON public.procurement_cases;
CREATE POLICY "Suppliers can select assigned procurement cases"
  ON public.procurement_cases
  FOR SELECT
  TO authenticated
  USING (supplier_user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage procurement cases" ON public.procurement_cases;
CREATE POLICY "Admins can manage procurement cases"
  ON public.procurement_cases
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'));

DROP POLICY IF EXISTS "Users can select procurement invoices they can access" ON public.procurement_invoices;
CREATE POLICY "Users can select procurement invoices they can access"
  ON public.procurement_invoices
  FOR SELECT
  TO authenticated
  USING (
    customer_user_id = auth.uid()
    OR supplier_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "Users can insert procurement invoices they can access" ON public.procurement_invoices;
CREATE POLICY "Users can insert procurement invoices they can access"
  ON public.procurement_invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_user_id = auth.uid()
    OR supplier_user_id = auth.uid()
    OR admin_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "Users can update procurement invoices they can access" ON public.procurement_invoices;
CREATE POLICY "Users can update procurement invoices they can access"
  ON public.procurement_invoices
  FOR UPDATE
  TO authenticated
  USING (
    customer_user_id = auth.uid()
    OR supplier_user_id = auth.uid()
    OR admin_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
  )
  WITH CHECK (
    customer_user_id = auth.uid()
    OR supplier_user_id = auth.uid()
    OR admin_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "Users can select procurement invoice items they can access" ON public.procurement_invoice_items;
CREATE POLICY "Users can select procurement invoice items they can access"
  ON public.procurement_invoice_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.procurement_invoices
      WHERE procurement_invoices.id = procurement_invoice_items.invoice_id
        AND (
          procurement_invoices.customer_user_id = auth.uid()
          OR procurement_invoices.supplier_user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "Users can insert procurement invoice items they can access" ON public.procurement_invoice_items;
CREATE POLICY "Users can insert procurement invoice items they can access"
  ON public.procurement_invoice_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.procurement_invoices
      WHERE procurement_invoices.id = invoice_id
        AND (
          procurement_invoices.customer_user_id = auth.uid()
          OR procurement_invoices.supplier_user_id = auth.uid()
          OR procurement_invoices.admin_user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "Users can select procurement waybills they can access" ON public.procurement_waybills;
CREATE POLICY "Users can select procurement waybills they can access"
  ON public.procurement_waybills
  FOR SELECT
  TO authenticated
  USING (
    customer_user_id = auth.uid()
    OR supplier_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "Users can insert procurement waybills they can access" ON public.procurement_waybills;
CREATE POLICY "Users can insert procurement waybills they can access"
  ON public.procurement_waybills
  FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_user_id = auth.uid()
    OR supplier_user_id = auth.uid()
    OR admin_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "Users can update procurement waybills they can access" ON public.procurement_waybills;
CREATE POLICY "Users can update procurement waybills they can access"
  ON public.procurement_waybills
  FOR UPDATE
  TO authenticated
  USING (
    customer_user_id = auth.uid()
    OR supplier_user_id = auth.uid()
    OR admin_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
  )
  WITH CHECK (
    customer_user_id = auth.uid()
    OR supplier_user_id = auth.uid()
    OR admin_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "Users can select procurement waybill items they can access" ON public.procurement_waybill_items;
CREATE POLICY "Users can select procurement waybill items they can access"
  ON public.procurement_waybill_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.procurement_waybills
      WHERE procurement_waybills.id = procurement_waybill_items.waybill_id
        AND (
          procurement_waybills.customer_user_id = auth.uid()
          OR procurement_waybills.supplier_user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "Users can insert procurement waybill items they can access" ON public.procurement_waybill_items;
CREATE POLICY "Users can insert procurement waybill items they can access"
  ON public.procurement_waybill_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.procurement_waybills
      WHERE procurement_waybills.id = waybill_id
        AND (
          procurement_waybills.customer_user_id = auth.uid()
          OR procurement_waybills.supplier_user_id = auth.uid()
          OR procurement_waybills.admin_user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "Users can select procurement receive orders they can access" ON public.procurement_receive_orders;
CREATE POLICY "Users can select procurement receive orders they can access"
  ON public.procurement_receive_orders
  FOR SELECT
  TO authenticated
  USING (
    customer_user_id = auth.uid()
    OR supplier_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "Users can insert procurement receive orders they can access" ON public.procurement_receive_orders;
CREATE POLICY "Users can insert procurement receive orders they can access"
  ON public.procurement_receive_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_user_id = auth.uid()
    OR supplier_user_id = auth.uid()
    OR received_by_user_id = auth.uid()
    OR admin_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "Users can update procurement receive orders they can access" ON public.procurement_receive_orders;
CREATE POLICY "Users can update procurement receive orders they can access"
  ON public.procurement_receive_orders
  FOR UPDATE
  TO authenticated
  USING (
    customer_user_id = auth.uid()
    OR supplier_user_id = auth.uid()
    OR received_by_user_id = auth.uid()
    OR admin_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
  )
  WITH CHECK (
    customer_user_id = auth.uid()
    OR supplier_user_id = auth.uid()
    OR received_by_user_id = auth.uid()
    OR admin_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "Users can select procurement receive order items they can access" ON public.procurement_receive_order_items;
CREATE POLICY "Users can select procurement receive order items they can access"
  ON public.procurement_receive_order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.procurement_receive_orders
      WHERE procurement_receive_orders.id = procurement_receive_order_items.receive_order_id
        AND (
          procurement_receive_orders.customer_user_id = auth.uid()
          OR procurement_receive_orders.supplier_user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "Users can insert procurement receive order items they can access" ON public.procurement_receive_order_items;
CREATE POLICY "Users can insert procurement receive order items they can access"
  ON public.procurement_receive_order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.procurement_receive_orders
      WHERE procurement_receive_orders.id = receive_order_id
        AND (
          procurement_receive_orders.customer_user_id = auth.uid()
          OR procurement_receive_orders.supplier_user_id = auth.uid()
          OR procurement_receive_orders.received_by_user_id = auth.uid()
          OR procurement_receive_orders.admin_user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
        )
    )
  );

NOTIFY pgrst, 'reload schema';
