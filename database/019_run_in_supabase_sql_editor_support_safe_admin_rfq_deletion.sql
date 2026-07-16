-- Manual Supabase SQL Editor migration. Do not run automatically.
-- Adds one protected transaction for preserving correspondence while deleting an eligible RFQ.

CREATE TABLE IF NOT EXISTS public.admin_rfq_deletion_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL,
  procurement_chain_id uuid NULL,
  procurement_number text NULL,
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  source_bom_upload_id uuid NULL,
  came_from_bom boolean NOT NULL,
  dependency_summary jsonb NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('deleted','archived')),
  deletion_reason text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_rfq_deletion_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_rfq_deletion_audit FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.delete_eligible_rfq_as_admin(
  p_rfq_id uuid, p_admin_user_id uuid, p_confirmation text, p_reason text
)
RETURNS TABLE(rfq_id uuid, procurement_chain_id uuid, procurement_number text, source_bom_upload_id uuid, deleted boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_rfq public.rfq_orders0%ROWTYPE; v_bom_id uuid; v_bom_count integer; v_invoice_count integer;
  v_order_count integer; v_waybill_count integer; v_receive_count integer; v_dependencies jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles AS up WHERE up.id=p_admin_user_id AND up.role='admin') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Admin authorization required.'; END IF;
  SELECT ro.* INTO v_rfq FROM public.rfq_orders0 AS ro WHERE ro.rfq_id=p_rfq_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='RFQ not found.'; END IF;
  SELECT coalesce(v_rfq.source_bom_upload_id,(SELECT cu.id FROM public.customer_bom_uploads AS cu WHERE cu.procurement_chain_id=v_rfq.procurement_chain_id ORDER BY cu.created_at LIMIT 1)) INTO v_bom_id;
  SELECT count(*)::integer INTO v_bom_count FROM public.customer_bom_uploads AS cu WHERE cu.id=v_bom_id;
  SELECT count(*)::integer INTO v_invoice_count FROM public.procurement_invoices AS pi WHERE pi.source_rfq_id=v_rfq.rfq_id OR (v_rfq.procurement_chain_id IS NOT NULL AND pi.procurement_chain_id=v_rfq.procurement_chain_id);
  SELECT count(*)::integer INTO v_order_count FROM public.active_orders AS ao WHERE ao.rfq_id=v_rfq.rfq_id;
  SELECT count(*)::integer INTO v_waybill_count FROM public.procurement_waybills AS pw WHERE v_rfq.procurement_chain_id IS NOT NULL AND pw.procurement_chain_id=v_rfq.procurement_chain_id;
  SELECT count(*)::integer INTO v_receive_count FROM public.procurement_receive_orders AS pro WHERE v_rfq.procurement_chain_id IS NOT NULL AND pro.procurement_chain_id=v_rfq.procurement_chain_id;
  v_dependencies=jsonb_build_object('invoices',v_invoice_count,'active_orders',v_order_count,'waybills',v_waybill_count,'receive_orders',v_receive_count);
  IF v_invoice_count+v_order_count+v_waybill_count+v_receive_count>0 THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='RFQ deletion is blocked by downstream commercial documents.'; END IF;
  IF coalesce(trim(p_reason),'')='' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='A deletion reason is required.'; END IF;
  IF v_bom_count>0 AND p_confirmation IS DISTINCT FROM v_rfq.procurement_number THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='The procurement-number confirmation does not match.'; END IF;

  UPDATE public.supplier_inbound_messages AS sim SET rfq_id=NULL,rfq_identification_method='awaiting_rfq_creation',rfq_identification_confidence=NULL,processing_status=CASE WHEN sim.sender_authorization_status='authorized' THEN 'needs_review' ELSE sim.processing_status END,processing_error=CASE WHEN sim.sender_authorization_status='authorized' THEN 'awaiting_rfq_creation' ELSE sim.processing_error END WHERE sim.rfq_id=v_rfq.rfq_id;
  UPDATE public.supplier_message_parse_runs AS smpr SET rfq_id=NULL WHERE smpr.rfq_id=v_rfq.rfq_id;
  UPDATE public.supplier_responses AS sr SET rfq_id=NULL,needs_review=true,status=CASE WHEN sr.status='validated' THEN 'needs_review' ELSE sr.status END WHERE sr.rfq_id=v_rfq.rfq_id;
  UPDATE public.supplier_response_items AS sri SET rfq_id=NULL,rfq_item_id=NULL,review_status=CASE WHEN sri.review_status='not_required' THEN 'pending' ELSE sri.review_status END WHERE sri.rfq_id=v_rfq.rfq_id OR sri.rfq_item_id IN (SELECT roi.rfq_item_id FROM public.rfq_order_items0 AS roi WHERE roi.rfq_id=v_rfq.rfq_id);
  UPDATE public.supplier_response_match_reviews AS srmr SET suggested_rfq_item_id=NULL,candidate_rfq_ids=array_remove(srmr.candidate_rfq_ids,v_rfq.rfq_id),resolution_note=concat_ws(' ',srmr.resolution_note,'RFQ deleted; offer awaits RFQ recreation.') WHERE srmr.suggested_rfq_item_id IN (SELECT roi.rfq_item_id FROM public.rfq_order_items0 AS roi WHERE roi.rfq_id=v_rfq.rfq_id) OR v_rfq.rfq_id=ANY(coalesce(srmr.candidate_rfq_ids,'{}'::uuid[]));
  UPDATE public.customer_bom_upload_items AS bi SET created_rfq_item_id=NULL,updated_at=now() WHERE bi.created_rfq_item_id IN (SELECT roi.rfq_item_id FROM public.rfq_order_items0 AS roi WHERE roi.rfq_id=v_rfq.rfq_id);
  UPDATE public.customer_bom_uploads AS cu SET rfq_id=NULL,status=CASE WHEN cu.status='rfq_created' THEN 'processed' ELSE cu.status END,updated_at=now() WHERE cu.rfq_id=v_rfq.rfq_id OR cu.id=v_bom_id;
  DELETE FROM public.procurement_supplier_allocations AS psa WHERE psa.rfq_id=v_rfq.rfq_id;
  DELETE FROM public.rfq_supplier_assignments AS rsa WHERE rsa.rfq_id=v_rfq.rfq_id;
  DELETE FROM public.supplier_quote_items0 AS sqi WHERE sqi.rfq_id=v_rfq.rfq_id;
  DELETE FROM public.supplier_quotes0 AS sq WHERE sq.rfq_id=v_rfq.rfq_id;
  DELETE FROM public.rfq_order_items0 AS roi WHERE roi.rfq_id=v_rfq.rfq_id;
  DELETE FROM public.rfq_orders0 AS ro WHERE ro.rfq_id=v_rfq.rfq_id;
  UPDATE public.procurement_chains AS pc SET source_rfq_id=NULL,current_stage=CASE WHEN v_bom_count>0 THEN 'bom_received' ELSE pc.current_stage END,current_stage_label=CASE WHEN v_bom_count>0 THEN 'BOM received' ELSE pc.current_stage_label END WHERE pc.id=v_rfq.procurement_chain_id;
  UPDATE public.procurement_progress AS pp SET rfq_id=NULL,current_stage=CASE WHEN v_bom_count>0 THEN 'bom_received' ELSE pp.current_stage END,current_stage_label=CASE WHEN v_bom_count>0 THEN 'BOM received' ELSE pp.current_stage_label END,status_note='RFQ removed by Admin; preserved supplier correspondence awaits RFQ creation.' WHERE pp.procurement_chain_id=v_rfq.procurement_chain_id;
  INSERT INTO public.admin_rfq_deletion_audit(rfq_id,procurement_chain_id,procurement_number,admin_user_id,source_bom_upload_id,came_from_bom,dependency_summary,action_type,deletion_reason) VALUES(v_rfq.rfq_id,v_rfq.procurement_chain_id,v_rfq.procurement_number,p_admin_user_id,v_bom_id,v_bom_count>0,v_dependencies,'deleted',trim(p_reason));
  RETURN QUERY SELECT v_rfq.rfq_id,v_rfq.procurement_chain_id,v_rfq.procurement_number,v_bom_id,true;
END $$;
REVOKE ALL ON FUNCTION public.delete_eligible_rfq_as_admin(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.delete_eligible_rfq_as_admin(uuid,uuid,text,text) TO service_role;
NOTIFY pgrst, 'reload schema';
