-- Manual Supabase SQL Editor migration. Do not run automatically.
-- Stores global publication flags for the six existing Why Buyers Choose cards.

CREATE TABLE IF NOT EXISTS public.homepage_why_buyers_card_settings (
    card_index SMALLINT PRIMARY KEY,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT homepage_why_buyers_card_index_check CHECK (card_index BETWEEN 1 AND 6)
);

INSERT INTO public.homepage_why_buyers_card_settings (card_index, is_enabled)
VALUES (1, TRUE), (2, TRUE), (3, TRUE), (4, TRUE), (5, TRUE), (6, TRUE)
ON CONFLICT (card_index) DO NOTHING;

ALTER TABLE public.homepage_why_buyers_card_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read Why Buyers card settings" ON public.homepage_why_buyers_card_settings;
CREATE POLICY "Anyone can read Why Buyers card settings"
    ON public.homepage_why_buyers_card_settings
    FOR SELECT
    USING (TRUE);

-- Writes intentionally have no browser-facing RLS policy. The authenticated
-- Admin save route writes through the server-only service-role client.
GRANT SELECT ON public.homepage_why_buyers_card_settings TO anon, authenticated;
