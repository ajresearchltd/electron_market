-- Manual Supabase SQL Editor migration. Do not execute automatically.
-- Adds optional reviewed destination values to the existing BOM -> RFQ and RFQ -> Invoice RPC contracts.
-- The existing two-argument/four-argument creation functions remain the authoritative business logic.

CREATE OR REPLACE FUNCTION public.create_draft_rfq_from_bom(
  p_bom_upload_id uuid,
  p_customer_user_id uuid,
  p_reviewed_values jsonb
)
RETURNS TABLE(rfq_id uuid, procurement_chain_id uuid, procurement_number text, created boolean, eligible_count integer, excluded_count integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_result record;
  v_item jsonb;
  v_source_item_id uuid;
  v_quantity numeric;
  v_price numeric;
BEGIN
  SELECT * INTO v_result
  FROM public.create_draft_rfq_from_bom(p_bom_upload_id, p_customer_user_id);

  IF v_result.created AND coalesce(jsonb_typeof(p_reviewed_values), 'null') = 'object' THEN
    UPDATE public.rfq_orders0 AS ro SET
      customer_reference = coalesce(nullif(btrim(p_reviewed_values->>'customer_reference'), ''), ro.customer_reference),
      delivery_country_name = coalesce(nullif(btrim(p_reviewed_values->>'destination_country'), ''), ro.delivery_country_name),
      deadline_at = coalesce((nullif(p_reviewed_values->>'required_delivery_date', ''))::timestamptz, ro.deadline_at),
      currency = coalesce(nullif(upper(btrim(p_reviewed_values->>'currency')), ''), ro.currency),
      buyer_notes = coalesce(nullif(btrim(p_reviewed_values->>'notes'), ''), ro.buyer_notes),
      updated_at = now()
    WHERE ro.rfq_id = v_result.rfq_id;

    FOR v_item IN SELECT value FROM jsonb_array_elements(coalesce(p_reviewed_values->'items', '[]'::jsonb)) LOOP
      v_source_item_id := (v_item->>'source_bom_item_id')::uuid;
      v_quantity := (v_item->>'requested_quantity')::numeric;
      v_price := nullif(v_item->>'target_unit_price', '')::numeric;
      IF v_quantity <= 0 THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Quantity must be greater than zero.'; END IF;
      IF v_price IS NOT NULL AND v_price < 0 THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Target unit price cannot be negative.'; END IF;
      UPDATE public.rfq_order_items0 AS roi SET
        part_number = coalesce(nullif(btrim(v_item->>'part_number'), ''), roi.part_number),
        manufacturer = nullif(btrim(v_item->>'manufacturer'), ''),
        description = nullif(btrim(v_item->>'description'), ''),
        requested_quantity = v_quantity,
        quantity_unit = coalesce(nullif(btrim(v_item->>'unit'), ''), roi.quantity_unit),
        target_unit_price = v_price,
        currency = coalesce(nullif(upper(btrim(v_item->>'currency')), ''), roi.currency),
        required_date = coalesce((nullif(v_item->>'required_date', ''))::date, roi.required_date),
        customer_line_notes = nullif(btrim(v_item->>'notes'), ''),
        updated_at = now()
      WHERE roi.rfq_id = v_result.rfq_id AND roi.source_bom_item_id = v_source_item_id;
      IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='A reviewed BOM position is not eligible for this RFQ.'; END IF;
    END LOOP;

    UPDATE public.rfq_orders0 AS ro SET
      total_items_count = totals.item_count,
      total_requested_quantity = totals.total_quantity,
      updated_at = now()
    FROM (SELECT count(*)::integer item_count, coalesce(sum(requested_quantity),0) total_quantity FROM public.rfq_order_items0 WHERE rfq_id=v_result.rfq_id) totals
    WHERE ro.rfq_id=v_result.rfq_id;
  END IF;
  RETURN QUERY SELECT v_result.rfq_id, v_result.procurement_chain_id, v_result.procurement_number, v_result.created, v_result.eligible_count, v_result.excluded_count;
END;
$$;

REVOKE ALL ON FUNCTION public.create_draft_rfq_from_bom(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_draft_rfq_from_bom(uuid,uuid,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.create_draft_invoice_from_rfq(
  p_rfq_id uuid,
  p_actor_id uuid,
  p_execution_mode text,
  p_idempotency_key text,
  p_reviewed_values jsonb
)
RETURNS TABLE(invoice_id uuid, procurement_chain_id uuid, procurement_number text, created boolean, included_count integer, open_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_result record; v_item jsonb;
BEGIN
  SELECT * INTO v_result FROM public.create_draft_invoice_from_rfq(p_rfq_id,p_actor_id,p_execution_mode,p_idempotency_key);
  IF v_result.created AND coalesce(jsonb_typeof(p_reviewed_values),'null')='object' THEN
    UPDATE public.procurement_invoices AS pi SET
      invoice_date=coalesce((nullif(p_reviewed_values->>'invoice_date',''))::date,pi.invoice_date),
      due_date=coalesce((nullif(p_reviewed_values->>'due_date',''))::date,pi.due_date),
      notes=nullif(btrim(p_reviewed_values->>'notes'),''),
      updated_at=now()
    WHERE pi.id=v_result.invoice_id;
    FOR v_item IN SELECT value FROM jsonb_array_elements(coalesce(p_reviewed_values->'items','[]'::jsonb)) LOOP
      UPDATE public.procurement_invoice_items AS pii SET
        description=nullif(btrim(v_item->>'description'),''),
        notes=nullif(btrim(v_item->>'notes'),''),
        updated_at=now()
      WHERE pii.invoice_id=v_result.invoice_id AND pii.source_allocation_id=(v_item->>'source_allocation_id')::uuid;
      IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='A reviewed Invoice position is not eligible for this Invoice.'; END IF;
    END LOOP;
  END IF;
  RETURN QUERY SELECT v_result.invoice_id,v_result.procurement_chain_id,v_result.procurement_number,v_result.created,v_result.included_count,v_result.open_count;
END;
$$;

REVOKE ALL ON FUNCTION public.create_draft_invoice_from_rfq(uuid,uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_draft_invoice_from_rfq(uuid,uuid,text,text,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
