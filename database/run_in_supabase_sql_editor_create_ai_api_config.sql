CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Electron Market - Admin-managed AI API settings.
-- This is not a chat history table.

CREATE TABLE IF NOT EXISTS public.ai_api_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'openai',
  is_enabled boolean NOT NULL DEFAULT true,
  api_endpoint text NOT NULL DEFAULT 'https://api.openai.com/v1/responses',
  api_key_source text NOT NULL DEFAULT 'env',
  api_key_encrypted text,
  api_key_last4 text,
  api_key_is_configured boolean NOT NULL DEFAULT false,
  default_model text NOT NULL DEFAULT 'gpt-5.5',
  default_system_prompt text,
  procurement_system_prompt text,
  max_input_characters integer NOT NULL DEFAULT 12000,
  max_output_tokens integer,
  temperature numeric,
  top_p numeric,
  reasoning_effort text,
  response_format_json jsonb,
  allow_guest_chat boolean NOT NULL DEFAULT true,
  allow_file_uploads boolean NOT NULL DEFAULT false,
  allow_bom_analysis boolean NOT NULL DEFAULT false,
  daily_message_limit_per_user integer NOT NULL DEFAULT 50,
  monthly_token_limit_per_user integer,
  monthly_budget_usd numeric,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.user_profiles(id)
);

ALTER TABLE public.ai_api_config ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_ai_api_config_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_api_config_set_updated_at ON public.ai_api_config;
CREATE TRIGGER ai_api_config_set_updated_at
BEFORE UPDATE ON public.ai_api_config
FOR EACH ROW
EXECUTE FUNCTION public.set_ai_api_config_updated_at();

INSERT INTO public.ai_api_config (
  provider,
  is_enabled,
  default_system_prompt,
  procurement_system_prompt
)
VALUES (
  'openai',
  true,
  'You are a helpful procurement assistant for electronic components.',
  'You help buyers clarify electronic component sourcing requests, BOM details, quantities, delivery country, acceptable alternatives, urgency, and RFQ-ready requirements.'
)
ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "Admins can select ai api config" ON public.ai_api_config;
CREATE POLICY "Admins can select ai api config"
  ON public.ai_api_config
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert ai api config" ON public.ai_api_config;
CREATE POLICY "Admins can insert ai api config"
  ON public.ai_api_config
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update ai api config" ON public.ai_api_config;
CREATE POLICY "Admins can update ai api config"
  ON public.ai_api_config
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Enabled ai api config can be read for guest flags" ON public.ai_api_config;
CREATE POLICY "Enabled ai api config can be read for guest flags"
  ON public.ai_api_config
  FOR SELECT
  TO anon
  USING (is_enabled = true AND allow_guest_chat = true);

NOTIFY pgrst, 'reload schema';
