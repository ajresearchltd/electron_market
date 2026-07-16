-- Manual Supabase SQL Editor migration. Do not run automatically.
ALTER TABLE public.rfq_orders0 ADD COLUMN IF NOT EXISTS allow_all_suppliers boolean NOT NULL DEFAULT true;
UPDATE public.rfq_orders0 SET allow_all_suppliers=true WHERE allow_all_suppliers IS NULL;
CREATE OR REPLACE FUNCTION public.set_rfq_supplier_access(p_rfq_id uuid,p_admin_id uuid,p_allow_all boolean,p_supplier_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order text;v_id uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_profiles up WHERE up.id=p_admin_id AND up.role='admin') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Admin authorization required.';END IF;
 SELECT ro.order_number INTO v_order FROM public.rfq_orders0 ro WHERE ro.rfq_id=p_rfq_id FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='RFQ not found.';END IF;
 IF NOT p_allow_all AND coalesce(array_length(p_supplier_ids,1),0)=0 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Select at least one eligible supplier.';END IF;
 IF NOT p_allow_all AND EXISTS(SELECT 1 FROM unnest(p_supplier_ids) x(id) WHERE NOT EXISTS(SELECT 1 FROM public.supplier_company_profiles scp JOIN public.suppliers s ON s.source_profile_id=scp.profile_id WHERE scp.user_id=x.id AND s.verified_supplier=true AND s.supplier_status='active')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='One or more selected suppliers are not active and verified.';END IF;
 UPDATE public.rfq_orders0 ro SET allow_all_suppliers=p_allow_all,updated_at=now() WHERE ro.rfq_id=p_rfq_id;
 IF NOT p_allow_all THEN FOREACH v_id IN ARRAY p_supplier_ids LOOP INSERT INTO public.rfq_supplier_assignments(rfq_id,order_number,supplier_id,assignment_status,assigned_by_admin_id) VALUES(p_rfq_id,v_order,v_id,'assigned',p_admin_id) ON CONFLICT(rfq_id,supplier_id) DO UPDATE SET assignment_status='assigned',assigned_by_admin_id=p_admin_id,updated_at=now();END LOOP;END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_rfq_supplier_access(uuid,uuid,boolean,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_rfq_supplier_access(uuid,uuid,boolean,uuid[]) TO service_role;
NOTIFY pgrst,'reload schema';
