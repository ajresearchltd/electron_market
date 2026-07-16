-- Manual Supabase SQL Editor migration. Do not run automatically.
-- Stores one global publication flag per logical public homepage block.

CREATE TABLE IF NOT EXISTS public.homepage_section_settings (
    section_key TEXT PRIMARY KEY,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT homepage_section_settings_known_key CHECK (section_key IN (
        'hero',
        'categories',
        'marketing_discounts',
        'how_it_works',
        'industry_solutions',
        'top_verified_suppliers',
        'recent_rfq',
        'why_buyers',
        'suppliers_network',
        'official_suppliers',
        'process',
        'marketplace_numbers',
        'customer_reviews',
        'final_cta'
    ))
);

INSERT INTO public.homepage_section_settings (section_key, is_enabled)
VALUES
    ('hero', TRUE),
    ('categories', TRUE),
    ('marketing_discounts', TRUE),
    ('how_it_works', TRUE),
    ('industry_solutions', TRUE),
    ('top_verified_suppliers', TRUE),
    ('recent_rfq', TRUE),
    ('why_buyers', TRUE),
    ('suppliers_network', TRUE),
    ('official_suppliers', TRUE),
    ('process', TRUE),
    ('marketplace_numbers', TRUE),
    ('customer_reviews', TRUE),
    ('final_cta', TRUE)
ON CONFLICT (section_key) DO NOTHING;

ALTER TABLE public.homepage_section_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read homepage section settings" ON public.homepage_section_settings;
CREATE POLICY "Anyone can read homepage section settings"
    ON public.homepage_section_settings
    FOR SELECT
    USING (TRUE);

-- Writes intentionally have no browser-facing RLS policy. The authenticated
-- Admin API writes through the server-only service-role client.
GRANT SELECT ON public.homepage_section_settings TO anon, authenticated;
