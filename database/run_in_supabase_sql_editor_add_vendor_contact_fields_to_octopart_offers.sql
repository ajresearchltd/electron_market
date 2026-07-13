-- Electron Market - Vendor contact discovery fields for Octopart/Nexar offers.
-- Run manually in Supabase SQL Editor before using AI Vendor Contact Discovery.

ALTER TABLE public.octopart_request_offers
  ADD COLUMN IF NOT EXISTS vendor_website_url text,
  ADD COLUMN IF NOT EXISTS vendor_contact_page_url text,
  ADD COLUMN IF NOT EXISTS vendor_rfq_page_url text,
  ADD COLUMN IF NOT EXISTS vendor_email_1 text,
  ADD COLUMN IF NOT EXISTS vendor_email_2 text,
  ADD COLUMN IF NOT EXISTS vendor_email_3 text,
  ADD COLUMN IF NOT EXISTS vendor_phone text,
  ADD COLUMN IF NOT EXISTS vendor_sales_contact_names text,
  ADD COLUMN IF NOT EXISTS vendor_contact_source_urls jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS vendor_contact_confidence numeric,
  ADD COLUMN IF NOT EXISTS vendor_contact_status text DEFAULT 'not_checked',
  ADD COLUMN IF NOT EXISTS vendor_contact_error text,
  ADD COLUMN IF NOT EXISTS vendor_contact_raw_json jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS vendor_contact_checked_at timestamptz;

NOTIFY pgrst, 'reload schema';
