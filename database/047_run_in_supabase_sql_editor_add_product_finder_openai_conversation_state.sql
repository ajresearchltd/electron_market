-- Manual Supabase SQL Editor migration. Do not run automatically.
-- Phase 10 correction: one durable OpenAI conversation and persistent turn
-- idempotency state per existing Product Finder session. No new table is added.

ALTER TABLE public.product_search_sessions
  ADD COLUMN IF NOT EXISTS openai_conversation_id text NULL,
  ADD COLUMN IF NOT EXISTS openai_conversation_created_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS openai_last_response_id text NULL,
  ADD COLUMN IF NOT EXISTS openai_last_response_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS openai_last_response_status text NULL,
  ADD COLUMN IF NOT EXISTS openai_failure_code text NULL,
  ADD COLUMN IF NOT EXISTS openai_initialization_token uuid NULL,
  ADD COLUMN IF NOT EXISTS initial_client_turn_id uuid NULL,
  ADD COLUMN IF NOT EXISTS active_client_turn_id uuid NULL,
  ADD COLUMN IF NOT EXISTS active_turn_started_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS last_client_turn_id uuid NULL,
  ADD COLUMN IF NOT EXISTS last_turn_response jsonb NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_search_sessions_openai_conversation_uidx
  ON public.product_search_sessions(openai_conversation_id)
  WHERE openai_conversation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_search_sessions_owner_initial_turn_uidx
  ON public.product_search_sessions(owner_user_id, initial_client_turn_id)
  WHERE initial_client_turn_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_search_events_assistant_turn_uidx
  ON public.product_search_events(session_id, ((safe_payload ->> 'clientTurnId')))
  WHERE event_type = 'finder_assistant_message' AND safe_payload ? 'clientTurnId';

CREATE UNIQUE INDEX IF NOT EXISTS product_search_events_user_turn_uidx
  ON public.product_search_events(session_id, ((safe_payload ->> 'clientTurnId')))
  WHERE event_type = 'finder_user_message' AND safe_payload ? 'clientTurnId';

COMMENT ON COLUMN public.product_search_sessions.openai_conversation_id IS
  'Server-managed OpenAI Conversations API ID. Never accepted from or returned to ordinary browser clients.';
COMMENT ON COLUMN public.product_search_sessions.openai_last_response_id IS
  'Diagnostic Responses API ID only; it is not conversation state.';

-- RLS filters rows, while column privileges prevent ordinary authenticated
-- clients from reading or writing server-managed OpenAI and turn-lock fields.
REVOKE SELECT, INSERT, UPDATE ON public.product_search_sessions FROM authenticated;
GRANT SELECT (
  id, reference_number, owner_user_id, title, state, intent, customer_progress,
  selected_candidate_id, preliminary_order_id, bom_upload_id, rfq_id,
  turn_count, tool_call_count, created_at, updated_at
) ON public.product_search_sessions TO authenticated;
GRANT INSERT (
  owner_user_id, title, state, intent, customer_progress, selected_candidate_id,
  preliminary_order_id, bom_upload_id, rfq_id, turn_count, tool_call_count,
  created_at, updated_at
) ON public.product_search_sessions TO authenticated;
GRANT UPDATE (
  title, state, intent, customer_progress, selected_candidate_id,
  preliminary_order_id, bom_upload_id, rfq_id, turn_count, tool_call_count,
  updated_at
) ON public.product_search_sessions TO authenticated;

NOTIFY pgrst, 'reload schema';
