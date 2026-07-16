-- Manual Supabase SQL Editor migration. Do not run automatically.
-- Restores the legacy procurement_case required by Invoice foreign keys for canonical procurement chains.

CREATE OR REPLACE FUNCTION public.ensure_procurement_case_for_chain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.procurement_cases (
    id, procurement_number, customer_user_id, supplier_user_id, admin_user_id,
    customer_company_name, supplier_company_name, document_name,
    current_stage, current_stage_label, source_type, source_bom_upload_id,
    source_rfq_id, source_invoice_id, created_at, updated_at
  ) VALUES (
    NEW.id, NEW.procurement_number, NEW.customer_user_id, NEW.supplier_user_id,
    NEW.admin_user_id, NEW.customer_company_name, NEW.supplier_company_name,
    NEW.document_name, NEW.current_stage, NEW.current_stage_label,
    NEW.source_type, NEW.source_bom_upload_id, NEW.source_rfq_id,
    NEW.source_invoice_id, NEW.created_at, NEW.updated_at
  )
  ON CONFLICT (procurement_number) DO UPDATE
  SET customer_user_id = EXCLUDED.customer_user_id,
      supplier_user_id = coalesce(public.procurement_cases.supplier_user_id, EXCLUDED.supplier_user_id),
      admin_user_id = coalesce(public.procurement_cases.admin_user_id, EXCLUDED.admin_user_id),
      customer_company_name = coalesce(public.procurement_cases.customer_company_name, EXCLUDED.customer_company_name),
      supplier_company_name = coalesce(public.procurement_cases.supplier_company_name, EXCLUDED.supplier_company_name),
      updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS procurement_chains_ensure_legacy_case ON public.procurement_chains;
CREATE TRIGGER procurement_chains_ensure_legacy_case
AFTER INSERT ON public.procurement_chains
FOR EACH ROW
EXECUTE FUNCTION public.ensure_procurement_case_for_chain();

INSERT INTO public.procurement_cases (
  id, procurement_number, customer_user_id, supplier_user_id, admin_user_id,
  customer_company_name, supplier_company_name, document_name,
  current_stage, current_stage_label, source_type, source_bom_upload_id,
  source_rfq_id, source_invoice_id, created_at, updated_at
)
SELECT
  pc.id, pc.procurement_number, pc.customer_user_id, pc.supplier_user_id,
  pc.admin_user_id, pc.customer_company_name, pc.supplier_company_name,
  pc.document_name, pc.current_stage, pc.current_stage_label, pc.source_type,
  pc.source_bom_upload_id, pc.source_rfq_id, pc.source_invoice_id,
  pc.created_at, pc.updated_at
FROM public.procurement_chains AS pc
WHERE NOT EXISTS (
  SELECT 1
  FROM public.procurement_cases AS legacy_pc
  WHERE legacy_pc.procurement_number = pc.procurement_number
)
ON CONFLICT (procurement_number) DO NOTHING;

UPDATE public.rfq_orders0 AS ro
SET procurement_case_id = legacy_pc.id
FROM public.procurement_cases AS legacy_pc
WHERE legacy_pc.procurement_number = ro.procurement_number
  AND ro.procurement_case_id IS DISTINCT FROM legacy_pc.id;

UPDATE public.rfq_order_items0 AS roi
SET procurement_case_id = legacy_pc.id
FROM public.procurement_cases AS legacy_pc
WHERE legacy_pc.procurement_number = roi.procurement_number
  AND roi.procurement_case_id IS DISTINCT FROM legacy_pc.id;

UPDATE public.customer_bom_uploads AS cu
SET procurement_case_id = legacy_pc.id
FROM public.procurement_cases AS legacy_pc
WHERE legacy_pc.procurement_number = cu.procurement_number
  AND cu.procurement_case_id IS DISTINCT FROM legacy_pc.id;

UPDATE public.customer_bom_upload_items AS cui
SET procurement_case_id = legacy_pc.id
FROM public.procurement_cases AS legacy_pc
WHERE legacy_pc.procurement_number = cui.procurement_number
  AND cui.procurement_case_id IS DISTINCT FROM legacy_pc.id;

UPDATE public.procurement_progress AS pp
SET procurement_case_id = legacy_pc.id
FROM public.procurement_cases AS legacy_pc
WHERE legacy_pc.procurement_number = pp.procurement_number
  AND pp.procurement_case_id IS DISTINCT FROM legacy_pc.id;

REVOKE ALL ON FUNCTION public.ensure_procurement_case_for_chain() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
