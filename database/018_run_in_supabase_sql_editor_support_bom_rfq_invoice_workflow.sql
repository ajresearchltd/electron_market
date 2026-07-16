-- Manual Supabase SQL Editor migration. Do not run automatically.
-- Adds canonical RFQ offer allocations and an atomic, idempotent Draft Invoice conversion.

CREATE TABLE IF NOT EXISTS public.procurement_workflow_settings (
  procurement_chain_id uuid PRIMARY KEY REFERENCES public.procurement_chains(id) ON DELETE CASCADE,
  execution_mode text NOT NULL DEFAULT 'manual' CHECK (execution_mode IN ('manual','assisted','automatic')),
  automatic_bom_to_rfq boolean NOT NULL DEFAULT false,
  automatic_rfq_to_invoice boolean NOT NULL DEFAULT false,
  allow_automatic_partial_invoice boolean NOT NULL DEFAULT false,
  minimum_line_coverage_percent numeric NOT NULL DEFAULT 100 CHECK (minimum_line_coverage_percent BETWEEN 0 AND 100),
  updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.procurement_supplier_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procurement_chain_id uuid NOT NULL REFERENCES public.procurement_chains(id) ON DELETE CASCADE,
  rfq_id uuid NOT NULL REFERENCES public.rfq_orders0(rfq_id) ON DELETE CASCADE,
  rfq_item_id uuid NOT NULL REFERENCES public.rfq_order_items0(rfq_item_id) ON DELETE CASCADE,
  supplier_response_item_id uuid NOT NULL REFERENCES public.supplier_response_items(id) ON DELETE RESTRICT,
  supplier_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  allocated_quantity numeric NOT NULL CHECK (allocated_quantity > 0),
  selected_unit_price numeric NOT NULL CHECK (selected_unit_price >= 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  price_basis_quantity numeric NOT NULL CHECK (price_basis_quantity > 0),
  price_basis_unit text NOT NULL,
  delivery_terms text NOT NULL,
  selection_reason text NOT NULL,
  selected_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  selected_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(rfq_item_id, supplier_response_item_id)
);

ALTER TABLE public.procurement_invoices
  ADD COLUMN IF NOT EXISTS source_rfq_id uuid NULL REFERENCES public.rfq_orders0(rfq_id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS creation_mode text NOT NULL DEFAULT 'manual' CHECK (creation_mode IN ('manual','assisted','automatic')),
  ADD COLUMN IF NOT EXISTS idempotency_key text NULL;
CREATE UNIQUE INDEX IF NOT EXISTS procurement_invoices_source_rfq_unique ON public.procurement_invoices(source_rfq_id) WHERE source_rfq_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS procurement_invoices_idempotency_unique ON public.procurement_invoices(idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.procurement_invoice_items
  ADD COLUMN IF NOT EXISTS source_rfq_item_id uuid NULL REFERENCES public.rfq_order_items0(rfq_item_id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS source_supplier_response_item_id uuid NULL REFERENCES public.supplier_response_items(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS source_supplier_message_id uuid NULL REFERENCES public.supplier_inbound_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_id uuid NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS available_quantity numeric NULL,
  ADD COLUMN IF NOT EXISTS price_basis_quantity numeric NULL,
  ADD COLUMN IF NOT EXISTS price_basis_unit text NULL,
  ADD COLUMN IF NOT EXISTS moq numeric NULL,
  ADD COLUMN IF NOT EXISTS lead_time_days integer NULL,
  ADD COLUMN IF NOT EXISTS packaging text NULL,
  ADD COLUMN IF NOT EXISTS condition text NULL,
  ADD COLUMN IF NOT EXISTS date_code text NULL,
  ADD COLUMN IF NOT EXISTS incoterms text NULL,
  ADD COLUMN IF NOT EXISTS payment_terms text NULL,
  ADD COLUMN IF NOT EXISTS quotation_valid_until date NULL,
  ADD COLUMN IF NOT EXISTS delivery_conditions text NULL;
CREATE UNIQUE INDEX IF NOT EXISTS procurement_invoice_items_allocation_unique ON public.procurement_invoice_items(invoice_id, source_supplier_response_item_id, source_rfq_item_id) WHERE source_supplier_response_item_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.procurement_transition_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procurement_chain_id uuid NOT NULL REFERENCES public.procurement_chains(id) ON DELETE CASCADE,
  actor_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('admin','customer','supplier','ai')),
  command_name text NOT NULL,
  execution_mode text NOT NULL CHECK (execution_mode IN ('manual','assisted','automatic')),
  source_document_type text NOT NULL,
  source_document_id uuid NOT NULL,
  target_document_type text NULL,
  target_document_id uuid NULL,
  previous_state jsonb NULL,
  new_state jsonb NULL,
  policy_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  decision_reason text NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.procurement_workflow_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_supplier_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_transition_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.procurement_workflow_settings, public.procurement_supplier_allocations, public.procurement_transition_audit FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_draft_invoice_from_rfq(
  p_rfq_id uuid, p_actor_id uuid, p_execution_mode text, p_idempotency_key text
)
RETURNS TABLE(invoice_id uuid, procurement_chain_id uuid, procurement_number text, created boolean, included_count integer, open_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rfq public.rfq_orders0%ROWTYPE; v_invoice_id uuid; v_included integer; v_open integer; v_currency text;
BEGIN
  IF p_execution_mode NOT IN ('manual','assisted','automatic') THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid execution mode.'; END IF;
  SELECT ro.* INTO v_rfq FROM public.rfq_orders0 AS ro WHERE ro.rfq_id=p_rfq_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='RFQ not found.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles AS up WHERE up.id=p_actor_id AND up.role IN ('admin','support')) THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Admin authorization required.'; END IF;
  SELECT pi.id INTO v_invoice_id FROM public.procurement_invoices AS pi WHERE pi.source_rfq_id=v_rfq.rfq_id OR pi.idempotency_key=p_idempotency_key ORDER BY pi.created_at LIMIT 1;
  IF v_invoice_id IS NOT NULL THEN
    SELECT count(DISTINCT pii.source_rfq_item_id)::integer INTO v_included FROM public.procurement_invoice_items AS pii WHERE pii.invoice_id=v_invoice_id;
    SELECT count(*)::integer-v_included INTO v_open FROM public.rfq_order_items0 AS roi WHERE roi.rfq_id=v_rfq.rfq_id;
    RETURN QUERY SELECT v_invoice_id,v_rfq.procurement_chain_id,v_rfq.procurement_number,false,v_included,v_open; RETURN;
  END IF;
  IF p_execution_mode='automatic' AND NOT EXISTS (SELECT 1 FROM public.procurement_workflow_settings AS ws WHERE ws.procurement_chain_id=v_rfq.procurement_chain_id AND ws.execution_mode='automatic' AND ws.automatic_rfq_to_invoice) THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Automatic RFQ conversion is disabled.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.procurement_supplier_allocations AS psa WHERE psa.rfq_id=v_rfq.rfq_id AND psa.is_active) THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='No selected supplier allocations.'; END IF;
  IF EXISTS (SELECT 1 FROM public.procurement_supplier_allocations AS psa JOIN public.supplier_response_items AS sri ON sri.id=psa.supplier_response_item_id JOIN public.supplier_responses AS sr ON sr.id=sri.supplier_response_id WHERE psa.rfq_id=v_rfq.rfq_id AND psa.is_active AND (sri.calculated_unit_price IS NULL OR sri.currency IS NULL OR sri.price_basis_quantity IS NULL OR sri.price_basis_unit IS NULL OR sri.review_status<>'not_required' OR sri.normalization_status<>'validated' OR sri.rfq_item_id IS DISTINCT FROM psa.rfq_item_id OR coalesce(sri.available_quantity,sri.offered_quantity,0)<psa.allocated_quantity OR (sr.quote_valid_until IS NOT NULL AND sr.quote_valid_until<current_date))) THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='One or more selected allocations no longer satisfy Invoice criteria.'; END IF;
  SELECT min(psa.currency) INTO v_currency FROM public.procurement_supplier_allocations AS psa WHERE psa.rfq_id=v_rfq.rfq_id AND psa.is_active;
  IF EXISTS (SELECT 1 FROM public.procurement_supplier_allocations AS psa WHERE psa.rfq_id=v_rfq.rfq_id AND psa.is_active AND psa.currency<>v_currency) THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Selected allocations use multiple currencies.'; END IF;
  INSERT INTO public.procurement_invoices(procurement_chain_id,procurement_case_id,procurement_number,source_rfq_id,invoice_status,customer_user_id,admin_user_id,customer_company_name,invoice_date,currency,subtotal,total_amount,payment_status,creation_mode,idempotency_key)
  VALUES(v_rfq.procurement_chain_id,v_rfq.procurement_case_id,v_rfq.procurement_number,v_rfq.rfq_id,'draft',v_rfq.customer_id,p_actor_id,v_rfq.customer_company_name,current_date,v_currency,0,0,'unpaid',p_execution_mode,p_idempotency_key) RETURNING procurement_invoices.id INTO v_invoice_id;
  INSERT INTO public.procurement_invoice_items(invoice_id,procurement_chain_id,procurement_case_id,procurement_number,line_number,part_number,manufacturer,description,quantity,unit,unit_price,currency,line_total,source_rfq_item_id,source_supplier_response_item_id,source_supplier_message_id,supplier_id,available_quantity,price_basis_quantity,price_basis_unit,moq,lead_time_days,packaging,condition,date_code,quotation_valid_until,delivery_conditions,notes)
  SELECT v_invoice_id,v_rfq.procurement_chain_id,v_rfq.procurement_case_id,v_rfq.procurement_number,row_number() OVER(ORDER BY roi.line_number,psa.selected_at),coalesce(sri.offered_mpn,roi.part_number),coalesce(sri.offered_manufacturer,roi.manufacturer),roi.description,psa.allocated_quantity,roi.quantity_unit,psa.selected_unit_price,psa.currency,round(psa.allocated_quantity*psa.selected_unit_price/psa.price_basis_quantity,2),roi.rfq_item_id,sri.id,sri.source_message_id,psa.supplier_id,coalesce(sri.available_quantity,sri.offered_quantity),psa.price_basis_quantity,psa.price_basis_unit,sri.moq,sri.lead_time_days,sri.package_quantity::text,sri.condition,coalesce(sri.date_code_normalized,sri.date_code_raw),sr.quote_valid_until,psa.delivery_terms,psa.selection_reason
  FROM public.procurement_supplier_allocations AS psa JOIN public.rfq_order_items0 AS roi ON roi.rfq_item_id=psa.rfq_item_id JOIN public.supplier_response_items AS sri ON sri.id=psa.supplier_response_item_id JOIN public.supplier_responses AS sr ON sr.id=sri.supplier_response_id WHERE psa.rfq_id=v_rfq.rfq_id AND psa.is_active;
  UPDATE public.procurement_invoices AS pi SET subtotal=x.total,total_amount=x.total FROM (SELECT coalesce(sum(pii.line_total),0) AS total FROM public.procurement_invoice_items AS pii WHERE pii.invoice_id=v_invoice_id) AS x WHERE pi.id=v_invoice_id;
  SELECT count(DISTINCT pii.source_rfq_item_id)::integer INTO v_included FROM public.procurement_invoice_items AS pii WHERE pii.invoice_id=v_invoice_id;
  SELECT count(*)::integer-v_included INTO v_open FROM public.rfq_order_items0 AS roi WHERE roi.rfq_id=v_rfq.rfq_id;
  UPDATE public.procurement_chains AS pc SET source_invoice_id=v_invoice_id,current_stage='payment',current_stage_label='Invoice draft' WHERE pc.id=v_rfq.procurement_chain_id;
  UPDATE public.procurement_progress AS pp SET current_stage='payment',current_stage_label='Invoice draft',status_note=CASE WHEN v_open>0 THEN format('Partial Draft Invoice created; %s RFQ positions remain open.',v_open) ELSE 'Draft Invoice created from selected supplier offers.' END WHERE pp.procurement_chain_id=v_rfq.procurement_chain_id;
  INSERT INTO public.procurement_transition_audit(procurement_chain_id,actor_id,actor_type,command_name,execution_mode,source_document_type,source_document_id,target_document_type,target_document_id,policy_result,decision_reason,idempotency_key) VALUES(v_rfq.procurement_chain_id,p_actor_id,CASE WHEN p_execution_mode='automatic' THEN 'ai' ELSE 'admin' END,'create_invoice_from_rfq',p_execution_mode,'rfq',v_rfq.rfq_id,'invoice',v_invoice_id,jsonb_build_object('included_items',v_included,'open_items',v_open),'Deterministic allocation validation passed.',p_idempotency_key);
  RETURN QUERY SELECT v_invoice_id,v_rfq.procurement_chain_id,v_rfq.procurement_number,true,v_included,v_open;
END; $$;

REVOKE ALL ON FUNCTION public.create_draft_invoice_from_rfq(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_draft_invoice_from_rfq(uuid,uuid,text,text) TO service_role;
NOTIFY pgrst, 'reload schema';
