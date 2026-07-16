-- Run manually in Supabase SQL Editor after the canonical procurement-chain migrations.
-- Electron Market - private inbound supplier email, validated responses, review, and coverage.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_supplier_email_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE IF NOT EXISTS public.supplier_inbound_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procurement_chain_id uuid NULL REFERENCES public.procurement_chains(id) ON DELETE SET NULL,
  rfq_id uuid NULL,
  supplier_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  provider text NULL,
  provider_message_id text NULL,
  internet_message_id text NULL,
  in_reply_to_message_id text NULL,
  thread_reference text NULL,
  sender_email text NULL,
  recipient_email text NULL,
  subject text NULL,
  body_text text NULL,
  body_html text NULL,
  detected_procurement_number text NULL,
  procurement_identification_method text NULL,
  procurement_identification_confidence numeric NULL CHECK (procurement_identification_confidence BETWEEN 0 AND 1),
  rfq_identification_method text NULL,
  rfq_identification_confidence numeric NULL CHECK (rfq_identification_confidence BETWEEN 0 AND 1),
  supplier_identification_method text NULL,
  supplier_identification_confidence numeric NULL CHECK (supplier_identification_confidence BETWEEN 0 AND 1),
  received_at timestamptz NOT NULL,
  processing_status text NOT NULL DEFAULT 'received' CHECK (processing_status IN ('received','identifying','identified','queued','processing','parsed','needs_review','failed','duplicate','ignored')),
  processing_attempts integer NOT NULL DEFAULT 0 CHECK (processing_attempts >= 0),
  processing_error text NULL,
  raw_email_storage_path text NULL,
  content_hash text NOT NULL,
  locked_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS supplier_inbound_provider_message_unique ON public.supplier_inbound_messages(provider, provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS supplier_inbound_internet_message_unique ON public.supplier_inbound_messages(internet_message_id) WHERE internet_message_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS supplier_inbound_content_hash_unique ON public.supplier_inbound_messages(content_hash);
CREATE INDEX IF NOT EXISTS supplier_inbound_queue_idx ON public.supplier_inbound_messages(processing_status, received_at);
CREATE INDEX IF NOT EXISTS supplier_inbound_chain_idx ON public.supplier_inbound_messages(procurement_chain_id);

CREATE OR REPLACE FUNCTION public.claim_supplier_inbound_messages(batch_size integer DEFAULT 5)
RETURNS SETOF public.supplier_inbound_messages
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT id FROM public.supplier_inbound_messages
    WHERE processing_status IN ('received','queued','failed')
      AND processing_attempts < 5
      AND (locked_at IS NULL OR locked_at < now() - interval '15 minutes')
    ORDER BY received_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(batch_size,1),20)
  )
  UPDATE public.supplier_inbound_messages message
  SET processing_status='processing', locked_at=now(), processing_attempts=message.processing_attempts+1, processing_error=NULL
  FROM candidates WHERE message.id=candidates.id RETURNING message.*;
END $$;
REVOKE ALL ON FUNCTION public.claim_supplier_inbound_messages(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_supplier_inbound_messages(integer) TO service_role;

CREATE TABLE IF NOT EXISTS public.supplier_message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.supplier_inbound_messages(id) ON DELETE CASCADE,
  procurement_chain_id uuid NULL REFERENCES public.procurement_chains(id) ON DELETE SET NULL,
  supplier_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  original_file_name text NOT NULL,
  sanitized_display_name text NULL,
  storage_path text NOT NULL,
  mime_type text NULL,
  file_size_bytes bigint NULL CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  content_hash text NULL,
  attachment_type text NULL,
  extraction_status text NOT NULL DEFAULT 'pending' CHECK (extraction_status IN ('pending','processing','extracted','needs_review','failed','unsupported')),
  extracted_text text NULL,
  extracted_table_json jsonb NULL,
  extraction_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, content_hash)
);

