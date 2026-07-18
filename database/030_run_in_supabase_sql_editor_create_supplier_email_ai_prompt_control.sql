-- Manual Supabase SQL Editor migration. Do not run automatically.
-- Adds stable message-level supplier response keys and versioned supplier-email AI configuration.

ALTER TABLE public.supplier_responses ADD COLUMN IF NOT EXISTS response_key text;
UPDATE public.supplier_responses AS sr SET response_key = 'email:' || sr.source_message_id::text WHERE sr.response_key IS NULL;
ALTER TABLE public.supplier_responses ALTER COLUMN response_key SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.supplier_responses'::regclass AND conname='supplier_responses_procurement_chain_id_supplier_id_respons_key') THEN
    ALTER TABLE public.supplier_responses ADD CONSTRAINT supplier_responses_procurement_chain_id_supplier_id_respons_key UNIQUE(procurement_chain_id,supplier_id,response_key);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.supplier_email_ai_prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_key text NOT NULL DEFAULT 'supplier_email_processing' CHECK(configuration_key='supplier_email_processing'),
  version_number integer NOT NULL,
  status text NOT NULL CHECK(status IN ('draft','active','archived')),
  extraction_system_prompt text NOT NULL,
  extraction_user_template text NOT NULL,
  extraction_model text NOT NULL,
  extraction_max_output_tokens integer NULL CHECK(extraction_max_output_tokens IS NULL OR extraction_max_output_tokens>0),
  extraction_timeout_ms integer NOT NULL DEFAULT 60000 CHECK(extraction_timeout_ms BETWEEN 1000 AND 180000),
  extraction_retry_count integer NOT NULL DEFAULT 1 CHECK(extraction_retry_count BETWEEN 0 AND 2),
  extraction_enabled boolean NOT NULL DEFAULT true,
  deterministic_fallback_enabled boolean NOT NULL DEFAULT true,
  semantic_system_prompt text NOT NULL,
  semantic_user_template text NOT NULL,
  semantic_model text NOT NULL,
  semantic_max_output_tokens integer NULL CHECK(semantic_max_output_tokens IS NULL OR semantic_max_output_tokens>0),
  semantic_timeout_ms integer NOT NULL DEFAULT 60000 CHECK(semantic_timeout_ms BETWEEN 1000 AND 180000),
  semantic_retry_count integer NOT NULL DEFAULT 1 CHECK(semantic_retry_count BETWEEN 0 AND 2),
  semantic_auto_match_threshold numeric NOT NULL DEFAULT .9 CHECK(semantic_auto_match_threshold BETWEEN 0 AND 1),
  semantic_review_threshold numeric NOT NULL DEFAULT .6 CHECK(semantic_review_threshold BETWEEN 0 AND 1),
  semantic_enabled boolean NOT NULL DEFAULT true,
  nexar_enabled boolean NOT NULL DEFAULT true,
  nexar_timeout_ms integer NOT NULL DEFAULT 8000 CHECK(nexar_timeout_ms BETWEEN 1000 AND 60000),
  nexar_retry_count integer NOT NULL DEFAULT 1 CHECK(nexar_retry_count BETWEEN 0 AND 2),
  nexar_use_aliases boolean NOT NULL DEFAULT true,
  nexar_use_technical_specs boolean NOT NULL DEFAULT true,
  nexar_skip_exact_matches boolean NOT NULL DEFAULT true CHECK(nexar_skip_exact_matches=true),
  schema_version text NOT NULL DEFAULT 'supplier-email-v1',
  change_note text NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz NULL,
  UNIQUE(configuration_key,version_number)
);
CREATE UNIQUE INDEX IF NOT EXISTS supplier_email_ai_prompt_one_active_idx ON public.supplier_email_ai_prompt_versions(configuration_key) WHERE status='active';
ALTER TABLE public.supplier_email_ai_prompt_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supplier_email_ai_prompt_versions FROM anon,authenticated;
CREATE OR REPLACE FUNCTION public.activate_supplier_email_ai_prompt_version(p_version_id uuid,p_admin_id uuid)
RETURNS public.supplier_email_ai_prompt_versions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_row public.supplier_email_ai_prompt_versions%ROWTYPE;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.user_profiles AS up WHERE up.id=p_admin_id AND up.role='admin') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Admin authorization required.';END IF;
  SELECT * INTO v_row FROM public.supplier_email_ai_prompt_versions AS pv WHERE pv.id=p_version_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Prompt version not found.';END IF;
  UPDATE public.supplier_email_ai_prompt_versions AS pv SET status='archived',updated_at=now(),updated_by=p_admin_id WHERE pv.configuration_key=v_row.configuration_key AND pv.status='active' AND pv.id<>v_row.id;
  UPDATE public.supplier_email_ai_prompt_versions AS pv SET status='active',activated_at=now(),updated_at=now(),updated_by=p_admin_id WHERE pv.id=v_row.id RETURNING * INTO v_row;
  RETURN v_row;
END $$;
REVOKE ALL ON FUNCTION public.activate_supplier_email_ai_prompt_version(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.activate_supplier_email_ai_prompt_version(uuid,uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
