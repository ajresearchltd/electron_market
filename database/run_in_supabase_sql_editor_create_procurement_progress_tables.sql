-- Run manually in Supabase SQL Editor.
-- This file contains executable SQL only.
-- Do NOT paste Codex prompts, reports, file names, or markdown into Supabase SQL Editor.
-- Electron Market - Unified procurement progress tracking.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.procurement_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  progress_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  customer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_bom_upload_id uuid NULL REFERENCES public.customer_bom_uploads(id) ON DELETE SET NULL,
  rfq_id uuid NULL,
  quote_id uuid NULL,
  active_order_id uuid NULL,
  document_name text,
  customer_company_name text,
  supplier_company_name text,
  current_stage text NOT NULL DEFAULT 'bom_received',
  current_stage_label text NOT NULL DEFAULT 'BOM received',
  status_note text,
  bom_received_at timestamptz,
  rfq_sent_at timestamptz,
  quote_received_at timestamptz,
  approved_at timestamptz,
  payment_at timestamptz,
  goods_shipped_at timestamptz,
  goods_received_at timestamptz,
  order_completed_at timestamptz,
  payment_reference text,
  payment_amount numeric,
  payment_currency text,
  shipment_carrier text,
  shipment_tracking_number text,
  shipment_tracking_url text,
  goods_received_confirmed_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  order_completed_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT procurement_progress_stage_check CHECK (
    current_stage IN ('bom_received', 'rfq', 'quote_received', 'approved', 'payment', 'goods_shipped', 'goods_received', 'order_completed')
  )
);

CREATE TABLE IF NOT EXISTS public.procurement_progress_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  progress_id uuid NOT NULL REFERENCES public.procurement_progress(id) ON DELETE CASCADE,
  actor_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text,
  stage_code text NOT NULL,
  stage_label text NOT NULL,
  event_note text,
  event_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_procurement_progress_customer_user_id
  ON public.procurement_progress(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_procurement_progress_supplier_user_id
  ON public.procurement_progress(supplier_user_id);
CREATE INDEX IF NOT EXISTS idx_procurement_progress_customer_bom_upload_id
  ON public.procurement_progress(customer_bom_upload_id);
CREATE INDEX IF NOT EXISTS idx_procurement_progress_rfq_id
  ON public.procurement_progress(rfq_id);
CREATE INDEX IF NOT EXISTS idx_procurement_progress_quote_id
  ON public.procurement_progress(quote_id);
CREATE INDEX IF NOT EXISTS idx_procurement_progress_current_stage
  ON public.procurement_progress(current_stage);
CREATE INDEX IF NOT EXISTS idx_procurement_progress_events_progress_id
  ON public.procurement_progress_events(progress_id);

CREATE OR REPLACE FUNCTION public.set_procurement_progress_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS procurement_progress_set_updated_at ON public.procurement_progress;
CREATE TRIGGER procurement_progress_set_updated_at
BEFORE UPDATE ON public.procurement_progress
FOR EACH ROW
EXECUTE FUNCTION public.set_procurement_progress_updated_at();

ALTER TABLE public.procurement_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_progress_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can select own procurement progress" ON public.procurement_progress;
CREATE POLICY "Customers can select own procurement progress"
  ON public.procurement_progress
  FOR SELECT
  TO authenticated
  USING (customer_user_id = auth.uid());

DROP POLICY IF EXISTS "Customers can insert own procurement progress" ON public.procurement_progress;
CREATE POLICY "Customers can insert own procurement progress"
  ON public.procurement_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (customer_user_id = auth.uid());

DROP POLICY IF EXISTS "Customers can update own procurement progress" ON public.procurement_progress;
CREATE POLICY "Customers can update own procurement progress"
  ON public.procurement_progress
  FOR UPDATE
  TO authenticated
  USING (customer_user_id = auth.uid())
  WITH CHECK (customer_user_id = auth.uid());

DROP POLICY IF EXISTS "Suppliers can select assigned procurement progress" ON public.procurement_progress;
CREATE POLICY "Suppliers can select assigned procurement progress"
  ON public.procurement_progress
  FOR SELECT
  TO authenticated
  USING (supplier_user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage procurement progress" ON public.procurement_progress;
CREATE POLICY "Admins can manage procurement progress"
  ON public.procurement_progress
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'));

DROP POLICY IF EXISTS "Users can insert procurement progress events they can access" ON public.procurement_progress_events;
CREATE POLICY "Users can insert procurement progress events they can access"
  ON public.procurement_progress_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.procurement_progress
      WHERE procurement_progress.id = progress_id
        AND (
          procurement_progress.customer_user_id = auth.uid()
          OR procurement_progress.supplier_user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "Users can select procurement progress events they can access" ON public.procurement_progress_events;
CREATE POLICY "Users can select procurement progress events they can access"
  ON public.procurement_progress_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.procurement_progress
      WHERE procurement_progress.id = progress_id
        AND (
          procurement_progress.customer_user_id = auth.uid()
          OR procurement_progress.supplier_user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
        )
    )
  );

NOTIFY pgrst, 'reload schema';
