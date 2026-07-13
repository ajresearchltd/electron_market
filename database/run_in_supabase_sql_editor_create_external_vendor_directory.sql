CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Electron Market - Central External Vendor Directory for Octopart/Nexar sellers.
-- Run manually in Supabase SQL Editor. This creates central vendor records and keeps
-- octopart_request_offers vendor_* columns as backward-compatible snapshots.

CREATE TABLE IF NOT EXISTS public.external_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_name text NOT NULL,
  normalized_seller_name text NOT NULL,
  official_company_name text,
  official_website_url text,
  website_domain text,
  vendor_country text,
  vendor_city text,
  vendor_address text,
  vendor_type text DEFAULT 'unknown',
  order_method text DEFAULT 'unknown',
  api_supported boolean DEFAULT false,
  contact_status text DEFAULT 'not_checked',
  verification_status text DEFAULT 'needs_review',
  confidence numeric,
  notes text,
  source_provider text DEFAULT 'nexar_octopart',
  last_contact_checked_at timestamptz,
  last_verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS external_vendors_normalized_seller_name_unique
  ON public.external_vendors(normalized_seller_name);

CREATE TABLE IF NOT EXISTS public.external_vendor_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.external_vendors(id) ON DELETE CASCADE,
  contact_type text NOT NULL,
  contact_value text,
  contact_url text,
  label text,
  source_url text,
  confidence numeric,
  verification_status text DEFAULT 'needs_review',
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT external_vendor_contacts_type_check
    CHECK (contact_type IN ('website', 'contact_page', 'rfq_page', 'sales_email', 'support_email', 'phone', 'sales_person', 'api_docs', 'source_url'))
);

CREATE INDEX IF NOT EXISTS idx_external_vendor_contacts_vendor_id
  ON public.external_vendor_contacts(vendor_id);

CREATE TABLE IF NOT EXISTS public.external_vendor_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.external_vendors(id) ON DELETE CASCADE,
  alias_name text NOT NULL,
  normalized_alias_name text NOT NULL,
  source_provider text DEFAULT 'nexar_octopart',
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS external_vendor_aliases_normalized_source_unique
  ON public.external_vendor_aliases(normalized_alias_name, source_provider);
CREATE INDEX IF NOT EXISTS idx_external_vendor_aliases_vendor_id
  ON public.external_vendor_aliases(vendor_id);

CREATE TABLE IF NOT EXISTS public.external_vendor_discovery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES public.external_vendors(id) ON DELETE SET NULL,
  seller_name text NOT NULL,
  normalized_seller_name text,
  status text,
  ai_summary text,
  raw_ai_response_json jsonb DEFAULT '{}'::jsonb,
  source_urls jsonb DEFAULT '[]'::jsonb,
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_external_vendor_discovery_logs_vendor_id
  ON public.external_vendor_discovery_logs(vendor_id);

ALTER TABLE public.octopart_request_offers
  ADD COLUMN IF NOT EXISTS external_vendor_id uuid REFERENCES public.external_vendors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_octopart_request_offers_external_vendor_id
  ON public.octopart_request_offers(external_vendor_id);

CREATE OR REPLACE FUNCTION public.set_external_vendor_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS external_vendors_set_updated_at ON public.external_vendors;
CREATE TRIGGER external_vendors_set_updated_at
BEFORE UPDATE ON public.external_vendors
FOR EACH ROW
EXECUTE FUNCTION public.set_external_vendor_updated_at();

DROP TRIGGER IF EXISTS external_vendor_contacts_set_updated_at ON public.external_vendor_contacts;
CREATE TRIGGER external_vendor_contacts_set_updated_at
BEFORE UPDATE ON public.external_vendor_contacts
FOR EACH ROW
EXECUTE FUNCTION public.set_external_vendor_updated_at();

ALTER TABLE public.external_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_vendor_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_vendor_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_vendor_discovery_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage external vendors" ON public.external_vendors;
CREATE POLICY "Admins can manage external vendors"
  ON public.external_vendors
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage external vendor contacts" ON public.external_vendor_contacts;
CREATE POLICY "Admins can manage external vendor contacts"
  ON public.external_vendor_contacts
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage external vendor aliases" ON public.external_vendor_aliases;
CREATE POLICY "Admins can manage external vendor aliases"
  ON public.external_vendor_aliases
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage external vendor discovery logs" ON public.external_vendor_discovery_logs;
CREATE POLICY "Admins can manage external vendor discovery logs"
  ON public.external_vendor_discovery_logs
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'));

NOTIFY pgrst, 'reload schema';
