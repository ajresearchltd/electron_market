-- Manual Supabase SQL Editor migration. Do not run automatically.

CREATE TABLE IF NOT EXISTS public.site_footer_config (
    config_key TEXT PRIMARY KEY CHECK (config_key = 'public_footer'),
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    contact_email TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    menu_structure JSONB NOT NULL DEFAULT '[]'::JSONB,
    social_links JSONB NOT NULL DEFAULT '[]'::JSONB,
    translations JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.site_footer_config ENABLE ROW LEVEL SECURITY;

INSERT INTO public.site_footer_config (config_key, is_enabled, contact_email, contact_phone, menu_structure, social_links, translations)
VALUES (
  'public_footer', TRUE, 'support@electromarket.com', '+1 (555) 123-4567',
  '[{"key":"for_buyers","sortOrder":1,"isEnabled":true,"items":[{"key":"how_it_works","href":"#how-it-works","sortOrder":1,"isEnabled":true,"openInNewTab":false},{"key":"submit_rfq","href":"/create-request","sortOrder":2,"isEnabled":true,"openInNewTab":false},{"key":"find_suppliers","href":"#suppliers","sortOrder":3,"isEnabled":true,"openInNewTab":false},{"key":"help_center","href":"#","sortOrder":4,"isEnabled":true,"openInNewTab":false}]},{"key":"for_suppliers","sortOrder":2,"isEnabled":true,"items":[{"key":"join_as_supplier","href":"/register/supplier","sortOrder":1,"isEnabled":true,"openInNewTab":false},{"key":"supplier_guide","href":"#","sortOrder":2,"isEnabled":true,"openInNewTab":false},{"key":"benefits","href":"#","sortOrder":3,"isEnabled":true,"openInNewTab":false},{"key":"resources","href":"#","sortOrder":4,"isEnabled":true,"openInNewTab":false}]},{"key":"company","sortOrder":3,"isEnabled":true,"items":[{"key":"about_us","href":"#about","sortOrder":1,"isEnabled":true,"openInNewTab":false},{"key":"news","href":"#","sortOrder":2,"isEnabled":true,"openInNewTab":false},{"key":"careers","href":"#","sortOrder":3,"isEnabled":true,"openInNewTab":false},{"key":"partners","href":"#","sortOrder":4,"isEnabled":true,"openInNewTab":false},{"key":"contact","href":"#","sortOrder":5,"isEnabled":true,"openInNewTab":false}]}]'::JSONB,
  '[{"key":"twitter","url":"#","sortOrder":1,"isEnabled":true,"openInNewTab":false},{"key":"linkedin","url":"#","sortOrder":2,"isEnabled":true,"openInNewTab":false},{"key":"facebook","url":"#","sortOrder":3,"isEnabled":true,"openInNewTab":false}]'::JSONB,
  '{"English":{"brandName":"ElectroMarket","description":"Global marketplace for electronic components and equipment.","copyrightText":"© 2024 ElectroMarket. All rights reserved.","groupTitles":{"for_buyers":"For Buyers","for_suppliers":"For Suppliers","company":"Company"},"itemLabels":{"for_buyers.how_it_works":"How it works","for_buyers.submit_rfq":"Submit RFQ","for_buyers.find_suppliers":"Find Suppliers","for_buyers.help_center":"Help Center","for_suppliers.join_as_supplier":"Join as Supplier","for_suppliers.supplier_guide":"Supplier Guide","for_suppliers.benefits":"Benefits","for_suppliers.resources":"Resources","company.about_us":"About us","company.news":"News","company.careers":"Careers","company.partners":"Partners","company.contact":"Contact"},"socialNames":{"twitter":"Twitter","linkedin":"LinkedIn","facebook":"Facebook"}}}'::JSONB
)
ON CONFLICT (config_key) DO NOTHING;

-- No public table policy: reads and Admin writes use server-only clients.
REVOKE ALL ON public.site_footer_config FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
