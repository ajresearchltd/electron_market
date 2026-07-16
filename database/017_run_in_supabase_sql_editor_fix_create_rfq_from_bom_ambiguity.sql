-- Manual Supabase SQL Editor migration. Do not run automatically.
-- Qualifies table-column references that conflict with RETURNS TABLE output variables.

CREATE OR REPLACE FUNCTION public.create_draft_rfq_from_bom(
  p_bom_upload_id uuid,
  p_customer_user_id uuid
)
RETURNS TABLE(rfq_id uuid, procurement_chain_id uuid, procurement_number text, created boolean, eligible_count integer, excluded_count integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_upload public.customer_bom_uploads%ROWTYPE;
  v_chain public.procurement_chains%ROWTYPE;
  v_rfq_id uuid;
  v_eligible integer;
  v_excluded integer;
  v_total_quantity numeric;
BEGIN
  SELECT cu.* INTO v_upload
  FROM public.customer_bom_uploads AS cu
  WHERE cu.id = p_bom_upload_id AND cu.user_id = p_customer_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'BOM upload not found.'; END IF;
  IF v_upload.procurement_chain_id IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'BOM procurement chain not found.'; END IF;

  SELECT pc.* INTO v_chain
  FROM public.procurement_chains AS pc
  WHERE pc.id = v_upload.procurement_chain_id AND pc.customer_user_id = p_customer_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Procurement chain not found.'; END IF;

  SELECT ro.rfq_id INTO v_rfq_id
  FROM public.rfq_orders0 AS ro
  WHERE ro.source_bom_upload_id = v_upload.id OR ro.procurement_chain_id = v_chain.id
  ORDER BY ro.created_at
  LIMIT 1;

  SELECT
    count(*) FILTER (WHERE
      nullif(trim(coalesce(bi.manufacturer_part_number, bi.normalized_part_number, bi.part_number)), '') IS NOT NULL
      AND coalesce(bi.quantity, 0) > 0
      AND jsonb_array_length(coalesce(bi.validation_errors, '[]'::jsonb)) = 0
      AND lower(coalesce(bi.validation_status, 'pending')) NOT IN ('invalid', 'error', 'failed', 'needs_review', 'warning')
      AND lower(coalesce(bi.part_number_check_status, 'not_checked')) NOT IN ('not_found', 'invalid_format', 'error', 'needs_review', 'ambiguous', 'manufacturer_mismatch', 'suspicious_format')
    ), count(*) FILTER (WHERE NOT (
      nullif(trim(coalesce(bi.manufacturer_part_number, bi.normalized_part_number, bi.part_number)), '') IS NOT NULL
      AND coalesce(bi.quantity, 0) > 0
      AND jsonb_array_length(coalesce(bi.validation_errors, '[]'::jsonb)) = 0
      AND lower(coalesce(bi.validation_status, 'pending')) NOT IN ('invalid', 'error', 'failed', 'needs_review', 'warning')
      AND lower(coalesce(bi.part_number_check_status, 'not_checked')) NOT IN ('not_found', 'invalid_format', 'error', 'needs_review', 'ambiguous', 'manufacturer_mismatch', 'suspicious_format')
    )), coalesce(sum(bi.quantity) FILTER (WHERE
      nullif(trim(coalesce(bi.manufacturer_part_number, bi.normalized_part_number, bi.part_number)), '') IS NOT NULL
      AND coalesce(bi.quantity, 0) > 0
      AND jsonb_array_length(coalesce(bi.validation_errors, '[]'::jsonb)) = 0
      AND lower(coalesce(bi.validation_status, 'pending')) NOT IN ('invalid', 'error', 'failed', 'needs_review', 'warning')
      AND lower(coalesce(bi.part_number_check_status, 'not_checked')) NOT IN ('not_found', 'invalid_format', 'error', 'needs_review', 'ambiguous', 'manufacturer_mismatch', 'suspicious_format')
    ), 0)
  INTO v_eligible, v_excluded, v_total_quantity
  FROM public.customer_bom_upload_items AS bi
  WHERE bi.upload_id = v_upload.id AND bi.user_id = p_customer_user_id;

  IF v_rfq_id IS NOT NULL THEN
    RETURN QUERY SELECT v_rfq_id, v_chain.id, v_chain.procurement_number, false, v_eligible, v_excluded;
    RETURN;
  END IF;
  IF v_eligible = 0 THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'No eligible BOM items are available for RFQ creation.'; END IF;

  INSERT INTO public.rfq_orders0 AS ro (
    order_number, procurement_chain_id, procurement_case_id, procurement_number,
    source_bom_upload_id, customer_id, customer_company_name, customer_contact_name,
    customer_email, delivery_country_name, rfq_status, priority_status, deadline_at,
    total_items_count, total_requested_quantity, currency, buyer_notes, customer_reference
  ) VALUES (
    v_chain.procurement_number, v_chain.id, v_upload.procurement_case_id, v_chain.procurement_number,
    v_upload.id, p_customer_user_id, coalesce(v_upload.customer_company_name, v_chain.customer_company_name),
    v_upload.contact_person, v_upload.contact_email, v_upload.destination_country, 'draft', 'draft',
    v_upload.required_delivery_date, v_eligible, v_total_quantity, coalesce(v_upload.budget_currency, 'USD'),
    concat_ws(E'\n', nullif(v_upload.project_description, ''), nullif(v_upload.notes, '')), coalesce(v_chain.customer_reference, v_upload.document_name)
  ) RETURNING ro.rfq_id INTO v_rfq_id;

  INSERT INTO public.rfq_order_items0 AS roi (
    rfq_id, order_number, line_number, part_number, manufacturer, description,
    requested_quantity, quantity_unit, target_unit_price, currency, required_date,
    customer_line_notes, procurement_chain_id, procurement_case_id, procurement_number,
    source_bom_item_id, validation_status, verification_result, technical_requirements
  )
  SELECT v_rfq_id, v_chain.procurement_number, row_number() OVER (ORDER BY bi.row_number, bi.id),
    coalesce(bi.manufacturer_part_number, bi.normalized_part_number, bi.part_number), bi.manufacturer,
    coalesce(bi.description, bi.product_name), bi.quantity, coalesce(nullif(bi.unit, ''), 'pcs'),
    bi.target_unit_price, coalesce(bi.target_currency, v_upload.budget_currency, 'USD'),
    v_upload.required_delivery_date, concat_ws(E'\n', nullif(bi.notes, ''), nullif(bi.customer_comment, '')),
    v_chain.id, v_upload.procurement_case_id, v_chain.procurement_number, bi.id,
    bi.validation_status, concat_ws(': ', bi.part_number_check_status, bi.part_number_check_message),
    concat_ws(E'\n', nullif(bi.specification, ''), nullif(bi.date_code_requirement, ''),
      CASE WHEN bi.rohs_required THEN 'RoHS required' END, CASE WHEN bi.reach_required THEN 'REACH required' END)
  FROM public.customer_bom_upload_items AS bi
  WHERE bi.upload_id = v_upload.id AND bi.user_id = p_customer_user_id
    AND nullif(trim(coalesce(bi.manufacturer_part_number, bi.normalized_part_number, bi.part_number)), '') IS NOT NULL
    AND coalesce(bi.quantity, 0) > 0
    AND jsonb_array_length(coalesce(bi.validation_errors, '[]'::jsonb)) = 0
    AND lower(coalesce(bi.validation_status, 'pending')) NOT IN ('invalid', 'error', 'failed', 'needs_review', 'warning')
    AND lower(coalesce(bi.part_number_check_status, 'not_checked')) NOT IN ('not_found', 'invalid_format', 'error', 'needs_review', 'ambiguous', 'manufacturer_mismatch', 'suspicious_format');

  UPDATE public.customer_bom_upload_items AS bi
  SET created_rfq_item_id = roi.rfq_item_id, updated_at = now()
  FROM public.rfq_order_items0 AS roi
  WHERE roi.rfq_id = v_rfq_id AND roi.source_bom_item_id = bi.id;

  UPDATE public.customer_bom_uploads AS cu
  SET rfq_id = v_rfq_id, status = 'rfq_created', updated_at = now()
  WHERE cu.id = v_upload.id;

  UPDATE public.procurement_chains AS pc
  SET source_rfq_id = v_rfq_id, current_stage = 'rfq', current_stage_label = 'RFQ draft'
  WHERE pc.id = v_chain.id;

  UPDATE public.procurement_progress AS pp
  SET rfq_id = v_rfq_id, current_stage = 'rfq', current_stage_label = 'RFQ draft', status_note = 'Draft RFQ created from BOM.'
  WHERE pp.procurement_chain_id = v_chain.id;

  RETURN QUERY SELECT v_rfq_id, v_chain.id, v_chain.procurement_number, true, v_eligible, v_excluded;
END;
$$;

REVOKE ALL ON FUNCTION public.create_draft_rfq_from_bom(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_draft_rfq_from_bom(uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
