-- Run manually in Supabase SQL Editor after supplier profile and inbound email migrations.
-- Electron Market - verified supplier details, contacts, typed emails, Quote authorization, and audit.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Public-safe fields only. Never place private contact or authorization data here.
ALTER TABLE public.verified_supplier
  ADD COLUMN IF NOT EXISTS public_short_description text NULL,
  ADD COLUMN IF NOT EXISTS public_country text NULL,
  ADD COLUMN IF NOT EXISTS public_slug text NULL,
  ADD COLUMN IF NOT EXISTS show_public_website boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_on_homepage boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS homepage_sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Stable public URLs prevent exposing internal supplier UUIDs.
UPDATE public.verified_supplier
SET public_slug = trim(both '-' from regexp_replace(lower(coalesce(nullif(name,''),'verified-supplier')), '[^a-z0-9]+', '-', 'g'))
                  || '-' || left(md5(supplier_id::text), 8)
WHERE public_slug IS NULL OR trim(public_slug) = '';
CREATE UNIQUE INDEX IF NOT EXISTS verified_supplier_public_slug_unique
  ON public.verified_supplier(public_slug);
ALTER TABLE public.verified_supplier ALTER COLUMN public_slug SET NOT NULL;

CREATE OR REPLACE FUNCTION public.set_verified_supplier_public_slug()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.public_slug IS NULL OR trim(NEW.public_slug) = '' THEN
    NEW.public_slug := trim(both '-' from regexp_replace(lower(coalesce(nullif(NEW.name,''),'verified-supplier')), '[^a-z0-9]+', '-', 'g'))
                       || '-' || left(md5(NEW.supplier_id::text), 8);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS verified_supplier_set_public_slug ON public.verified_supplier;
CREATE TRIGGER verified_supplier_set_public_slug BEFORE INSERT OR UPDATE OF name, public_slug ON public.verified_supplier
FOR EACH ROW EXECUTE FUNCTION public.set_verified_supplier_public_slug();

CREATE INDEX IF NOT EXISTS idx_verified_supplier_homepage
  ON public.verified_supplier(show_on_homepage, is_public, is_active, homepage_sort_order, name);

