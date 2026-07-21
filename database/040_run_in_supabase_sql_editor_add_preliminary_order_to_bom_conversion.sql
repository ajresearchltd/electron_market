-- Manual Supabase SQL Editor migration. Do not execute automatically.
-- Canonical, atomic Preliminary Order -> BOM List conversion only.

ALTER TABLE public.public_sourcing_enquiries
  ADD COLUMN IF NOT EXISTS converted_at timestamptz,
  ADD COLUMN IF NOT EXISTS converted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_procurement_chain_id uuid REFERENCES public.procurement_chains(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS converted_bom_upload_id uuid REFERENCES public.customer_bom_uploads(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS public_sourcing_enquiries_converted_bom_uidx
  ON public.public_sourcing_enquiries(converted_bom_upload_id)
  WHERE converted_bom_upload_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.convert_preliminary_order_to_bom(
  p_preliminary_order_id uuid,
  p_actor_id uuid,
  p_source_revision timestamptz,
  p_draft jsonb
)
RETURNS TABLE(bom_upload_id uuid,procurement_chain_id uuid,procurement_number text,bom_filename text,position_count integer,created boolean,created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_source public.public_sourcing_enquiries%ROWTYPE;v_role text;v_profile record;v_company record;v_chain_id uuid;v_number text;v_bom_id uuid;v_count integer;v_created_at timestamptz;v_item jsonb;v_filename text;
BEGIN
  SELECT role INTO v_role FROM public.user_profiles WHERE id=p_actor_id;
  IF coalesce(v_role,'') NOT IN ('admin','support') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Admin or Support authorization is required.';END IF;
  SELECT * INTO v_source FROM public.public_sourcing_enquiries WHERE id=p_preliminary_order_id FOR UPDATE;
  IF NOT FOUND OR v_source.customer_user_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Preliminary Order not found.';END IF;
  IF v_source.converted_bom_upload_id IS NOT NULL THEN
    RETURN QUERY SELECT cu.id,cu.procurement_chain_id,cu.procurement_number,cu.original_file_name,cu.total_rows,false,cu.created_at FROM public.customer_bom_uploads cu WHERE cu.id=v_source.converted_bom_upload_id;RETURN;
  END IF;
  IF v_source.updated_at IS DISTINCT FROM p_source_revision THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='This Preliminary Order changed after the review form was opened. Reload the current information before converting.';END IF;
  SELECT id,email,full_name,company_name INTO v_profile FROM public.user_profiles WHERE id=v_source.customer_user_id;
  SELECT company_name,country_iso2,country_name,contact_name,contact_email,contact_phone,phone,business_registration_number,registration_number INTO v_company FROM public.customer_company_profiles WHERE user_id=v_source.customer_user_id;
  IF v_profile.id IS NULL OR nullif(btrim(coalesce(v_profile.full_name,'')),'') IS NULL OR nullif(btrim(coalesce(v_company.company_name,'')),'') IS NULL OR coalesce(v_company.country_iso2,v_company.country_name) IS NULL OR coalesce(v_company.contact_phone,v_company.phone) IS NULL OR coalesce(v_company.business_registration_number,v_company.registration_number) IS NULL OR nullif(btrim(coalesce(v_source.contact_email,v_profile.email,v_company.contact_email,'')),'') IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Customer profile information is incomplete.';END IF;
  IF jsonb_typeof(p_draft->'items')<>'array' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Select at least one product position.';END IF;
  SELECT count(*)::integer INTO v_count FROM jsonb_array_elements(p_draft->'items') x WHERE coalesce((x->>'include')::boolean,true);
  IF v_count<1 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Select at least one product position.';END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_draft->'items') LOOP
    IF coalesce((v_item->>'include')::boolean,true) AND nullif(btrim(coalesce(v_item->>'part_number',v_item->>'product_name','')),'') IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Enter a Part Number or a clearly identifying Product Name.';END IF;
    IF coalesce((v_item->>'include')::boolean,true) AND coalesce((v_item->>'quantity')::numeric,0)<=0 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Requested Quantity must be greater than zero.';END IF;
  END LOOP;
  INSERT INTO public.procurement_chains(customer_user_id,admin_user_id,customer_company_name,document_name,customer_reference,source_type,source_record_id,current_stage,current_stage_label,status,metadata)
  VALUES(v_source.customer_user_id,p_actor_id,v_company.company_name,coalesce(nullif(p_draft->>'project_name',''),'Preliminary Order BOM'),nullif(p_draft->>'customer_reference',''),'preliminary_order',v_source.id,'bom_received','BOM received','active',jsonb_build_object('preliminary_order_id',v_source.id)) RETURNING id,procurement_number INTO v_chain_id,v_number;
  v_filename:=v_number||'_BOM.xlsx';
  INSERT INTO public.customer_bom_uploads(user_id,customer_profile_id,document_name,customer_company_name,contact_person,contact_email,contact_phone,project_name,project_description,destination_country,required_delivery_date,target_budget,budget_currency,preferred_incoterms,preferred_origin_country,original_file_name,file_type,total_rows,valid_rows,warning_rows,error_rows,status,ai_processing_status,notes,preliminary_order_id,procurement_chain_id,procurement_case_id,procurement_number)
  VALUES(v_source.customer_user_id,v_source.customer_user_id,coalesce(nullif(p_draft->>'project_name',''),v_filename),v_company.company_name,coalesce(v_company.contact_name,v_profile.full_name),coalesce(v_source.contact_email,v_profile.email,v_company.contact_email),coalesce(v_company.contact_phone,v_company.phone),nullif(p_draft->>'project_name',''),nullif(p_draft->>'project_description',''),nullif(p_draft->>'destination_country',''),nullif(p_draft->>'required_delivery_date','')::date,nullif(p_draft->>'target_budget','')::numeric,coalesce(nullif(upper(p_draft->>'budget_currency'),''),'USD'),nullif(p_draft->>'preferred_incoterms',''),nullif(p_draft->>'preferred_origin_country',''),v_filename,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',v_count,v_count,0,0,'normalized','completed',nullif(p_draft->>'notes',''),v_source.id,v_chain_id,v_chain_id,v_number) RETURNING id,created_at INTO v_bom_id,v_created_at;
  INSERT INTO public.customer_bom_upload_items(upload_id,user_id,row_number,part_number,normalized_part_number,manufacturer,manufacturer_part_number,product_name,description,specification,package_case,quantity,unit,target_unit_price,target_currency,notes,customer_comment,validation_status,validation_errors,validation_warnings,import_status,raw_row_json,procurement_chain_id,procurement_case_id,procurement_number)
  SELECT v_bom_id,v_source.customer_user_id,row_number()over(),nullif(btrim(x->>'part_number'),''),nullif(btrim(x->>'part_number'),''),nullif(btrim(x->>'manufacturer'),''),nullif(btrim(x->>'part_number'),''),nullif(btrim(x->>'product_name'),''),nullif(btrim(x->>'description'),''),nullif(btrim(x->>'technical_requirements'),''),nullif(btrim(x->>'package'),''),(x->>'quantity')::numeric,coalesce(nullif(btrim(x->>'unit'),''),'pcs'),nullif(x->>'target_unit_price','')::numeric,coalesce(nullif(upper(x->>'currency'),''),coalesce(nullif(upper(p_draft->>'budget_currency'),''),'USD')),nullif(btrim(x->>'notes'),''),nullif(btrim(x->>'customer_notes'),''),'valid','[]'::jsonb,'[]'::jsonb,'imported',x,v_chain_id,v_chain_id,v_number FROM jsonb_array_elements(p_draft->'items')x WHERE coalesce((x->>'include')::boolean,true);
  UPDATE public.procurement_chains SET source_bom_upload_id=v_bom_id,updated_at=now() WHERE id=v_chain_id;
  INSERT INTO public.procurement_progress(customer_user_id,customer_bom_upload_id,procurement_chain_id,procurement_case_id,procurement_number,document_name,customer_company_name,current_stage,current_stage_label,status_note,bom_received_at,metadata)
  VALUES(v_source.customer_user_id,v_bom_id,v_chain_id,v_chain_id,v_number,v_filename,v_company.company_name,'bom_received','BOM received','BOM List created from Preliminary Order.',now(),jsonb_build_object('source','preliminary_order','preliminary_order_id',v_source.id));
  UPDATE public.public_sourcing_enquiries SET status='converted',converted_at=now(),converted_by=p_actor_id,converted_procurement_chain_id=v_chain_id,converted_bom_upload_id=v_bom_id,updated_at=now() WHERE id=v_source.id;
  RETURN QUERY SELECT v_bom_id,v_chain_id,v_number,v_filename,v_count,true,v_created_at;
END$$;
REVOKE ALL ON FUNCTION public.convert_preliminary_order_to_bom(uuid,uuid,timestamptz,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.convert_preliminary_order_to_bom(uuid,uuid,timestamptz,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
