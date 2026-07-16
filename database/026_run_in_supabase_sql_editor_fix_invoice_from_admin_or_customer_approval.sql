-- Manual Supabase SQL Editor migration. Do not run automatically.
-- Creates one Draft Invoice per invocation for one approved supplier/currency group.

DROP INDEX IF EXISTS public.procurement_invoices_source_rfq_unique;

ALTER TABLE public.procurement_invoices
  ADD COLUMN IF NOT EXISTS invoice_sequence integer,
  ADD COLUMN IF NOT EXISTS generated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_role text NULL
    CHECK (created_by_role IS NULL OR created_by_role IN ('admin', 'support', 'customer', 'ai'));

CREATE UNIQUE INDEX IF NOT EXISTS procurement_invoices_chain_sequence_unique
  ON public.procurement_invoices(procurement_chain_id, invoice_sequence)
  WHERE invoice_sequence IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS procurement_invoices_number_unique
  ON public.procurement_invoices(invoice_number)
  WHERE invoice_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS procurement_invoices_idempotency_unique
  ON public.procurement_invoices(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS procurement_invoices_source_rfq_idx
  ON public.procurement_invoices(source_rfq_id, created_at);

ALTER TABLE public.procurement_invoice_items
  ADD COLUMN IF NOT EXISTS source_allocation_id uuid NULL
    REFERENCES public.procurement_supplier_allocations(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS source_rfq_id uuid NULL
    REFERENCES public.rfq_orders0(rfq_id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS requested_part_number text NULL,
  ADD COLUMN IF NOT EXISTS offered_part_number text NULL,
  ADD COLUMN IF NOT EXISTS normalized_unit_price numeric NULL,
  ADD COLUMN IF NOT EXISTS certificate_available boolean NULL,
  ADD COLUMN IF NOT EXISTS traceability_available boolean NULL;

CREATE UNIQUE INDEX IF NOT EXISTS procurement_invoice_items_allocation_unique_global
  ON public.procurement_invoice_items(source_allocation_id)
  WHERE source_allocation_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_draft_invoice_from_rfq(
  p_rfq_id uuid,
  p_actor_id uuid,
  p_execution_mode text,
  p_idempotency_key text
)
RETURNS TABLE(
  invoice_id uuid,
  procurement_chain_id uuid,
  procurement_number text,
  created boolean,
  included_count integer,
  open_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rfq public.rfq_orders0%ROWTYPE;
  v_chain public.procurement_chains%ROWTYPE;
  v_actor_role text;
  v_invoice_id uuid;
  v_invoice_procurement_chain_id uuid;
  v_invoice_procurement_number text;
  v_supplier_id uuid;
  v_currency text;
  v_sequence integer;
  v_invoice_number text;
  v_included integer;
  v_open integer;
  v_total numeric;
BEGIN
  IF p_execution_mode NOT IN ('manual', 'assisted', 'automatic') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid execution mode.';
  END IF;
  IF nullif(btrim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'An idempotency key is required.';
  END IF;

  SELECT ro.*
  INTO v_rfq
  FROM public.rfq_orders0 AS ro
  WHERE ro.rfq_id = p_rfq_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'RFQ not found.';
  END IF;
  IF v_rfq.procurement_chain_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'RFQ procurement chain not found.';
  END IF;

  SELECT up.role
  INTO v_actor_role
  FROM public.user_profiles AS up
  WHERE up.id = p_actor_id;
  IF coalesce(v_actor_role, '') NOT IN ('admin', 'support', 'customer') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'RFQ Invoice authorization required.';
  END IF;
  IF v_actor_role = 'customer' AND v_rfq.customer_id IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'RFQ Invoice authorization required.';
  END IF;

  SELECT pc.*
  INTO v_chain
  FROM public.procurement_chains AS pc
  WHERE pc.id = v_rfq.procurement_chain_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Procurement chain not found.';
  END IF;
  IF v_chain.procurement_number IS DISTINCT FROM v_rfq.procurement_number THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RFQ procurement number does not match its procurement chain.';
  END IF;
  IF v_actor_role = 'customer' AND v_chain.customer_user_id IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Procurement chain ownership required.';
  END IF;

  SELECT pi.id, pi.procurement_chain_id, pi.procurement_number
  INTO v_invoice_id, v_invoice_procurement_chain_id, v_invoice_procurement_number
  FROM public.procurement_invoices AS pi
  WHERE pi.idempotency_key = p_idempotency_key
  ORDER BY pi.created_at, pi.id
  LIMIT 1;
  IF v_invoice_id IS NOT NULL THEN
    IF v_invoice_procurement_chain_id IS DISTINCT FROM v_chain.id
      OR NOT EXISTS (
        SELECT 1
        FROM public.procurement_invoices AS existing_pi
        WHERE existing_pi.id = v_invoice_id
          AND existing_pi.source_rfq_id = v_rfq.rfq_id
      ) THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Idempotency key is already used by another Invoice request.';
    END IF;
    SELECT count(*)::integer
    INTO v_included
    FROM public.procurement_invoice_items AS pii
    WHERE pii.invoice_id = v_invoice_id;
    SELECT count(*)::integer
    INTO v_open
    FROM public.rfq_order_items0 AS roi
    WHERE roi.rfq_id = v_rfq.rfq_id
      AND coalesce((
        SELECT sum(existing_pii.quantity)
        FROM public.procurement_invoice_items AS existing_pii
        WHERE existing_pii.source_rfq_item_id = roi.rfq_item_id
      ), 0) < roi.requested_quantity;
    RETURN QUERY
      SELECT v_invoice_id, v_invoice_procurement_chain_id,
        v_invoice_procurement_number, false, v_included, v_open;
    RETURN;
  END IF;

  IF p_execution_mode = 'automatic' AND NOT EXISTS (
    SELECT 1
    FROM public.procurement_workflow_settings AS ws
    WHERE ws.procurement_chain_id = v_chain.id
      AND ws.execution_mode = 'automatic'
      AND ws.automatic_rfq_to_invoice = true
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Automatic RFQ conversion is disabled.';
  END IF;

  SELECT eligible.supplier_id, eligible.currency
  INTO v_supplier_id, v_currency
  FROM (
    SELECT psa.supplier_id, upper(psa.currency) AS currency,
      min(psa.created_at) AS first_approved_at
    FROM public.procurement_supplier_allocations AS psa
    INNER JOIN public.user_profiles AS approver
      ON approver.id = psa.selected_by
      AND (
        approver.role = 'admin'
        OR (approver.role = 'customer' AND approver.id = v_rfq.customer_id)
      )
    INNER JOIN public.rfq_order_items0 AS roi
      ON roi.rfq_item_id = psa.rfq_item_id
      AND roi.rfq_id = psa.rfq_id
      AND roi.procurement_chain_id = psa.procurement_chain_id
    INNER JOIN public.supplier_response_items AS sri
      ON sri.id = psa.supplier_response_item_id
      AND sri.supplier_id = psa.supplier_id
      AND sri.procurement_chain_id = psa.procurement_chain_id
    INNER JOIN public.supplier_responses AS sr
      ON sr.id = sri.supplier_response_id
      AND sr.supplier_id = psa.supplier_id
      AND sr.procurement_chain_id = psa.procurement_chain_id
      AND (sr.rfq_id IS NULL OR sr.rfq_id = psa.rfq_id)
    WHERE psa.rfq_id = v_rfq.rfq_id
      AND psa.procurement_chain_id = v_chain.id
      AND psa.is_active = true
      AND psa.allocated_quantity > 0
      AND psa.supplier_id IS NOT NULL
      AND psa.selected_unit_price >= 0
      AND nullif(btrim(psa.currency), '') IS NOT NULL
      AND psa.price_basis_quantity > 0
      AND nullif(btrim(psa.price_basis_unit), '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.procurement_invoice_items AS existing_pii
        WHERE existing_pii.source_allocation_id = psa.id
      )
    GROUP BY psa.supplier_id, upper(psa.currency)
  ) AS eligible
  ORDER BY eligible.first_approved_at, eligible.supplier_id, eligible.currency
  LIMIT 1;
  IF v_supplier_id IS NULL OR v_currency IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'No approved uninvoiced supplier allocations are eligible.';
  END IF;

  SELECT coalesce(max(pi.invoice_sequence), 0) + 1
  INTO v_sequence
  FROM public.procurement_invoices AS pi
  WHERE pi.procurement_chain_id = v_chain.id;
  v_invoice_number := format('%s-INV-%s', v_chain.procurement_number, lpad(v_sequence::text, 3, '0'));

  INSERT INTO public.procurement_invoices AS pi (
    procurement_chain_id, procurement_case_id, procurement_number,
    invoice_sequence, invoice_number, source_rfq_id, invoice_status,
    customer_user_id, supplier_user_id, admin_user_id,
    customer_company_name, supplier_company_name, invoice_date, currency,
    subtotal, total_amount, payment_status, creation_mode, idempotency_key,
    generated_at, created_by, created_by_role, created_at, updated_at
  ) VALUES (
    v_chain.id, v_rfq.procurement_case_id, v_chain.procurement_number,
    v_sequence, v_invoice_number, v_rfq.rfq_id, 'draft',
    v_rfq.customer_id, v_supplier_id,
    CASE WHEN v_actor_role IN ('admin', 'support') THEN p_actor_id ELSE NULL END,
    v_rfq.customer_company_name, NULL, current_date, v_currency,
    0, 0, 'unpaid', p_execution_mode, p_idempotency_key,
    now(), p_actor_id, v_actor_role, now(), now()
  )
  RETURNING pi.id INTO v_invoice_id;

  INSERT INTO public.procurement_invoice_items AS pii (
    invoice_id, procurement_chain_id, procurement_case_id, procurement_number,
    line_number, part_number, requested_part_number, offered_part_number,
    manufacturer, description, quantity, unit, unit_price,
    normalized_unit_price, currency, line_total, source_allocation_id,
    source_rfq_id, source_rfq_item_id, source_supplier_response_item_id,
    source_supplier_message_id, supplier_id, available_quantity,
    price_basis_quantity, price_basis_unit, moq, lead_time_days, packaging,
    condition, date_code, incoterms, payment_terms, quotation_valid_until,
    delivery_conditions, certificate_available, traceability_available,
    notes, created_at, updated_at
  )
  SELECT
    v_invoice_id, v_chain.id, v_rfq.procurement_case_id, v_chain.procurement_number,
    row_number() OVER (ORDER BY roi.line_number, psa.created_at, psa.id)::integer,
    coalesce(sri.offered_mpn, roi.part_number), roi.part_number, sri.offered_mpn,
    coalesce(sri.offered_manufacturer, roi.manufacturer), roi.description,
    psa.allocated_quantity, roi.quantity_unit, psa.selected_unit_price,
    sri.calculated_unit_price, v_currency,
    round(psa.allocated_quantity * psa.selected_unit_price, 2),
    psa.id, v_rfq.rfq_id, roi.rfq_item_id, sri.id, sri.source_message_id,
    psa.supplier_id, coalesce(sri.available_quantity, sri.offered_quantity),
    psa.price_basis_quantity, psa.price_basis_unit, sri.moq, sri.lead_time_days,
    coalesce(nullif(sri.commercial_terms ->> 'packaging', ''), sri.package_quantity::text),
    sri.condition, coalesce(sri.date_code_normalized, sri.date_code_raw),
    nullif(sri.commercial_terms ->> 'incoterms', ''),
    nullif(sri.commercial_terms ->> 'payment_terms', ''), sr.quote_valid_until,
    psa.delivery_terms, sri.certificate_available, sri.traceability_available,
    concat_ws(E'\n', nullif(psa.selection_reason, ''), nullif(sri.customer_visible_summary, '')),
    now(), now()
  FROM public.procurement_supplier_allocations AS psa
  INNER JOIN public.user_profiles AS approver
    ON approver.id = psa.selected_by
    AND (
      approver.role = 'admin'
      OR (approver.role = 'customer' AND approver.id = v_rfq.customer_id)
    )
  INNER JOIN public.rfq_order_items0 AS roi
    ON roi.rfq_item_id = psa.rfq_item_id
    AND roi.rfq_id = psa.rfq_id
    AND roi.procurement_chain_id = psa.procurement_chain_id
  INNER JOIN public.supplier_response_items AS sri
    ON sri.id = psa.supplier_response_item_id
    AND sri.supplier_id = psa.supplier_id
    AND sri.procurement_chain_id = psa.procurement_chain_id
  INNER JOIN public.supplier_responses AS sr
    ON sr.id = sri.supplier_response_id
    AND sr.supplier_id = psa.supplier_id
    AND sr.procurement_chain_id = psa.procurement_chain_id
    AND (sr.rfq_id IS NULL OR sr.rfq_id = psa.rfq_id)
  WHERE psa.rfq_id = v_rfq.rfq_id
    AND psa.procurement_chain_id = v_chain.id
    AND psa.supplier_id = v_supplier_id
    AND upper(psa.currency) = v_currency
    AND psa.is_active = true
    AND psa.allocated_quantity > 0
    AND psa.selected_unit_price >= 0
    AND psa.price_basis_quantity > 0
    AND nullif(btrim(psa.price_basis_unit), '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.procurement_invoice_items AS existing_pii
      WHERE existing_pii.source_allocation_id = psa.id
    );

  GET DIAGNOSTICS v_included = ROW_COUNT;
  IF v_included = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Eligible allocations changed during Invoice creation; retry the request.';
  END IF;

  SELECT coalesce(sum(pii.line_total), 0)
  INTO v_total
  FROM public.procurement_invoice_items AS pii
  WHERE pii.invoice_id = v_invoice_id;
  UPDATE public.procurement_invoices AS pi
  SET subtotal = v_total, total_amount = v_total, updated_at = now()
  WHERE pi.id = v_invoice_id;

  SELECT count(*)::integer
  INTO v_open
  FROM public.rfq_order_items0 AS roi
  WHERE roi.rfq_id = v_rfq.rfq_id
    AND coalesce((
      SELECT sum(existing_pii.quantity)
      FROM public.procurement_invoice_items AS existing_pii
      WHERE existing_pii.source_rfq_item_id = roi.rfq_item_id
    ), 0) < roi.requested_quantity;

  UPDATE public.procurement_chains AS pc
  SET source_invoice_id = coalesce(pc.source_invoice_id, v_invoice_id),
      current_stage = CASE WHEN v_open = 0 THEN 'payment' ELSE pc.current_stage END,
      current_stage_label = CASE WHEN v_open = 0 THEN 'Invoice draft' ELSE pc.current_stage_label END,
      updated_at = now()
  WHERE pc.id = v_chain.id;
  UPDATE public.procurement_progress AS pp
  SET current_stage = CASE WHEN v_open = 0 THEN 'payment' ELSE pp.current_stage END,
      current_stage_label = CASE WHEN v_open = 0 THEN 'Invoice draft' ELSE pp.current_stage_label END,
      status_note = CASE
        WHEN v_open > 0 THEN format('Draft Invoice %s created; %s RFQ positions remain open.', v_invoice_number, v_open)
        ELSE format('Draft Invoice %s created from approved supplier offers.', v_invoice_number)
      END
  WHERE pp.procurement_chain_id = v_chain.id;

  INSERT INTO public.procurement_transition_audit AS pta (
    procurement_chain_id, actor_id, actor_type, command_name, execution_mode,
    source_document_type, source_document_id, target_document_type,
    target_document_id, policy_result, decision_reason, idempotency_key
  ) VALUES (
    v_chain.id, p_actor_id,
    CASE WHEN p_execution_mode = 'automatic' THEN 'ai'
      WHEN v_actor_role = 'customer' THEN 'customer' ELSE 'admin' END,
    'create_invoice_from_rfq', p_execution_mode, 'rfq', v_rfq.rfq_id,
    'invoice', v_invoice_id,
    jsonb_build_object(
      'invoice_number', v_invoice_number,
      'supplier_id', v_supplier_id,
      'currency', v_currency,
      'included_items', v_included,
      'open_items', v_open
    ),
    'One deterministic approved supplier/currency group was invoiced.',
    p_idempotency_key
  );

  RETURN QUERY
    SELECT v_invoice_id, v_chain.id, v_chain.procurement_number,
      true, v_included, v_open;
END;
$$;

REVOKE ALL ON FUNCTION public.create_draft_invoice_from_rfq(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_draft_invoice_from_rfq(uuid, uuid, text, text)
  TO service_role;

NOTIFY pgrst, 'reload schema';
