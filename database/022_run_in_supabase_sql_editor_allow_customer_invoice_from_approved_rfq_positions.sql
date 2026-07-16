-- Manual Supabase SQL Editor migration. Do not run automatically.
-- Extends the canonical RFQ-to-Invoice function to the owning Customer.

CREATE OR REPLACE FUNCTION public.create_draft_invoice_from_rfq(
  p_rfq_id uuid, p_actor_id uuid, p_execution_mode text, p_idempotency_key text
)
RETURNS TABLE(invoice_id uuid, procurement_chain_id uuid, procurement_number text, created boolean, included_count integer, open_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rfq public.rfq_orders0%ROWTYPE; v_invoice_id uuid; v_included integer; v_open integer; v_currency text; v_actor_role text;
BEGIN
  IF p_execution_mode NOT IN ('manual','assisted','automatic') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid execution mode.'; END IF;
  SELECT ro.* INTO v_rfq FROM public.rfq_orders0 AS ro WHERE ro.rfq_id=p_rfq_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='RFQ not found.'; END IF;
  SELECT up.role INTO v_actor_role FROM public.user_profiles AS up WHERE up.id=p_actor_id;
  IF coalesce(v_actor_role,'') NOT IN ('admin','support') AND (v_actor_role<>'customer' OR v_rfq.customer_id IS DISTINCT FROM p_actor_id) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='RFQ Invoice authorization required.'; END IF;
  SELECT pi.id INTO v_invoice_id FROM public.procurement_invoices AS pi WHERE pi.source_rfq_id=v_rfq.rfq_id OR pi.idempotency_key=p_idempotency_key ORDER BY pi.created_at LIMIT 1;
  IF v_invoice_id IS NOT NULL THEN
    SELECT count(DISTINCT pii.source_rfq_item_id)::integer INTO v_included FROM public.procurement_invoice_items AS pii WHERE pii.invoice_id=v_invoice_id;
    SELECT count(*)::integer-v_included INTO v_open FROM public.rfq_order_items0 AS roi WHERE roi.rfq_id=v_rfq.rfq_id;
    RETURN QUERY SELECT v_invoice_id,v_rfq.procurement_chain_id,v_rfq.procurement_number,false,v_included,v_open; RETURN;
  END IF;
  IF p_execution_mode='automatic' AND NOT EXISTS(SELECT 1 FROM public.procurement_workflow_settings AS ws WHERE ws.procurement_chain_id=v_rfq.procurement_chain_id AND ws.execution_mode='automatic' AND ws.automatic_rfq_to_invoice) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Automatic RFQ conversion is disabled.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.procurement_supplier_allocations AS psa WHERE psa.rfq_id=v_rfq.rfq_id AND psa.is_active AND psa.selected_by=v_rfq.customer_id) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='No Buyer-approved supplier allocations.'; END IF;
  IF EXISTS(SELECT 1 FROM public.procurement_supplier_allocations AS psa JOIN public.supplier_response_items AS sri ON sri.id=psa.supplier_response_item_id JOIN public.supplier_responses AS sr ON sr.id=sri.supplier_response_id WHERE psa.rfq_id=v_rfq.rfq_id AND psa.is_active AND psa.selected_by=v_rfq.customer_id AND (sri.calculated_unit_price IS NULL OR sri.currency IS NULL OR sri.price_basis_quantity IS NULL OR sri.price_basis_unit IS NULL OR sri.review_status<>'not_required' OR sri.normalization_status<>'validated' OR sri.rfq_item_id IS DISTINCT FROM psa.rfq_item_id OR coalesce(sri.available_quantity,sri.offered_quantity,0)<psa.allocated_quantity OR (sr.quote_valid_until IS NOT NULL AND sr.quote_valid_until<current_date))) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='One or more approved allocations no longer satisfy Invoice criteria.'; END IF;
  SELECT min(psa.currency) INTO v_currency FROM public.procurement_supplier_allocations AS psa WHERE psa.rfq_id=v_rfq.rfq_id AND psa.is_active AND psa.selected_by=v_rfq.customer_id;
  IF EXISTS(SELECT 1 FROM public.procurement_supplier_allocations AS psa WHERE psa.rfq_id=v_rfq.rfq_id AND psa.is_active AND psa.selected_by=v_rfq.customer_id AND psa.currency<>v_currency) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Approved allocations use multiple currencies.'; END IF;
  INSERT INTO public.procurement_invoices(procurement_chain_id,procurement_case_id,procurement_number,source_rfq_id,invoice_status,customer_user_id,admin_user_id,customer_company_name,invoice_date,currency,subtotal,total_amount,payment_status,creation_mode,idempotency_key)
  VALUES(v_rfq.procurement_chain_id,v_rfq.procurement_case_id,v_rfq.procurement_number,v_rfq.rfq_id,'draft',v_rfq.customer_id,CASE WHEN v_actor_role IN ('admin','support') THEN p_actor_id ELSE NULL END,v_rfq.customer_company_name,current_date,v_currency,0,0,'unpaid',p_execution_mode,p_idempotency_key) RETURNING procurement_invoices.id INTO v_invoice_id;
  INSERT INTO public.procurement_invoice_items(invoice_id,procurement_chain_id,procurement_case_id,procurement_number,line_number,part_number,manufacturer,description,quantity,unit,unit_price,currency,line_total,source_rfq_item_id,source_supplier_response_item_id,source_supplier_message_id,supplier_id,available_quantity,price_basis_quantity,price_basis_unit,moq,lead_time_days,packaging,condition,date_code,quotation_valid_until,delivery_conditions,notes)
  SELECT v_invoice_id,v_rfq.procurement_chain_id,v_rfq.procurement_case_id,v_rfq.procurement_number,row_number() OVER(ORDER BY roi.line_number,psa.selected_at),coalesce(sri.offered_mpn,roi.part_number),coalesce(sri.offered_manufacturer,roi.manufacturer),roi.description,psa.allocated_quantity,roi.quantity_unit,psa.selected_unit_price,psa.currency,round(psa.allocated_quantity*psa.selected_unit_price/psa.price_basis_quantity,2),roi.rfq_item_id,sri.id,sri.source_message_id,psa.supplier_id,coalesce(sri.available_quantity,sri.offered_quantity),psa.price_basis_quantity,psa.price_basis_unit,sri.moq,sri.lead_time_days,sri.package_quantity::text,sri.condition,coalesce(sri.date_code_normalized,sri.date_code_raw),sr.quote_valid_until,psa.delivery_terms,psa.selection_reason
  FROM public.procurement_supplier_allocations AS psa JOIN public.rfq_order_items0 AS roi ON roi.rfq_item_id=psa.rfq_item_id JOIN public.supplier_response_items AS sri ON sri.id=psa.supplier_response_item_id JOIN public.supplier_responses AS sr ON sr.id=sri.supplier_response_id WHERE psa.rfq_id=v_rfq.rfq_id AND psa.is_active AND psa.selected_by=v_rfq.customer_id;
  UPDATE public.procurement_invoices AS pi SET subtotal=x.total,total_amount=x.total FROM(SELECT coalesce(sum(pii.line_total),0) AS total FROM public.procurement_invoice_items AS pii WHERE pii.invoice_id=v_invoice_id) AS x WHERE pi.id=v_invoice_id;
  SELECT count(DISTINCT pii.source_rfq_item_id)::integer INTO v_included FROM public.procurement_invoice_items AS pii WHERE pii.invoice_id=v_invoice_id;
  SELECT count(*)::integer-v_included INTO v_open FROM public.rfq_order_items0 AS roi WHERE roi.rfq_id=v_rfq.rfq_id;
  UPDATE public.procurement_chains AS pc SET source_invoice_id=v_invoice_id,current_stage='payment',current_stage_label='Invoice draft' WHERE pc.id=v_rfq.procurement_chain_id;
  UPDATE public.procurement_progress AS pp SET current_stage='payment',current_stage_label='Invoice draft',status_note=CASE WHEN v_open>0 THEN format('Partial Draft Invoice created; %s RFQ positions remain open.',v_open) ELSE 'Draft Invoice created from approved supplier offers.' END WHERE pp.procurement_chain_id=v_rfq.procurement_chain_id;
  INSERT INTO public.procurement_transition_audit(procurement_chain_id,actor_id,actor_type,command_name,execution_mode,source_document_type,source_document_id,target_document_type,target_document_id,policy_result,decision_reason,idempotency_key) VALUES(v_rfq.procurement_chain_id,p_actor_id,CASE WHEN p_execution_mode='automatic' THEN 'ai' WHEN v_actor_role='customer' THEN 'customer' ELSE 'admin' END,'create_invoice_from_rfq',p_execution_mode,'rfq',v_rfq.rfq_id,'invoice',v_invoice_id,jsonb_build_object('included_items',v_included,'open_items',v_open),'Approved allocation validation passed.',p_idempotency_key);
  RETURN QUERY SELECT v_invoice_id,v_rfq.procurement_chain_id,v_rfq.procurement_number,true,v_included,v_open;
END; $$;

REVOKE ALL ON FUNCTION public.create_draft_invoice_from_rfq(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_draft_invoice_from_rfq(uuid,uuid,text,text) TO service_role;
NOTIFY pgrst, 'reload schema';
