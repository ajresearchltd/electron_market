-- Manual Supabase SQL Editor migration. Do not run automatically.
-- Adds hashed guest verification, temporary request sessions, and structured public enquiries.

CREATE TABLE IF NOT EXISTS public.public_request_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_key_hash text NOT NULL,
  normalized_email text NOT NULL,
  purpose text NOT NULL DEFAULT 'public_request_access' CHECK (purpose='public_request_access'),
  code_digest text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
  resend_count integer NOT NULL DEFAULT 0 CHECK (resend_count BETWEEN 0 AND 5),
  expires_at timestamptz NOT NULL,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS public_request_verifications_session_idx ON public.public_request_verifications(session_key_hash,created_at DESC);

CREATE TABLE IF NOT EXISTS public.public_request_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_digest text NOT NULL UNIQUE,
  normalized_email text NOT NULL,
  verification_id uuid NOT NULL REFERENCES public.public_request_verifications(id) ON DELETE RESTRICT,
  verified_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.public_sourcing_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_session_id uuid NULL REFERENCES public.public_request_sessions(id) ON DELETE RESTRICT,
  customer_user_id uuid NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  request_type text NOT NULL CHECK(request_type IN ('individual_product','general_goods','project')),
  contact_email text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'submitted' CHECK(status IN ('draft','submitted','in_review','converted','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((request_session_id IS NOT NULL) <> (customer_user_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS public_sourcing_enquiries_session_idx ON public.public_sourcing_enquiries(request_session_id,created_at DESC);
CREATE INDEX IF NOT EXISTS public_sourcing_enquiries_customer_idx ON public.public_sourcing_enquiries(customer_user_id,created_at DESC);

ALTER TABLE public.public_request_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_request_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_sourcing_enquiries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.public_request_verifications,public.public_request_sessions,public.public_sourcing_enquiries FROM anon,authenticated;
NOTIFY pgrst,'reload schema';
