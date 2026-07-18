-- Manual Supabase SQL Editor migration. Do not execute automatically.
-- Completes canonical public-request idempotency, BOM linkage, and onboarding delivery state.

ALTER TABLE public.public_sourcing_enquiries
  ADD COLUMN IF NOT EXISTS submission_idempotency_key uuid,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'homepage';

ALTER TABLE public.public_sourcing_enquiries
  DROP CONSTRAINT IF EXISTS public_sourcing_enquiries_request_type_check;
ALTER TABLE public.public_sourcing_enquiries
  ADD CONSTRAINT public_sourcing_enquiries_request_type_check
  CHECK (request_type IN ('individual_product','bom','general_goods','project'));

CREATE UNIQUE INDEX IF NOT EXISTS public_sourcing_enquiries_customer_idempotency_uidx
  ON public.public_sourcing_enquiries(customer_user_id, submission_idempotency_key)
  WHERE customer_user_id IS NOT NULL AND submission_idempotency_key IS NOT NULL;

ALTER TABLE public.customer_bom_uploads
  ADD COLUMN IF NOT EXISTS preliminary_order_id uuid NULL
  REFERENCES public.public_sourcing_enquiries(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS customer_bom_uploads_preliminary_order_uidx
  ON public.customer_bom_uploads(preliminary_order_id)
  WHERE preliminary_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customer_bom_upload_items_upload_row_uidx
  ON public.customer_bom_upload_items(upload_id,row_number);

CREATE TABLE IF NOT EXISTS public.customer_onboarding_deliveries (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  delivery_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed')),
  attempt_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_onboarding_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_onboarding_deliveries FROM anon, authenticated;

NOTIFY pgrst,'reload schema';