CREATE TABLE IF NOT EXISTS public.supplier_message_parse_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.supplier_inbound_messages(id) ON DELETE CASCADE,
  procurement_chain_id uuid NULL REFERENCES public.procurement_chains(id) ON DELETE SET NULL,
  rfq_id uuid NULL,
  supplier_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  parser_version text NULL,
  model_name text NULL,
  status text NOT NULL CHECK (status IN ('started','parsed','validated','needs_review','failed')),
  extracted_payload jsonb NULL,
  validated_payload jsonb NULL,
  extraction_confidence numeric NULL CHECK (extraction_confidence BETWEEN 0 AND 1),
  validation_error text NULL,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supplier_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procurement_chain_id uuid NOT NULL REFERENCES public.procurement_chains(id) ON DELETE CASCADE,
  rfq_id uuid NULL,
  supplier_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  source_message_id uuid NOT NULL UNIQUE REFERENCES public.supplier_inbound_messages(id) ON DELETE RESTRICT,
  parse_run_id uuid NULL REFERENCES public.supplier_message_parse_runs(id) ON DELETE SET NULL,
  response_type text NOT NULL CHECK (response_type IN ('full_offer','partial_offer','availability_only','clarification','decline','amendment','replacement','other')),
  response_relationship text NOT NULL CHECK (response_relationship IN ('new','replacement','amendment','clarification','unknown')),
  response_revision integer NOT NULL DEFAULT 1 CHECK (response_revision > 0),
  supersedes_response_id uuid NULL REFERENCES public.supplier_responses(id) ON DELETE SET NULL,
  is_current boolean NOT NULL DEFAULT true,
  status text NOT NULL CHECK (status IN ('parsed_unvalidated','needs_review','validated','superseded','rejected')),
  default_currency text NULL,
  quote_valid_until_raw text NULL,
  quote_valid_until date NULL,
  remaining_items_status text NOT NULL DEFAULT 'unknown' CHECK (remaining_items_status IN ('explicitly_unavailable','not_mentioned','unknown')),
  explicitly_offered_item_count integer NOT NULL DEFAULT 0,
  partial_item_count integer NOT NULL DEFAULT 0,
  explicitly_unavailable_item_count integer NOT NULL DEFAULT 0,
  review_item_count integer NOT NULL DEFAULT 0,
  overall_parse_confidence numeric NULL CHECK (overall_parse_confidence BETWEEN 0 AND 1),
  needs_review boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(procurement_chain_id, supplier_id, response_revision)
);
CREATE UNIQUE INDEX IF NOT EXISTS supplier_responses_one_current_idx ON public.supplier_responses(procurement_chain_id, supplier_id) WHERE is_current;

