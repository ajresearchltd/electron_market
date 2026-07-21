-- Manual Supabase SQL Editor migration. Do not run automatically.
-- Versioned, Admin-only Product Finder business configuration. No credentials.
CREATE TABLE IF NOT EXISTS public.product_finder_ai_config_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), configuration_key text NOT NULL DEFAULT 'product_finder' CHECK(configuration_key='product_finder'),
  version_number integer NOT NULL CHECK(version_number>0), status text NOT NULL CHECK(status IN('draft','published','archived')),
  configuration jsonb NOT NULL, created_by uuid NOT NULL REFERENCES public.user_profiles(id), updated_by uuid NOT NULL REFERENCES public.user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz NULL,
  UNIQUE(configuration_key,version_number)
);
CREATE UNIQUE INDEX IF NOT EXISTS product_finder_ai_one_published_uidx ON public.product_finder_ai_config_versions(configuration_key) WHERE status='published';
CREATE UNIQUE INDEX IF NOT EXISTS product_finder_ai_one_draft_uidx ON public.product_finder_ai_config_versions(configuration_key) WHERE status='draft';
ALTER TABLE public.product_search_sessions ADD COLUMN IF NOT EXISTS product_finder_configuration_version_id uuid NULL REFERENCES public.product_finder_ai_config_versions(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS product_search_sessions_configuration_version_idx ON public.product_search_sessions(product_finder_configuration_version_id) WHERE product_finder_configuration_version_id IS NOT NULL;
ALTER TABLE public.product_finder_ai_config_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage Product Finder AI configuration" ON public.product_finder_ai_config_versions;
CREATE POLICY "Admins manage Product Finder AI configuration" ON public.product_finder_ai_config_versions FOR ALL TO authenticated USING(EXISTS(SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND p.role='admin')) WITH CHECK(EXISTS(SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND p.role='admin'));
REVOKE ALL ON public.product_finder_ai_config_versions FROM anon, authenticated;
GRANT SELECT,INSERT,UPDATE ON public.product_finder_ai_config_versions TO authenticated;
REVOKE SELECT,INSERT,UPDATE ON public.product_search_sessions FROM authenticated;
GRANT SELECT (id,reference_number,owner_user_id,title,state,intent,customer_progress,selected_candidate_id,preliminary_order_id,bom_upload_id,rfq_id,turn_count,tool_call_count,created_at,updated_at) ON public.product_search_sessions TO authenticated;
GRANT INSERT (owner_user_id,title,state,intent,customer_progress,selected_candidate_id,preliminary_order_id,bom_upload_id,rfq_id,turn_count,tool_call_count,created_at,updated_at) ON public.product_search_sessions TO authenticated;
GRANT UPDATE (title,state,intent,customer_progress,selected_candidate_id,preliminary_order_id,bom_upload_id,rfq_id,turn_count,tool_call_count,updated_at) ON public.product_search_sessions TO authenticated;
CREATE OR REPLACE FUNCTION public.publish_product_finder_ai_configuration(p_draft_id uuid) RETURNS public.product_finder_ai_config_versions LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$ DECLARE v_actor uuid:=auth.uid();v_row public.product_finder_ai_config_versions; BEGIN IF NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=v_actor AND role='admin') THEN RAISE EXCEPTION 'Admin access required';END IF; SELECT * INTO v_row FROM public.product_finder_ai_config_versions WHERE id=p_draft_id AND status='draft' FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Draft not found';END IF;UPDATE public.product_finder_ai_config_versions SET status='archived',updated_at=now(),updated_by=v_actor WHERE configuration_key='product_finder' AND status='published';UPDATE public.product_finder_ai_config_versions SET status='published',published_at=now(),updated_at=now(),updated_by=v_actor WHERE id=p_draft_id RETURNING * INTO v_row;RETURN v_row;END $$;
REVOKE ALL ON FUNCTION public.publish_product_finder_ai_configuration(uuid) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.publish_product_finder_ai_configuration(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
