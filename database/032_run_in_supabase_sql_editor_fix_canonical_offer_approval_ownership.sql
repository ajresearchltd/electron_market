-- Manual Supabase SQL Editor migration. Do not run automatically.
-- Replaces the offer-approval RPC with explicit canonical RFQ/item/response ownership validation.

CREATE OR REPLACE FUNCTION public.approve_supplier_offer_for_rfq_item(
  p_rfq_id uuid,p_rfq_item_id uuid,p_offer_item_id uuid,p_actor_id uuid,p_actor_role text,p_approved_quantity numeric
)
RETURNS TABLE(allocation_id uuid,procurement_chain_id uuid,rfq_id uuid,rfq_item_id uuid,
  supplier_offer_item_id uuid,supplier_id uuid,approved_quantity numeric,selected_unit_price numeric,
  currency text,price_basis_quantity numeric,price_basis_unit text,approved_at timestamptz,
  approved_by uuid,approved_by_role text,match_method text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 v_rfq public.rfq_orders0%ROWTYPE;v_item public.rfq_order_items0%ROWTYPE;
 v_offer public.supplier_response_items%ROWTYPE;v_response public.supplier_responses%ROWTYPE;
 v_allocation public.procurement_supplier_allocations%ROWTYPE;v_role text;v_usable numeric;v_quantity numeric;v_method text;
BEGIN
 SELECT up.role INTO v_role FROM public.user_profiles AS up WHERE up.id=p_actor_id;
 IF v_role IS NULL OR v_role<>p_actor_role OR v_role NOT IN('customer','admin') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Offer approval authorization required.';END IF;
 SELECT ro.* INTO v_rfq FROM public.rfq_orders0 AS ro WHERE ro.rfq_id=p_rfq_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='RFQ was not found.';END IF;
 IF v_role='customer' AND v_rfq.customer_id IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='You do not have permission to approve this offer.';END IF;
 SELECT roi.* INTO v_item FROM public.rfq_order_items0 AS roi
 WHERE roi.rfq_item_id=p_rfq_item_id AND roi.rfq_id=v_rfq.rfq_id
   AND roi.procurement_chain_id IS NOT DISTINCT FROM v_rfq.procurement_chain_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='RFQ position belongs to another procurement order.';END IF;
 SELECT sri.* INTO v_offer FROM public.supplier_response_items AS sri
 JOIN public.supplier_responses AS sr ON sr.id=sri.supplier_response_id
 WHERE sri.id=p_offer_item_id AND sri.is_current=true
   AND sri.rfq_item_id=v_item.rfq_item_id
   AND sri.rfq_id=v_rfq.rfq_id
   AND sri.procurement_chain_id=v_rfq.procurement_chain_id
   AND sr.procurement_chain_id=v_rfq.procurement_chain_id
   AND sr.rfq_id=v_rfq.rfq_id
   AND sr.supplier_id=sri.supplier_id;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Supplier offer belongs to another procurement order.';END IF;
 SELECT sr.* INTO v_response FROM public.supplier_responses AS sr WHERE sr.id=v_offer.supplier_response_id;
 IF v_offer.calculated_unit_price IS NULL OR v_offer.currency IS NULL OR coalesce(v_offer.price_basis_quantity,0)<=0 OR nullif(v_offer.price_basis_unit,'') IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Supplier price, currency and price basis must be confirmed.';END IF;
 IF EXISTS(SELECT 1 FROM public.supplier_part_clarifications AS spc WHERE spc.supplier_response_item_id=v_offer.id AND spc.status IN('clarification_draft','clarification_pending_send','clarification_sent','supplier_confirmation_pending','supplier_reply_ambiguous')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Supplier identification confirmation is required before this offer can be approved.';END IF;
 IF EXISTS(SELECT 1 FROM public.procurement_invoice_items AS pii WHERE pii.source_rfq_item_id=v_item.rfq_item_id) THEN RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='This approved allocation is already included in a protected Invoice.';END IF;
 v_usable:=least(coalesce(v_offer.offered_quantity,v_offer.available_quantity),coalesce(v_offer.available_quantity,v_offer.offered_quantity));
 v_quantity:=coalesce(p_approved_quantity,least(v_item.requested_quantity,v_usable));
 IF v_quantity IS NULL OR v_quantity<=0 OR v_quantity>v_item.requested_quantity OR v_quantity>v_usable THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Approved quantity is invalid.';END IF;
 v_method:=CASE WHEN v_role='admin' THEN 'manual_admin' ELSE 'manual_customer' END;
 UPDATE public.procurement_supplier_allocations AS psa SET is_active=false,updated_at=now()
 WHERE psa.rfq_id=v_rfq.rfq_id AND psa.rfq_item_id=v_item.rfq_item_id AND psa.is_active
   AND psa.supplier_response_item_id<>v_offer.id
   AND NOT EXISTS(SELECT 1 FROM public.procurement_invoice_items AS pii WHERE pii.source_allocation_id=psa.id);
 IF EXISTS(SELECT 1 FROM public.procurement_supplier_allocations AS psa JOIN public.procurement_invoice_items AS pii ON pii.source_allocation_id=psa.id WHERE psa.rfq_item_id=v_item.rfq_item_id AND psa.is_active AND psa.supplier_response_item_id<>v_offer.id) THEN RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='An Invoice-linked supplier approval cannot be replaced.';END IF;
 UPDATE public.procurement_supplier_allocations AS psa SET allocated_quantity=v_quantity,selected_unit_price=v_offer.calculated_unit_price,currency=v_offer.currency,price_basis_quantity=v_offer.price_basis_quantity,price_basis_unit=v_offer.price_basis_unit,delivery_terms=coalesce(nullif(v_offer.lead_time_raw,''),'Not provided'),selection_reason=format('%s explicitly approved supplier offer.',initcap(v_role)),selected_by=p_actor_id,selected_at=now(),is_active=true,updated_at=now()
 WHERE psa.rfq_item_id=v_item.rfq_item_id AND psa.supplier_response_item_id=v_offer.id RETURNING psa.* INTO v_allocation;
 IF NOT FOUND THEN INSERT INTO public.procurement_supplier_allocations AS psa(procurement_chain_id,rfq_id,rfq_item_id,supplier_response_item_id,supplier_id,allocated_quantity,selected_unit_price,currency,price_basis_quantity,price_basis_unit,delivery_terms,selection_reason,selected_by,selected_at,is_active,updated_at)
 VALUES(v_rfq.procurement_chain_id,v_rfq.rfq_id,v_item.rfq_item_id,v_offer.id,v_offer.supplier_id,v_quantity,v_offer.calculated_unit_price,v_offer.currency,v_offer.price_basis_quantity,v_offer.price_basis_unit,coalesce(nullif(v_offer.lead_time_raw,''),'Not provided'),format('%s explicitly approved supplier offer.',initcap(v_role)),p_actor_id,now(),true,now()) RETURNING psa.* INTO v_allocation;END IF;
 RETURN QUERY SELECT v_allocation.id,v_allocation.procurement_chain_id,v_allocation.rfq_id,v_allocation.rfq_item_id,v_allocation.supplier_response_item_id,v_allocation.supplier_id,v_allocation.allocated_quantity,v_allocation.selected_unit_price,v_allocation.currency,v_allocation.price_basis_quantity,v_allocation.price_basis_unit,v_allocation.selected_at,v_allocation.selected_by,v_role,v_method;
END $$;
REVOKE ALL ON FUNCTION public.approve_supplier_offer_for_rfq_item(uuid,uuid,uuid,uuid,text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.approve_supplier_offer_for_rfq_item(uuid,uuid,uuid,uuid,text,numeric) TO service_role;
NOTIFY pgrst,'reload schema';