CREATE TABLE IF NOT EXISTS public.supplier_response_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_response_id uuid NOT NULL REFERENCES public.supplier_responses(id) ON DELETE CASCADE,
  source_message_id uuid NOT NULL REFERENCES public.supplier_inbound_messages(id) ON DELETE RESTRICT,
  parse_run_id uuid NULL REFERENCES public.supplier_message_parse_runs(id) ON DELETE SET NULL,
  procurement_chain_id uuid NOT NULL REFERENCES public.procurement_chains(id) ON DELETE CASCADE,
  rfq_id uuid NULL,
  rfq_item_id uuid NULL,
  bom_upload_id uuid NULL REFERENCES public.customer_bom_uploads(id) ON DELETE SET NULL,
  bom_item_id uuid NULL REFERENCES public.customer_bom_upload_items(id) ON DELETE SET NULL,
  supplier_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  source_attachment_id uuid NULL REFERENCES public.supplier_message_attachments(id) ON DELETE SET NULL,
  source_sheet_name text NULL,
  source_row_number integer NULL,
  source_page_number integer NULL,
  source_text text NULL,
  requested_mpn text NULL,
  requested_manufacturer text NULL,
  requested_quantity numeric NULL,
  response_status text NOT NULL CHECK (response_status IN ('offered','partial_quantity','unavailable','alternative_proposed','clarification_required','rejected')),
  offered_mpn text NULL,
  offered_manufacturer text NULL,
  offered_quantity_raw text NULL,
  offered_quantity numeric NULL CHECK (offered_quantity IS NULL OR offered_quantity >= 0),
  available_quantity_raw text NULL,
  available_quantity numeric NULL CHECK (available_quantity IS NULL OR available_quantity >= 0),
  price_raw text NULL,
  price_amount numeric NULL CHECK (price_amount IS NULL OR price_amount >= 0),
  price_basis_quantity numeric NULL CHECK (price_basis_quantity IS NULL OR price_basis_quantity > 0),
  price_basis_unit text NULL,
  package_quantity numeric NULL CHECK (package_quantity IS NULL OR package_quantity > 0),
  calculated_unit_price numeric NULL CHECK (calculated_unit_price IS NULL OR calculated_unit_price >= 0),
  currency text NULL,
  price_breaks jsonb NULL,
  moq_raw text NULL,
  moq numeric NULL CHECK (moq IS NULL OR moq >= 0),
  lead_time_raw text NULL,
  lead_time_value numeric NULL CHECK (lead_time_value IS NULL OR lead_time_value >= 0),
  lead_time_unit text NULL CHECK (lead_time_unit IS NULL OR lead_time_unit IN ('days','business_days','weeks','months','unknown')),
  lead_time_days integer NULL CHECK (lead_time_days IS NULL OR lead_time_days >= 0),
  stock_confirmed boolean NULL,
  date_code_raw text NULL,
  date_code_normalized text NULL,
  condition text NULL CHECK (condition IS NULL OR condition IN ('new','used','refurbished','unknown')),
  certificate_available boolean NULL,
  traceability_available boolean NULL,
  supplier_note_private text NULL,
  customer_visible_summary text NULL,
  extraction_confidence numeric NULL CHECK (extraction_confidence BETWEEN 0 AND 1),
  matching_confidence numeric NULL CHECK (matching_confidence BETWEEN 0 AND 1),
  match_method text NULL,
  normalization_status text NULL CHECK (normalization_status IS NULL OR normalization_status IN ('validated','needs_review','invalid')),
  review_status text NOT NULL DEFAULT 'not_required' CHECK (review_status IN ('not_required','pending','resolved','rejected')),
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_message_id, source_attachment_id, source_sheet_name, source_row_number)
);
CREATE INDEX IF NOT EXISTS supplier_response_items_current_chain_idx ON public.supplier_response_items(procurement_chain_id, is_current, bom_item_id);

CREATE TABLE IF NOT EXISTS public.supplier_response_match_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procurement_chain_id uuid NULL REFERENCES public.procurement_chains(id) ON DELETE CASCADE,
  message_id uuid NULL REFERENCES public.supplier_inbound_messages(id) ON DELETE CASCADE,
  supplier_response_id uuid NULL REFERENCES public.supplier_responses(id) ON DELETE CASCADE,
  supplier_response_item_id uuid NULL REFERENCES public.supplier_response_items(id) ON DELETE CASCADE,
  review_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved','rejected','cancelled')),
  candidate_bom_item_ids uuid[] NULL,
  candidate_rfq_item_ids uuid[] NULL,
  candidate_supplier_ids uuid[] NULL,
  candidate_rfq_ids uuid[] NULL,
  suggested_bom_item_id uuid NULL,
  suggested_rfq_item_id uuid NULL,
  suggested_supplier_id uuid NULL,
  reason text NOT NULL,
  extraction_confidence numeric NULL,
  matching_confidence numeric NULL,
  reviewed_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz NULL,
  resolution_note text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS supplier_response_reviews_queue_idx ON public.supplier_response_match_reviews(status, created_at);

