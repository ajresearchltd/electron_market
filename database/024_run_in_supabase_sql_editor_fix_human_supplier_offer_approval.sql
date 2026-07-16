-- Manual Supabase SQL Editor migration. Do not run automatically.
-- Makes an explicit Customer/Admin decision authoritative while preserving order boundaries.

CREATE OR REPLACE FUNCTION public.approve_supplier_offer_for_rfq_item(
  p_rfq_id uuid, p_rfq_item_id uuid, p_offer_item_id uuid,
  p_actor_id uuid, p_actor_role text, p_approved_quantity numeric
)
RETURNS TABLE(allocation_id uuid, procurement_chain_id uuid, rfq_id uuid, rfq_item_id uuid,
  supplier_offer_item_id uuid, supplier_id uuid, approved_quantity numeric,
  selected_unit_price numeric, currency text, price_basis_quantity numeric,
  price_basis_unit text, approved_at timestamptz, approved_by uuid,
  approved_by_role text, match_method text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_rfq public.rfq_orders0%ROWTYPE; v_item public.rfq_order_items0%ROWTYPE;
  v_offer public.supplier_response_items%ROWTYPE; v_response public.supplier_responses%ROWTYPE;
  v_allocation public.procurement_supplier_allocations%ROWTYPE; v_role text;
  v_usable numeric; v_quantity numeric; v_method text;
BEGIN
  SELECT up.role INTO v_role FROM public.user_profiles AS up WHERE up.id=p_actor_id;
  IF v_role IS NULL OR v_role<>p_actor_role OR v_role NOT IN ('customer','admin') THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Offer approval authorization required.';
  END IF;
  SELECT ro.* INTO v_rfq FROM public.rfq_orders0 AS ro WHERE ro.rfq_id=p_rfq_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='RFQ was not found.'; END IF;
  IF v_role='customer' AND v_rfq.customer_id IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='You do not have permission to approve this offer.';
  END IF;
  SELECT roi.* INTO v_item FROM public.rfq_order_items0 AS roi
  WHERE roi.rfq_id=v_rfq.rfq_id AND roi.rfq_item_id=p_rfq_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='RFQ position was not found.'; END IF;
  SELECT sri.* INTO v_offer FROM public.supplier_response_items AS sri
  WHERE sri.id=p_offer_item_id AND sri.is_current=true;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Supplier offer was not found.'; END IF;
  SELECT sr.* INTO v_response FROM public.supplier_responses AS sr
  WHERE sr.id=v_offer.supplier_response_id AND sr.is_current=true;
  IF NOT FOUND OR v_offer.procurement_chain_id IS DISTINCT FROM v_rfq.procurement_chain_id
    OR v_response.procurement_chain_id IS DISTINCT FROM v_rfq.procurement_chain_id
    OR (v_response.rfq_id IS NOT NULL AND v_response.rfq_id IS DISTINCT FROM v_rfq.rfq_id) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Supplier offer belongs to another procurement order.';
  END IF;
  IF v_offer.supplier_id IS NULL OR v_offer.supplier_id IS DISTINCT FROM v_response.supplier_id THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Canonical supplier relationship is invalid.';
  END IF;
  IF v_offer.calculated_unit_price IS NULL OR v_offer.currency IS NULL
    OR coalesce(v_offer.price_basis_quantity,0)<=0 OR nullif(v_offer.price_basis_unit,'') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Supplier price, currency and price basis must be confirmed.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.procurement_invoice_items AS pii
    WHERE pii.source_rfq_item_id=v_item.rfq_item_id) THEN
    RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='This approved allocation is already included in a protected Invoice.';
  END IF;
  v_usable:=least(coalesce(v_offer.offered_quantity,v_offer.available_quantity),coalesce(v_offer.available_quantity,v_offer.offered_quantity));
  v_quantity:=coalesce(p_approved_quantity,least(v_item.requested_quantity,v_usable));
  IF v_quantity<=0 OR v_quantity>v_item.requested_quantity OR v_quantity>v_usable THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Approved quantity is invalid.';
  END IF;
  v_method:=CASE WHEN v_role='admin' THEN 'manual_admin' ELSE 'manual_customer' END;
  UPDATE public.supplier_response_items AS sri SET rfq_id=v_rfq.rfq_id,
    rfq_item_id=v_item.rfq_item_id,match_method=v_method,updated_at=now() WHERE sri.id=v_offer.id;
  UPDATE public.procurement_supplier_allocations AS psa SET is_active=false,updated_at=now()
  WHERE psa.rfq_id=v_rfq.rfq_id AND psa.rfq_item_id=v_item.rfq_item_id AND psa.is_active
    AND psa.supplier_response_item_id<>v_offer.id;
  INSERT INTO public.procurement_supplier_allocations AS psa(procurement_chain_id,rfq_id,rfq_item_id,
    supplier_response_item_id,supplier_id,allocated_quantity,selected_unit_price,currency,
    price_basis_quantity,price_basis_unit,delivery_terms,selection_reason,selected_by,selected_at,is_active,updated_at)
  VALUES(v_rfq.procurement_chain_id,v_rfq.rfq_id,v_item.rfq_item_id,v_offer.id,v_offer.supplier_id,
    v_quantity,v_offer.calculated_unit_price,v_offer.currency,v_offer.price_basis_quantity,v_offer.price_basis_unit,
    coalesce(nullif(v_offer.lead_time_raw,''),'Not provided'),format('%s explicitly approved supplier offer.',initcap(v_role)),
    p_actor_id,now(),true,now())
  ON CONFLICT(rfq_item_id,supplier_response_item_id) DO UPDATE SET allocated_quantity=EXCLUDED.allocated_quantity,
    selected_unit_price=EXCLUDED.selected_unit_price,currency=EXCLUDED.currency,
    price_basis_quantity=EXCLUDED.price_basis_quantity,price_basis_unit=EXCLUDED.price_basis_unit,
    delivery_terms=EXCLUDED.delivery_terms,selection_reason=EXCLUDED.selection_reason,
    selected_by=EXCLUDED.selected_by,selected_at=EXCLUDED.selected_at,is_active=true,updated_at=now()
  RETURNING psa.* INTO v_allocation;
  RETURN QUERY SELECT v_allocation.id,v_allocation.procurement_chain_id,v_allocation.rfq_id,
    v_allocation.rfq_item_id,v_allocation.supplier_response_item_id,v_allocation.supplier_id,
    v_allocation.allocated_quantity,v_allocation.selected_unit_price,v_allocation.currency,
    v_allocation.price_basis_quantity,v_allocation.price_basis_unit,v_allocation.selected_at,
    v_allocation.selected_by,v_role,v_method;
END; $$;

REVOKE ALL ON FUNCTION public.approve_supplier_offer_for_rfq_item(uuid,uuid,uuid,uuid,text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.approve_supplier_offer_for_rfq_item(uuid,uuid,uuid,uuid,text,numeric) TO service_role;
NOTIFY pgrst, 'reload schema';
