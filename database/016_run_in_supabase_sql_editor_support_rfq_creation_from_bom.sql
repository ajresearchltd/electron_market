-- Manual Supabase SQL Editor migration. Do not run automatically.
-- Adds Draft RFQ traceability and an atomic, idempotent BOM-to-RFQ operation.

ALTER TABLE public.rfq_orders0
  ADD COLUMN IF NOT EXISTS source_bom_upload_id uuid NULL REFERENCES public.customer_bom_uploads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_reference text NULL;

ALTER TABLE public.rfq_order_items0
  ADD COLUMN IF NOT EXISTS source_bom_item_id uuid NULL REFERENCES public.customer_bom_upload_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validation_status text NULL,
  ADD COLUMN IF NOT EXISTS verification_result text NULL,
  ADD COLUMN IF NOT EXISTS technical_requirements text NULL;

ALTER TABLE public.rfq_orders0 DROP CONSTRAINT IF EXISTS rfq_orders0_rfq_status_check;
ALTER TABLE public.rfq_orders0
  ADD CONSTRAINT rfq_orders0_rfq_status_check
  CHECK (rfq_status IN ('draft', 'open', 'quote_sent', 'supplier_selected', 'expired', 'cancelled'));

ALTER TABLE public.rfq_orders0
  ALTER COLUMN total_requested_quantity TYPE numeric USING total_requested_quantity::numeric;
ALTER TABLE public.rfq_order_items0
  ALTER COLUMN requested_quantity TYPE numeric USING requested_quantity::numeric;

CREATE UNIQUE INDEX IF NOT EXISTS rfq_orders0_source_bom_unique
  ON public.rfq_orders0(source_bom_upload_id)
  WHERE source_bom_upload_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS rfq_order_items0_source_bom_item_unique
  ON public.rfq_order_items0(source_bom_item_id)
  WHERE source_bom_item_id IS NOT NULL;

DROP POLICY IF EXISTS "Customers can select own active RFQs" ON public.rfq_orders0;
CREATE POLICY "Customers can select own active RFQs" ON public.rfq_orders0
  FOR SELECT TO authenticated USING (customer_id = auth.uid());