CREATE TABLE IF NOT EXISTS public.procurement_item_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procurement_chain_id uuid NOT NULL REFERENCES public.procurement_chains(id) ON DELETE CASCADE,
  bom_item_id uuid NOT NULL REFERENCES public.customer_bom_upload_items(id) ON DELETE CASCADE,
  supplier_response_item_id uuid NULL REFERENCES public.supplier_response_items(id) ON DELETE SET NULL,
  decision_type text NOT NULL CHECK (decision_type IN ('approve_alternative','reject_alternative','approve_partial_quantity','reject_partial_quantity','approve_split_delivery','approve_condition','request_clarification')),
  decision_status text NOT NULL DEFAULT 'pending' CHECK (decision_status IN ('pending','approved','rejected','cancelled')),
  previous_value jsonb NULL,
  proposed_value jsonb NULL,
  decision_reason text NULL,
  decided_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  decided_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.procurement_supplier_coverage (
  procurement_chain_id uuid PRIMARY KEY REFERENCES public.procurement_chains(id) ON DELETE CASCADE,
  suppliers_invited integer NOT NULL DEFAULT 0,
  suppliers_responded integer NOT NULL DEFAULT 0,
  suppliers_pending integer NOT NULL DEFAULT 0,
  suppliers_declined integer NOT NULL DEFAULT 0,
  total_bom_lines integer NOT NULL DEFAULT 0,
  offered_lines integer NOT NULL DEFAULT 0,
  fully_covered_lines integer NOT NULL DEFAULT 0,
  partially_covered_lines integer NOT NULL DEFAULT 0,
  uncovered_lines integer NOT NULL DEFAULT 0,
  explicitly_unavailable_lines integer NOT NULL DEFAULT 0,
  not_mentioned_lines integer NOT NULL DEFAULT 0,
  alternatives_pending_approval integer NOT NULL DEFAULT 0,
  review_required_lines integer NOT NULL DEFAULT 0,
  requested_quantity numeric NOT NULL DEFAULT 0,
  valid_offered_quantity numeric NOT NULL DEFAULT 0,
  minimum_unit_price numeric NULL,
  shortest_lead_time_days integer NULL,
  certificate_coverage_count integer NOT NULL DEFAULT 0,
  traceability_coverage_count integer NOT NULL DEFAULT 0,
  bom_fill_rate numeric NOT NULL DEFAULT 0,
  comparison_ready boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['supplier_inbound_messages','supplier_message_attachments','supplier_message_parse_runs','supplier_responses','supplier_response_items','supplier_response_match_reviews','procurement_item_decisions','procurement_supplier_coverage']
  LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t); END LOOP;
END $$;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['supplier_inbound_messages','supplier_message_attachments','supplier_message_parse_runs','supplier_responses','supplier_response_items','supplier_response_match_reviews','procurement_item_decisions','procurement_supplier_coverage']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admins and support manage %s" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "Admins and support manage %s" ON public.%I FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND p.role IN (''admin'',''support''))) WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND p.role IN (''admin'',''support'')))', t, t);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS supplier_inbound_messages_updated_at ON public.supplier_inbound_messages;
CREATE TRIGGER supplier_inbound_messages_updated_at BEFORE UPDATE ON public.supplier_inbound_messages FOR EACH ROW EXECUTE FUNCTION public.set_supplier_email_updated_at();
DROP TRIGGER IF EXISTS supplier_responses_updated_at ON public.supplier_responses;
CREATE TRIGGER supplier_responses_updated_at BEFORE UPDATE ON public.supplier_responses FOR EACH ROW EXECUTE FUNCTION public.set_supplier_email_updated_at();
DROP TRIGGER IF EXISTS supplier_response_items_updated_at ON public.supplier_response_items;
CREATE TRIGGER supplier_response_items_updated_at BEFORE UPDATE ON public.supplier_response_items FOR EACH ROW EXECUTE FUNCTION public.set_supplier_email_updated_at();
DROP TRIGGER IF EXISTS procurement_item_decisions_updated_at ON public.procurement_item_decisions;
CREATE TRIGGER procurement_item_decisions_updated_at BEFORE UPDATE ON public.procurement_item_decisions FOR EACH ROW EXECUTE FUNCTION public.set_supplier_email_updated_at();

INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('supplier-inbound-emails','supplier-inbound-emails',false,26214400,ARRAY['message/rfc822','text/plain']::text[])
ON CONFLICT (id) DO UPDATE SET public=false;
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('supplier-email-attachments','supplier-email-attachments',false,26214400,ARRAY['application/pdf','text/csv','text/plain','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','message/rfc822']::text[])
ON CONFLICT (id) DO UPDATE SET public=false;

DROP POLICY IF EXISTS "Admins and support access supplier inbound email objects" ON storage.objects;
CREATE POLICY "Admins and support access supplier inbound email objects" ON storage.objects FOR ALL TO authenticated
USING (bucket_id IN ('supplier-inbound-emails','supplier-email-attachments') AND EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND p.role IN ('admin','support')))
WITH CHECK (bucket_id IN ('supplier-inbound-emails','supplier-email-attachments') AND EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND p.role IN ('admin','support')));

NOTIFY pgrst, 'reload schema';
