-- Manual Supabase SQL Editor migration. Do not run automatically.
-- Allows clarification drafts when no RFQ candidate can yet be identified.

ALTER TABLE public.supplier_part_clarifications
  ALTER COLUMN candidate_rfq_item_id DROP NOT NULL;

NOTIFY pgrst,'reload schema';