DROP POLICY IF EXISTS "Customers can select own active RFQ items" ON public.rfq_order_items0;
CREATE POLICY "Customers can select own active RFQ items" ON public.rfq_order_items0
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.rfq_orders0 r WHERE r.rfq_id = rfq_order_items0.rfq_id AND r.customer_id = auth.uid()
  ));

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
  SELECT * INTO v_upload
  FROM public.customer_bom_uploads
  WHERE id = p_bom_upload_id AND user_id = p_customer_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'BOM upload not found.'; END IF;
  IF v_upload.procurement_chain_id IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'BOM procurement chain not found.'; END IF;

  SELECT * INTO v_chain
  FROM public.procurement_chains
  WHERE id = v_upload.procurement_chain_id AND customer_user_id = p_customer_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Procurement chain not found.'; END IF;

  SELECT r.rfq_id INTO v_rfq_id
  FROM public.rfq_orders0 r
  WHERE r.source_bom_upload_id = v_upload.id OR r.procurement_chain_id = v_chain.id
  ORDER BY r.created_at LIMIT 1;

  SELECT
    count(*) FILTER (WHERE
      nullif(trim(coalesce(i.manufacturer_part_number, i.normalized_part_number, i.part_number)), '') IS NOT NULL
      AND coalesce(i.quantity, 0) > 0
      AND jsonb_array_length(coalesce(i.validation_errors, '[]'::jsonb)) = 0
      AND lower(coalesce(i.validation_status, 'pending')) NOT IN ('invalid', 'error', 'failed', 'needs_review', 'warning')
      AND lower(coalesce(i.part_number_check_status, 'not_checked')) NOT IN ('not_found', 'invalid_format', 'error', 'needs_review', 'ambiguous', 'manufacturer_mismatch', 'suspicious_format')
    ), count(*) FILTER (WHERE NOT (
      nullif(trim(coalesce(i.manufacturer_part_number, i.normalized_part_number, i.part_number)), '') IS NOT NULL
      AND coalesce(i.quantity, 0) > 0
      AND jsonb_array_length(coalesce(i.validation_errors, '[]'::jsonb)) = 0
      AND lower(coalesce(i.validation_status, 'pending')) NOT IN ('invalid', 'error', 'failed', 'needs_review', 'warning')
      AND lower(coalesce(i.part_number_check_status, 'not_checked')) NOT IN ('not_found', 'invalid_format', 'error', 'needs_review', 'ambiguous', 'manufacturer_mismatch', 'suspicious_format')
    )), coalesce(sum(i.quantity) FILTER (WHERE
      nullif(trim(coalesce(i.manufacturer_part_number, i.normalized_part_number, i.part_number)), '') IS NOT NULL
      AND coalesce(i.quantity, 0) > 0
      AND jsonb_array_length(coalesce(i.validation_errors, '[]'::jsonb)) = 0
      AND lower(coalesce(i.validation_status, 'pending')) NOT IN ('invalid', 'error', 'failed', 'needs_review', 'warning')
      AND lower(coalesce(i.part_number_check_status, 'not_checked')) NOT IN ('not_found', 'invalid_format', 'error', 'needs_review', 'ambiguous', 'manufacturer_mismatch', 'suspicious_format')
    ), 0)
  INTO v_eligible, v_excluded, v_total_quantity
  FROM public.customer_bom_upload_items i WHERE i.upload_id = v_upload.id AND i.user_id = p_customer_user_id;

  IF v_rfq_id IS NOT NULL THEN
    RETURN QUERY SELECT v_rfq_id, v_chain.id, v_chain.procurement_number, false, v_eligible, v_excluded;
    RETURN;
  END IF;
  IF v_eligible = 0 THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'No eligible BOM items are available for RFQ creation.'; END IF;

  INSERT INTO public.rfq_orders0 (
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
  ) RETURNING public.rfq_orders0.rfq_id INTO v_rfq_id;

  INSERT INTO public.rfq_order_items0 (
    rfq_id, order_number, line_number, part_number, manufacturer, description,
    requested_quantity, quantity_unit, target_unit_price, currency, required_date,
    customer_line_notes, procurement_chain_id, procurement_case_id, procurement_number,
    source_bom_item_id, validation_status, verification_result, technical_requirements
  )
  SELECT v_rfq_id, v_chain.procurement_number, row_number() OVER (ORDER BY i.row_number, i.id),
    coalesce(i.manufacturer_part_number, i.normalized_part_number, i.part_number), i.manufacturer,
    coalesce(i.description, i.product_name), i.quantity, coalesce(nullif(i.unit, ''), 'pcs'),
    i.target_unit_price, coalesce(i.target_currency, v_upload.budget_currency, 'USD'),
    v_upload.required_delivery_date, concat_ws(E'\n', nullif(i.notes, ''), nullif(i.customer_comment, '')),
    v_chain.id, v_upload.procurement_case_id, v_chain.procurement_number, i.id,
    i.validation_status, concat_ws(': ', i.part_number_check_status, i.part_number_check_message),
    concat_ws(E'\n', nullif(i.specification, ''), nullif(i.date_code_requirement, ''),
      CASE WHEN i.rohs_required THEN 'RoHS required' END, CASE WHEN i.reach_required THEN 'REACH required' END)
  FROM public.customer_bom_upload_items i
  WHERE i.upload_id = v_upload.id AND i.user_id = p_customer_user_id
    AND nullif(trim(coalesce(i.manufacturer_part_number, i.normalized_part_number, i.part_number)), '') IS NOT NULL
    AND coalesce(i.quantity, 0) > 0
    AND jsonb_array_length(coalesce(i.validation_errors, '[]'::jsonb)) = 0
    AND lower(coalesce(i.validation_status, 'pending')) NOT IN ('invalid', 'error', 'failed', 'needs_review', 'warning')
    AND lower(coalesce(i.part_number_check_status, 'not_checked')) NOT IN ('not_found', 'invalid_format', 'error', 'needs_review', 'ambiguous', 'manufacturer_mismatch', 'suspicious_format');

  UPDATE public.customer_bom_upload_items i SET created_rfq_item_id = r.rfq_item_id, updated_at = now()
  FROM public.rfq_order_items0 r WHERE r.rfq_id = v_rfq_id AND r.source_bom_item_id = i.id;
  UPDATE public.customer_bom_uploads SET rfq_id = v_rfq_id, status = 'rfq_created', updated_at = now() WHERE id = v_upload.id;
  UPDATE public.procurement_chains SET source_rfq_id = v_rfq_id, current_stage = 'rfq', current_stage_label = 'RFQ draft' WHERE id = v_chain.id;
  UPDATE public.procurement_progress SET rfq_id = v_rfq_id, current_stage = 'rfq', current_stage_label = 'RFQ draft', status_note = 'Draft RFQ created from BOM.' WHERE procurement_chain_id = v_chain.id;

  RETURN QUERY SELECT v_rfq_id, v_chain.id, v_chain.procurement_number, true, v_eligible, v_excluded;
END;
$$;

REVOKE ALL ON FUNCTION public.create_draft_rfq_from_bom(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_draft_rfq_from_bom(uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
