-- Manual Supabase SQL Editor migration. Do not run automatically.
-- Adds idempotent supplier part-identification clarification state.

ALTER TABLE public.supplier_email_ai_prompt_versions
  ADD COLUMN IF NOT EXISTS clarification_system_prompt text NULL,
  ADD COLUMN IF NOT EXISTS clarification_user_template text NULL,
  ADD COLUMN IF NOT EXISTS clarification_model text NULL,
  ADD COLUMN IF NOT EXISTS clarification_max_output_tokens integer NULL,
  ADD COLUMN IF NOT EXISTS clarification_timeout_ms integer NOT NULL DEFAULT 60000,
  ADD COLUMN IF NOT EXISTS clarification_retry_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS clarification_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS clarification_automatic_send boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS supplier_confirmation_required boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.supplier_part_clarifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_response_item_id uuid NOT NULL REFERENCES public.supplier_response_items(id) ON DELETE CASCADE,
  candidate_rfq_item_id uuid NOT NULL REFERENCES public.rfq_order_items0(rfq_item_id) ON DELETE RESTRICT,
  clarification_version integer NOT NULL DEFAULT 1 CHECK(clarification_version>0),
  clarification_token text NOT NULL UNIQUE,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL CHECK(status IN ('clarification_not_required','clarification_draft','clarification_pending_send','clarification_sent','supplier_confirmation_pending','supplier_confirmed','supplier_rejected','supplier_reply_ambiguous','clarification_delivery_failed','clarification_cancelled')),
  original_supplier_part_number text NULL,
  candidate_part_number text NULL,
  candidate_manufacturer text NULL,
  recipient_email text NOT NULL,
  outbound_subject text NULL,
  outbound_body text NULL,
  outbound_message_id text NULL,
  sent_at timestamptz NULL,
  reply_inbound_email_id uuid NULL REFERENCES public.supplier_inbound_messages(id) ON DELETE SET NULL,
  reply_decision text NULL CHECK(reply_decision IS NULL OR reply_decision IN ('confirmed','rejected','ambiguous')),
  reply_at timestamptz NULL,
  corrected_part_number text NULL,
  corrected_manufacturer text NULL,
  confidence numeric NULL CHECK(confidence IS NULL OR confidence BETWEEN 0 AND 1),
  explanation text NULL,
  prompt_version_id uuid NULL REFERENCES public.supplier_email_ai_prompt_versions(id) ON DELETE SET NULL,
  safe_error text NULL,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(supplier_response_item_id,candidate_rfq_item_id,clarification_version)
);
CREATE INDEX IF NOT EXISTS supplier_part_clarifications_item_idx ON public.supplier_part_clarifications(supplier_response_item_id,status);
ALTER TABLE public.supplier_part_clarifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supplier_part_clarifications FROM anon,authenticated;
NOTIFY pgrst,'reload schema';
