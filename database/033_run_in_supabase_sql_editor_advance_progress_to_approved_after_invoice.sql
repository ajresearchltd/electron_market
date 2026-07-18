-- Manual Supabase SQL Editor migration. Do not run automatically.
-- Keeps Invoice creation transactional while making Approved the minimum post-Invoice stage.

DO $$
BEGIN
  IF to_regprocedure('public.create_draft_invoice_from_rfq_legacy_033(uuid,uuid,text,text)') IS NULL THEN
    ALTER FUNCTION public.create_draft_invoice_from_rfq(uuid,uuid,text,text)
      RENAME TO create_draft_invoice_from_rfq_legacy_033;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.create_draft_invoice_from_rfq_legacy_033(uuid,uuid,text,text)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.create_draft_invoice_from_rfq(
  p_rfq_id uuid,p_actor_id uuid,p_execution_mode text,p_idempotency_key text
)
RETURNS TABLE(invoice_id uuid,procurement_chain_id uuid,procurement_number text,created boolean,included_count integer,open_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_chain_id uuid;v_chain_stage text;v_chain_label text;v_progress_stage text;v_progress_label text;
  v_invoice_id uuid;v_result_chain_id uuid;v_procurement_number text;v_created boolean;v_included integer;v_open integer;
BEGIN
  SELECT ro.procurement_chain_id INTO v_chain_id FROM public.rfq_orders0 AS ro WHERE ro.rfq_id=p_rfq_id;
  IF v_chain_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='RFQ procurement chain not found.';END IF;
  SELECT pc.current_stage,pc.current_stage_label INTO v_chain_stage,v_chain_label FROM public.procurement_chains AS pc WHERE pc.id=v_chain_id FOR UPDATE;
  SELECT pp.current_stage,pp.current_stage_label INTO v_progress_stage,v_progress_label FROM public.procurement_progress AS pp WHERE pp.procurement_chain_id=v_chain_id FOR UPDATE;

  SELECT result.invoice_id,result.procurement_chain_id,result.procurement_number,result.created,result.included_count,result.open_count
  INTO v_invoice_id,v_result_chain_id,v_procurement_number,v_created,v_included,v_open
  FROM public.create_draft_invoice_from_rfq_legacy_033(p_rfq_id,p_actor_id,p_execution_mode,p_idempotency_key) AS result;

  IF v_created THEN
    UPDATE public.procurement_chains AS pc SET
      current_stage=CASE WHEN coalesce(v_chain_stage,'bom_received') IN('approved','payment','goods_shipped','goods_received','order_completed') THEN v_chain_stage ELSE 'approved' END,
      current_stage_label=CASE WHEN coalesce(v_chain_stage,'bom_received') IN('approved','payment','goods_shipped','goods_received','order_completed') THEN coalesce(v_chain_label,initcap(replace(v_chain_stage,'_',' '))) ELSE 'Approved' END,
      updated_at=now()
    WHERE pc.id=v_chain_id;
    UPDATE public.procurement_progress AS pp SET
      current_stage=CASE WHEN coalesce(v_progress_stage,v_chain_stage,'bom_received') IN('approved','payment','goods_shipped','goods_received','order_completed') THEN coalesce(v_progress_stage,v_chain_stage) ELSE 'approved' END,
      current_stage_label=CASE WHEN coalesce(v_progress_stage,v_chain_stage,'bom_received') IN('approved','payment','goods_shipped','goods_received','order_completed') THEN coalesce(v_progress_label,v_chain_label,initcap(replace(coalesce(v_progress_stage,v_chain_stage),'_',' '))) ELSE 'Approved' END,
      status_note=format('Draft Invoice %s created from approved supplier allocations.',(SELECT pi.invoice_number FROM public.procurement_invoices AS pi WHERE pi.id=v_invoice_id))
    WHERE pp.procurement_chain_id=v_chain_id;
  END IF;
  RETURN QUERY SELECT v_invoice_id,v_result_chain_id,v_procurement_number,v_created,v_included,v_open;
END;
$$;

REVOKE ALL ON FUNCTION public.create_draft_invoice_from_rfq(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_draft_invoice_from_rfq(uuid,uuid,text,text) TO service_role;

-- Repair only pre-Approved persisted stages that already have canonical Invoice evidence.
UPDATE public.procurement_chains AS pc SET current_stage='approved',current_stage_label='Approved',updated_at=now()
WHERE coalesce(pc.current_stage,'bom_received') IN('bom_received','rfq','quote_received')
  AND EXISTS(SELECT 1 FROM public.procurement_invoices AS pi WHERE pi.procurement_chain_id=pc.id);
UPDATE public.procurement_progress AS pp SET current_stage='approved',current_stage_label='Approved',status_note='Approved supplier allocations have been converted to an Invoice.'
WHERE coalesce(pp.current_stage,'bom_received') IN('bom_received','rfq','quote_received')
  AND EXISTS(SELECT 1 FROM public.procurement_invoices AS pi WHERE pi.procurement_chain_id=pp.procurement_chain_id);

NOTIFY pgrst,'reload schema';
