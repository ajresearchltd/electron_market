-- Run manually in Supabase SQL Editor.
-- Electron Market - one customer-owned sourcing preference record per procurement chain.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.procurement_order_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procurement_chain_id uuid NOT NULL UNIQUE REFERENCES public.procurement_chains(id) ON DELETE CASCADE,
  bom_upload_id uuid NULL REFERENCES public.customer_bom_uploads(id) ON DELETE SET NULL,
  customer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  search_priority text NOT NULL DEFAULT 'balanced' CHECK (search_priority IN ('price','delivery_time','balanced')),
  max_lead_time_days integer NULL CHECK (max_lead_time_days IS NULL OR max_lead_time_days > 0),
  supplier_countries text[] NOT NULL DEFAULT '{}'::text[],
  allow_independent_suppliers boolean NOT NULL DEFAULT false,
  allow_alternatives boolean NOT NULL DEFAULT false,
  allow_split_delivery boolean NOT NULL DEFAULT false,
  budget_amount numeric(18,2) NULL CHECK (budget_amount IS NULL OR budget_amount >= 0),
  budget_currency text NULL CHECK (budget_currency IS NULL OR budget_currency ~ '^[A-Z]{3}$'),
  certificate_requirements text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS procurement_order_preferences_customer_idx ON public.procurement_order_preferences(customer_user_id);
ALTER TABLE public.procurement_order_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can select own procurement preferences" ON public.procurement_order_preferences;
CREATE POLICY "Customers can select own procurement preferences" ON public.procurement_order_preferences FOR SELECT TO authenticated
USING (customer_user_id=auth.uid() AND EXISTS (SELECT 1 FROM public.procurement_chains c WHERE c.id=procurement_order_preferences.procurement_chain_id AND c.customer_user_id=auth.uid()));
DROP POLICY IF EXISTS "Customers can insert own procurement preferences" ON public.procurement_order_preferences;
CREATE POLICY "Customers can insert own procurement preferences" ON public.procurement_order_preferences FOR INSERT TO authenticated
WITH CHECK (customer_user_id=auth.uid() AND EXISTS (SELECT 1 FROM public.procurement_chains c WHERE c.id=procurement_order_preferences.procurement_chain_id AND c.customer_user_id=auth.uid()) AND (bom_upload_id IS NULL OR EXISTS (SELECT 1 FROM public.customer_bom_uploads b WHERE b.id=procurement_order_preferences.bom_upload_id AND b.user_id=auth.uid() AND b.procurement_chain_id=procurement_order_preferences.procurement_chain_id)));
DROP POLICY IF EXISTS "Customers can update own procurement preferences" ON public.procurement_order_preferences;
CREATE POLICY "Customers can update own procurement preferences" ON public.procurement_order_preferences FOR UPDATE TO authenticated
USING (customer_user_id=auth.uid() AND EXISTS (SELECT 1 FROM public.procurement_chains c WHERE c.id=procurement_order_preferences.procurement_chain_id AND c.customer_user_id=auth.uid()))
WITH CHECK (customer_user_id=auth.uid() AND EXISTS (SELECT 1 FROM public.procurement_chains c WHERE c.id=procurement_order_preferences.procurement_chain_id AND c.customer_user_id=auth.uid()) AND (bom_upload_id IS NULL OR EXISTS (SELECT 1 FROM public.customer_bom_uploads b WHERE b.id=procurement_order_preferences.bom_upload_id AND b.user_id=auth.uid() AND b.procurement_chain_id=procurement_order_preferences.procurement_chain_id)));
DROP POLICY IF EXISTS "Admins can select procurement preferences" ON public.procurement_order_preferences;
CREATE POLICY "Admins can select procurement preferences" ON public.procurement_order_preferences FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND p.role='admin'));

CREATE OR REPLACE FUNCTION public.set_procurement_order_preferences_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS procurement_order_preferences_updated_at ON public.procurement_order_preferences;
CREATE TRIGGER procurement_order_preferences_updated_at BEFORE UPDATE ON public.procurement_order_preferences FOR EACH ROW EXECUTE FUNCTION public.set_procurement_order_preferences_updated_at();
NOTIFY pgrst, 'reload schema';
