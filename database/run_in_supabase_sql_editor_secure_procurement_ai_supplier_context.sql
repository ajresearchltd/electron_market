-- Run manually in Supabase SQL Editor after procurement-chain and AI chat migrations.
-- Electron Market - stable per-chain supplier aliases and separated customer-visible AI records.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.procurement_supplier_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procurement_chain_id uuid NOT NULL REFERENCES public.procurement_chains(id) ON DELETE CASCADE,
  supplier_key text NOT NULL,
  alias_label text NOT NULL CHECK (alias_label ~ '^Supplier [A-Z]+$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (procurement_chain_id, supplier_key),
  UNIQUE (procurement_chain_id, alias_label)
);

CREATE TABLE IF NOT EXISTS public.procurement_supplier_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procurement_chain_id uuid NOT NULL REFERENCES public.procurement_chains(id) ON DELETE CASCADE,
  supplier_key text NOT NULL,
  raw_source_table text NULL,
  raw_source_id uuid NULL,
  direction text NOT NULL CHECK (direction IN ('outbound','inbound')),
  message_type text NOT NULL CHECK (message_type IN ('rfq','clarification','availability','pricing','lead_time','certificate','substitution','shipping','claim')),
  bom_item_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  customer_visible_summary text NOT NULL,
  structured_facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (raw_source_table, raw_source_id)
);

CREATE TABLE IF NOT EXISTS public.procurement_ai_action_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procurement_chain_id uuid NOT NULL REFERENCES public.procurement_chains(id) ON DELETE CASCADE,
  customer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_message_id uuid NULL REFERENCES public.ai_chat_messages(id) ON DELETE SET NULL,
  action_type text NOT NULL CHECK (action_type IN ('supplier_clarification','preference_change')),
  customer_visible_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled','completed','failed')),
  confirmed_at timestamptz NULL,
  cancelled_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS procurement_supplier_aliases_chain_idx ON public.procurement_supplier_aliases(procurement_chain_id);
CREATE INDEX IF NOT EXISTS procurement_supplier_communications_chain_idx ON public.procurement_supplier_communications(procurement_chain_id, created_at);
CREATE INDEX IF NOT EXISTS procurement_ai_action_proposals_chain_idx ON public.procurement_ai_action_proposals(procurement_chain_id, created_at);

ALTER TABLE public.procurement_supplier_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_supplier_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_ai_action_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can read chain supplier aliases" ON public.procurement_supplier_aliases;
DROP POLICY IF EXISTS "Customers can read sanitized supplier communications" ON public.procurement_supplier_communications;
DROP POLICY IF EXISTS "Suppliers can read own outbound procurement communications" ON public.procurement_supplier_communications;
CREATE POLICY "Suppliers can read own outbound procurement communications" ON public.procurement_supplier_communications FOR SELECT TO authenticated
USING (direction='outbound' AND supplier_key=auth.uid()::text);

DROP POLICY IF EXISTS "Customers can read own AI action proposals" ON public.procurement_ai_action_proposals;
CREATE POLICY "Customers can read own AI action proposals" ON public.procurement_ai_action_proposals FOR SELECT TO authenticated
USING (customer_user_id=auth.uid() AND EXISTS (SELECT 1 FROM public.procurement_chains c WHERE c.id=procurement_ai_action_proposals.procurement_chain_id AND c.customer_user_id=auth.uid()));
DROP POLICY IF EXISTS "Customers can update own pending AI action proposals" ON public.procurement_ai_action_proposals;

DROP POLICY IF EXISTS "Admins manage procurement supplier aliases" ON public.procurement_supplier_aliases;
CREATE POLICY "Admins manage procurement supplier aliases" ON public.procurement_supplier_aliases FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND p.role='admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND p.role='admin'));
DROP POLICY IF EXISTS "Admins manage sanitized supplier communications" ON public.procurement_supplier_communications;
CREATE POLICY "Admins manage sanitized supplier communications" ON public.procurement_supplier_communications FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND p.role='admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND p.role='admin'));
DROP POLICY IF EXISTS "Admins manage procurement AI action proposals" ON public.procurement_ai_action_proposals;
CREATE POLICY "Admins manage procurement AI action proposals" ON public.procurement_ai_action_proposals FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND p.role='admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND p.role='admin'));

NOTIFY pgrst, 'reload schema';
