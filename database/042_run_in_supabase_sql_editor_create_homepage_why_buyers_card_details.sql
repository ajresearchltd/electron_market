-- Manual Supabase SQL Editor migration. Do not run automatically.
-- Adds language-specific popup details for the six Why Buyers Choose cards.

CREATE TABLE IF NOT EXISTS public.homepage_why_buyers_card_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    homepage_content_id UUID NOT NULL REFERENCES public.homepage_content(homepage_content_id) ON DELETE CASCADE,
    card_number SMALLINT NOT NULL CHECK (card_number BETWEEN 1 AND 6),
    modal_title TEXT NULL,
    modal_subtitle TEXT NULL,
    main_image_path TEXT NULL,
    main_image_alt TEXT NULL,
    additional_image_1_path TEXT NULL,
    additional_image_1_alt TEXT NULL,
    additional_image_2_path TEXT NULL,
    additional_image_2_alt TEXT NULL,
    summary_text TEXT NULL,
    body_text TEXT NULL,
    button_text TEXT NULL,
    button_url TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT homepage_why_buyers_card_details_unique UNIQUE (homepage_content_id, card_number)
);

DROP TRIGGER IF EXISTS homepage_why_buyers_card_details_set_updated_at ON public.homepage_why_buyers_card_details;
CREATE TRIGGER homepage_why_buyers_card_details_set_updated_at
BEFORE UPDATE ON public.homepage_why_buyers_card_details
FOR EACH ROW EXECUTE FUNCTION public.set_homepage_marketing_discounts_updated_at();

ALTER TABLE public.homepage_why_buyers_card_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read Why Buyers card details" ON public.homepage_why_buyers_card_details;
CREATE POLICY "Anyone can read Why Buyers card details"
    ON public.homepage_why_buyers_card_details
    FOR SELECT
    USING (TRUE);

-- No browser-facing INSERT, UPDATE, or DELETE policies are created.
-- The protected Admin API writes through the server-only service-role client.
GRANT SELECT ON public.homepage_why_buyers_card_details TO anon, authenticated;
