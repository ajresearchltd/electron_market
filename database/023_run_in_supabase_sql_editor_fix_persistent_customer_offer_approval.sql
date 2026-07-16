-- Manual Supabase SQL Editor migration. Do not run automatically.
-- Persists Customer offer approval atomically in the canonical allocation table.

CREATE OR REPLACE FUNCTION public.approve_customer_supplier_offer(
  p_rfq_id uuid,
  p_offer_item_id uuid,
  p_customer_id uuid
)
RETURNS TABLE(
  allocation_id uuid,
  rfq_id uuid,
  rfq_item_id uuid,
  supplier_offer_item_id uuid,
  supplier_id uuid,
  approved_quantity numeric,
  selected_unit_price numeric,
  currency text,
  price_basis_quantity numeric,
  price_basis_unit text,
  approved_at timestamptz,
  approved_by uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rfq public.rfq_orders0%ROWTYPE;
  v_offer public.supplier_response_items%ROWTYPE;
  v_item public.rfq_order_items0%ROWTYPE;
  v_response public.supplier_responses%ROWTYPE;
  v_quantity numeric;
  v_allocation public.procurement_supplier_allocations%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles AS up
    WHERE up.id = p_customer_id AND up.role = 'customer'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Customer authorization required.';
  END IF;

  SELECT ro.* INTO v_rfq
  FROM public.rfq_orders0 AS ro
  WHERE ro.rfq_id = p_rfq_id AND ro.customer_id = p_customer_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'RFQ does not belong to this Customer.';
  END IF;

  SELECT sri.* INTO v_offer
  FROM public.supplier_response_items AS sri
  WHERE sri.id = p_offer_item_id AND sri.rfq_id = v_rfq.rfq_id AND sri.is_current = true;
  IF NOT FOUND OR v_offer.rfq_item_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Supplier offer not found.';
  END IF;

  SELECT roi.* INTO v_item
  FROM public.rfq_order_items0 AS roi
  WHERE roi.rfq_item_id = v_offer.rfq_item_id AND roi.rfq_id = v_rfq.rfq_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'RFQ position not found.';
  END IF;

  SELECT sr.* INTO v_response
  FROM public.supplier_responses AS sr
  WHERE sr.id = v_offer.supplier_response_id
    AND sr.rfq_id = v_rfq.rfq_id
    AND sr.procurement_chain_id = v_rfq.procurement_chain_id
    AND sr.is_current = true;
  IF NOT FOUND OR v_offer.procurement_chain_id IS DISTINCT FROM v_rfq.procurement_chain_id THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Supplier offer does not belong to this procurement chain.';
  END IF;
  IF v_offer.supplier_id IS NULL OR v_offer.supplier_id IS DISTINCT FROM v_response.supplier_id THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Canonical supplier relationship is invalid.';
  END IF;
  IF v_offer.calculated_unit_price IS NULL OR v_offer.currency IS NULL OR v_offer.price_basis_quantity IS NULL OR v_offer.price_basis_quantity <= 0 OR v_offer.price_basis_unit IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Supplier price, currency and price basis must be confirmed.';
  END IF;
  IF v_offer.review_status <> 'not_required' OR v_offer.normalization_status <> 'validated' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Supplier offer has a blocking technical or normalization review.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.procurement_invoice_items AS pii WHERE pii.source_rfq_item_id = v_item.rfq_item_id) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'This RFQ position is already included in an Invoice.';
  END IF;

  v_quantity := least(
    v_item.requested_quantity,
    coalesce(v_offer.offered_quantity, v_offer.available_quantity),
    coalesce(v_offer.available_quantity, v_offer.offered_quantity)
  );
  IF v_quantity IS NULL OR v_quantity <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'This offer has no approvable quantity.';
  END IF;

  UPDATE public.procurement_supplier_allocations AS psa
  SET is_active = false, updated_at = now()
  WHERE psa.rfq_id = v_rfq.rfq_id
    AND psa.rfq_item_id = v_item.rfq_item_id
    AND psa.is_active = true
    AND psa.supplier_response_item_id <> v_offer.id;

  INSERT INTO public.procurement_supplier_allocations AS psa (
    procurement_chain_id, rfq_id, rfq_item_id, supplier_response_item_id,
    supplier_id, allocated_quantity, selected_unit_price, currency,
    price_basis_quantity, price_basis_unit, delivery_terms, selection_reason,
    selected_by, selected_at, is_active, updated_at
  ) VALUES (
    v_rfq.procurement_chain_id, v_rfq.rfq_id, v_item.rfq_item_id, v_offer.id,
    v_offer.supplier_id, v_quantity, v_offer.calculated_unit_price, v_offer.currency,
    v_offer.price_basis_quantity, v_offer.price_basis_unit,
    coalesce(nullif(v_offer.lead_time_raw, ''), 'Not provided'),
    'Customer approved supplier offer.', p_customer_id, now(), true, now()
  )
  ON CONFLICT (rfq_item_id, supplier_response_item_id) DO UPDATE
  SET allocated_quantity = EXCLUDED.allocated_quantity,
      selected_unit_price = EXCLUDED.selected_unit_price,
      currency = EXCLUDED.currency,
      price_basis_quantity = EXCLUDED.price_basis_quantity,
      price_basis_unit = EXCLUDED.price_basis_unit,
      delivery_terms = EXCLUDED.delivery_terms,
      selection_reason = EXCLUDED.selection_reason,
      selected_by = EXCLUDED.selected_by,
      selected_at = EXCLUDED.selected_at,
      is_active = true,
      updated_at = now()
  RETURNING psa.* INTO v_allocation;

  RETURN QUERY SELECT
    v_allocation.id, v_allocation.rfq_id, v_allocation.rfq_item_id,
    v_allocation.supplier_response_item_id, v_allocation.supplier_id,
    v_allocation.allocated_quantity, v_allocation.selected_unit_price,
    v_allocation.currency, v_allocation.price_basis_quantity,
    v_allocation.price_basis_unit, v_allocation.selected_at,
    v_allocation.selected_by;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_customer_supplier_offer(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_customer_supplier_offer(uuid, uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
