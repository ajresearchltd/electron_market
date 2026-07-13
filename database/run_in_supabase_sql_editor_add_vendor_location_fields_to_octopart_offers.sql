-- Electron Market - Vendor location fields for Octopart/Nexar offers.
-- Run manually in Supabase SQL Editor before using AI Vendor Contact Discovery location display.

ALTER TABLE public.octopart_request_offers
ADD COLUMN IF NOT EXISTS vendor_country text;

ALTER TABLE public.octopart_request_offers
ADD COLUMN IF NOT EXISTS vendor_city text;

ALTER TABLE public.octopart_request_offers
ADD COLUMN IF NOT EXISTS vendor_address text;

ALTER TABLE public.octopart_request_offers
ADD COLUMN IF NOT EXISTS vendor_location_source_url text;

NOTIFY pgrst, 'reload schema';