CREATE TABLE IF NOT EXISTS public.verified_supplier_details (
  supplier_id uuid PRIMARY KEY REFERENCES public.verified_supplier(supplier_id) ON DELETE CASCADE,
  supplier_user_id uuid NULL UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  legal_company_name text NULL,
  display_name text NULL,
  detailed_description text NULL,
  product_categories text NULL,
  country text NULL,
  city text NULL,
  company_address text NULL,
  postal_code text NULL,
  website text NULL,
  phone text NULL,
  secondary_phone text NULL,
  whatsapp text NULL,
  registration_number text NULL,
  tax_number text NULL,
  primary_company_email text NULL,
  correspondence_email text NULL,
  internal_admin_notes text NULL,
  administrative_status text NOT NULL DEFAULT 'active'
    CHECK (administrative_status IN ('active','inactive','pending_review','suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Reuse the canonical supplier contact table for both auth-linked profiles and verified-supplier records.
ALTER TABLE public.supplier_company_contacts
  ALTER COLUMN profile_id DROP NOT NULL,
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS verified_supplier_id uuid NULL REFERENCES public.verified_supplier(supplier_id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS department text NULL,
  ADD COLUMN IF NOT EXISTS mobile_phone text NULL,
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.supplier_company_contacts
  DROP CONSTRAINT IF EXISTS supplier_company_contacts_owner_check;
ALTER TABLE public.supplier_company_contacts
  ADD CONSTRAINT supplier_company_contacts_owner_check
  CHECK (profile_id IS NOT NULL OR verified_supplier_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_supplier_company_contacts_verified_supplier
  ON public.supplier_company_contacts(verified_supplier_id, is_active, contact_index);
CREATE UNIQUE INDEX IF NOT EXISTS supplier_company_contacts_one_primary_verified
  ON public.supplier_company_contacts(verified_supplier_id)
  WHERE verified_supplier_id IS NOT NULL AND is_primary AND is_active;

CREATE TABLE IF NOT EXISTS public.supplier_contact_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.verified_supplier(supplier_id) ON DELETE CASCADE,
  contact_id uuid NULL REFERENCES public.supplier_company_contacts(contact_id) ON DELETE SET NULL,
  supplier_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  contact_name text NULL,
  contact_role text NULL,
  email text NOT NULL,
  normalized_email text GENERATED ALWAYS AS (lower(trim(email))) STORED,
  email_type text NOT NULL DEFAULT 'alternative'
    CHECK (email_type IN ('primary','correspondence','quotes','manager','accounting','logistics','support','alternative')),
  is_active boolean NOT NULL DEFAULT true,
  is_verified boolean NOT NULL DEFAULT false,
  consented boolean NOT NULL DEFAULT false,
  can_send_quotes boolean NOT NULL DEFAULT false,
  consent_evidence_reference text NULL,
  consent_recorded_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  consent_recorded_at timestamptz NULL,
  verification_method text NULL,
  verification_reason text NULL,
  verified_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(supplier_id, normalized_email)
);
CREATE UNIQUE INDEX IF NOT EXISTS supplier_contact_emails_unique_authorized_sender
  ON public.supplier_contact_emails(normalized_email)
  WHERE is_active AND is_verified AND consented AND can_send_quotes;
CREATE INDEX IF NOT EXISTS idx_supplier_contact_emails_supplier
  ON public.supplier_contact_emails(supplier_id, email_type, is_active);

CREATE TABLE IF NOT EXISTS public.supplier_contact_authorization_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.verified_supplier(supplier_id) ON DELETE CASCADE,
  email_id uuid NULL REFERENCES public.supplier_contact_emails(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('created','updated','activated','deactivated','verification_requested','verified_manually','quote_permission_granted','quote_permission_revoked','consent_recorded','consent_revoked','deleted')),
  previous_state jsonb NULL,
  new_state jsonb NULL,
  reason text NULL,
  evidence_reference text NULL,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supplier_contact_authorization_audit_log
  ADD COLUMN IF NOT EXISTS evidence_type text NULL
    CHECK (evidence_type IS NULL OR evidence_type IN ('supplier_email','signed_agreement','supplier_portal_confirmation','other')),
  ADD COLUMN IF NOT EXISTS confirmation_date date NULL,
  ADD COLUMN IF NOT EXISTS admin_note text NULL,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_contact_authorization_audit
  ON public.supplier_contact_authorization_audit_log(supplier_id, email_id, created_at DESC);

ALTER TABLE public.supplier_inbound_messages
  ADD COLUMN IF NOT EXISTS sender_authorization_status text NOT NULL DEFAULT 'pending'
    CHECK (sender_authorization_status IN ('pending','authorized','quarantined')),
  ADD COLUMN IF NOT EXISTS authorized_sender_email_id uuid NULL REFERENCES public.supplier_contact_emails(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.set_verified_supplier_details_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS verified_supplier_details_set_updated_at ON public.verified_supplier_details;
CREATE TRIGGER verified_supplier_details_set_updated_at BEFORE UPDATE ON public.verified_supplier_details FOR EACH ROW EXECUTE FUNCTION public.set_verified_supplier_details_updated_at();
DROP TRIGGER IF EXISTS supplier_contact_emails_set_updated_at ON public.supplier_contact_emails;
CREATE TRIGGER supplier_contact_emails_set_updated_at BEFORE UPDATE ON public.supplier_contact_emails FOR EACH ROW EXECUTE FUNCTION public.set_verified_supplier_details_updated_at();

ALTER TABLE public.verified_supplier_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_contact_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_contact_authorization_audit_log ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['verified_supplier_details','supplier_contact_emails','supplier_contact_authorization_audit_log'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Internal users manage %s" ON public.%I',table_name,table_name);
    EXECUTE format('CREATE POLICY "Internal users manage %s" ON public.%I FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND p.role IN (''admin'',''support''))) WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND p.role IN (''admin'',''support'')))',table_name,table_name);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Internal users manage verified supplier contacts" ON public.supplier_company_contacts;
CREATE POLICY "Internal users manage verified supplier contacts" ON public.supplier_company_contacts FOR ALL TO authenticated
USING (verified_supplier_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND p.role IN ('admin','support')))
WITH CHECK (verified_supplier_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND p.role IN ('admin','support')));

NOTIFY pgrst, 'reload schema';
