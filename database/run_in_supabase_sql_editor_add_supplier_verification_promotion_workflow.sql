-- Run manually in Supabase SQL Editor. Do not execute automatically.
-- Supply HUB review, canonical identity, verified promotion, product approval, and immutable audit.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- A. Add every required column before any backfill, foreign key, index, or function references it.
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS source_profile_id uuid NULL;

ALTER TABLE public.verified_supplier
  ADD COLUMN IF NOT EXISTS canonical_supplier_id uuid NULL,
  ADD COLUMN IF NOT EXISTS public_display_name text NULL,
  ADD COLUMN IF NOT EXISTS public_detailed_description text NULL,
  ADD COLUMN IF NOT EXISTS public_city text NULL,
  ADD COLUMN IF NOT EXISTS public_supplier_type text NULL,
  ADD COLUMN IF NOT EXISTS public_brands text NULL,
  ADD COLUMN IF NOT EXISTS public_categories text NULL,
  ADD COLUMN IF NOT EXISTS cover_image_url text NULL,
  ADD COLUMN IF NOT EXISTS show_external_website boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_website_url text NULL,
  ADD COLUMN IF NOT EXISTS public_directory_sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_updated_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS public_profile_updated_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS has_pending_public_changes boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pending_review_at timestamptz NULL;
ALTER TABLE public.supplier_company_profiles
  ADD COLUMN IF NOT EXISTS public_display_name text NULL,
  ADD COLUMN IF NOT EXISTS public_short_description text NULL,
  ADD COLUMN IF NOT EXISTS public_detailed_description text NULL,
  ADD COLUMN IF NOT EXISTS public_city text NULL,
  ADD COLUMN IF NOT EXISTS public_supplier_type text NULL,
  ADD COLUMN IF NOT EXISTS public_brands text NULL,
  ADD COLUMN IF NOT EXISTS public_categories text NULL,
  ADD COLUMN IF NOT EXISTS logo_url text NULL,
  ADD COLUMN IF NOT EXISTS cover_image_url text NULL,
  ADD COLUMN IF NOT EXISTS regions_served text NULL,
  ADD COLUMN IF NOT EXISTS delivery_countries text NULL,
  ADD COLUMN IF NOT EXISTS preferred_currencies text NULL,
  ADD COLUMN IF NOT EXISTS employee_count integer NULL,
  ADD COLUMN IF NOT EXISTS admin_notes text NULL,
  ADD COLUMN IF NOT EXISTS verification_checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS decision_reason text NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS verified_by uuid NULL,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS verification_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS has_pending_public_changes boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pending_review_at timestamptz NULL;
ALTER TABLE public.supplier_company_profiles DROP CONSTRAINT IF EXISTS supplier_company_profiles_verification_status_check;
ALTER TABLE public.supplier_company_profiles ADD CONSTRAINT supplier_company_profiles_verification_status_check CHECK (verification_status IN ('pending','in_review','needs_update','approved','verified','rejected','suspended','revoked'));

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'submitted',
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS review_reason text NULL,
  ADD COLUMN IF NOT EXISTS public_sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_review_status_check;
ALTER TABLE public.products ADD CONSTRAINT products_review_status_check CHECK (review_status IN ('submitted','under_review','approved','rejected','public','inactive'));

-- Authorization emails may be reviewed before promotion; promotion later links them to the verified snapshot.
ALTER TABLE public.supplier_contact_emails
  ALTER COLUMN supplier_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS source_profile_id uuid NULL;

-- B. Backfill/link only unambiguous exact registration emails; leave uncertain records for Admin review.
UPDATE public.suppliers s SET source_profile_id=p.profile_id
FROM public.supplier_company_profiles p
WHERE s.source_profile_id IS NULL AND p.company_email IS NOT NULL AND s.contact_email IS NOT NULL
  AND lower(trim(s.contact_email))=lower(trim(p.company_email))
  AND (SELECT count(*) FROM public.suppliers sx WHERE sx.contact_email IS NOT NULL AND lower(trim(sx.contact_email))=lower(trim(p.company_email)))=1
  AND (SELECT count(*) FROM public.supplier_company_profiles px WHERE px.company_email IS NOT NULL AND lower(trim(px.company_email))=lower(trim(p.company_email)))=1
  AND NOT EXISTS(SELECT 1 FROM public.suppliers other WHERE other.source_profile_id=p.profile_id);

-- Preserve every record while repairing any duplicate links left by an earlier partial/manual attempt.
WITH ranked AS (
  SELECT supplier_id,row_number() OVER(PARTITION BY source_profile_id ORDER BY supplier_id) AS link_rank
  FROM public.suppliers WHERE source_profile_id IS NOT NULL
)
UPDATE public.suppliers s SET source_profile_id=NULL FROM ranked r
WHERE s.supplier_id=r.supplier_id AND r.link_rank>1;

WITH ranked AS (
  SELECT supplier_id,row_number() OVER(PARTITION BY canonical_supplier_id ORDER BY supplier_id) AS link_rank
  FROM public.verified_supplier WHERE canonical_supplier_id IS NOT NULL
)
UPDATE public.verified_supplier v SET canonical_supplier_id=NULL FROM ranked r
WHERE v.supplier_id=r.supplier_id AND r.link_rank>1;

-- C. Add relationship foreign keys only after all referenced columns exist.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.suppliers'::regclass AND conname='suppliers_source_profile_id_fkey') THEN
    ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_source_profile_id_fkey FOREIGN KEY(source_profile_id) REFERENCES public.supplier_company_profiles(profile_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.verified_supplier'::regclass AND conname='verified_supplier_canonical_supplier_id_fkey') THEN
    ALTER TABLE public.verified_supplier ADD CONSTRAINT verified_supplier_canonical_supplier_id_fkey FOREIGN KEY(canonical_supplier_id) REFERENCES public.suppliers(supplier_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.supplier_company_profiles'::regclass AND conname='supplier_company_profiles_reviewed_by_fkey') THEN
    ALTER TABLE public.supplier_company_profiles ADD CONSTRAINT supplier_company_profiles_reviewed_by_fkey FOREIGN KEY(reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.supplier_company_profiles'::regclass AND conname='supplier_company_profiles_verified_by_fkey') THEN
    ALTER TABLE public.supplier_company_profiles ADD CONSTRAINT supplier_company_profiles_verified_by_fkey FOREIGN KEY(verified_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.products'::regclass AND conname='products_reviewed_by_fkey') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_reviewed_by_fkey FOREIGN KEY(reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.supplier_contact_emails'::regclass AND conname='supplier_contact_emails_source_profile_id_fkey') THEN
    ALTER TABLE public.supplier_contact_emails ADD CONSTRAINT supplier_contact_emails_source_profile_id_fkey FOREIGN KEY(source_profile_id) REFERENCES public.supplier_company_profiles(profile_id) ON DELETE CASCADE;
  END IF;
END $$;

-- D. Relationship and public-query indexes come after columns, backfill, and foreign keys.
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_source_profile_unique ON public.suppliers(source_profile_id) WHERE source_profile_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS verified_supplier_one_per_canonical_supplier ON public.verified_supplier(canonical_supplier_id) WHERE canonical_supplier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_public_supplier ON public.products(supplier_id,is_public,review_status,product_status,public_sort_order);
CREATE INDEX IF NOT EXISTS idx_supplier_contact_emails_source_profile ON public.supplier_contact_emails(source_profile_id,email_type,is_active);
CREATE UNIQUE INDEX IF NOT EXISTS supplier_contact_emails_profile_normalized_unique ON public.supplier_contact_emails(source_profile_id,normalized_email) WHERE source_profile_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.supplier_verification_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.supplier_company_profiles(profile_id) ON DELETE RESTRICT,
  canonical_supplier_id uuid NULL REFERENCES public.suppliers(supplier_id) ON DELETE SET NULL,
  verified_supplier_id uuid NULL REFERENCES public.verified_supplier(supplier_id) ON DELETE SET NULL,
  product_id uuid NULL REFERENCES public.products(product_id) ON DELETE SET NULL,
  action text NOT NULL,
  previous_values jsonb NULL,
  new_values jsonb NULL,
  reason text NULL,
  performed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_supplier_verification_audit_profile ON public.supplier_verification_audit_log(profile_id,created_at DESC);

-- F. Functions and triggers are created only after every referenced table and column exists.
CREATE OR REPLACE FUNCTION public.mark_supplier_public_changes_pending()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.verification_status='verified' AND (
   OLD.public_display_name IS DISTINCT FROM NEW.public_display_name OR
   OLD.public_short_description IS DISTINCT FROM NEW.public_short_description OR
   OLD.public_detailed_description IS DISTINCT FROM NEW.public_detailed_description OR
   OLD.public_city IS DISTINCT FROM NEW.public_city OR
   OLD.public_supplier_type IS DISTINCT FROM NEW.public_supplier_type OR
   OLD.public_brands IS DISTINCT FROM NEW.public_brands OR
   OLD.public_categories IS DISTINCT FROM NEW.public_categories OR
   OLD.logo_url IS DISTINCT FROM NEW.logo_url OR OLD.cover_image_url IS DISTINCT FROM NEW.cover_image_url OR
   OLD.website IS DISTINCT FROM NEW.website OR OLD.product_categories_text IS DISTINCT FROM NEW.product_categories_text
 ) THEN NEW.has_pending_public_changes:=true;NEW.pending_review_at:=now(); END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS supplier_profile_mark_public_changes_pending ON public.supplier_company_profiles;
CREATE TRIGGER supplier_profile_mark_public_changes_pending BEFORE UPDATE ON public.supplier_company_profiles FOR EACH ROW EXECUTE FUNCTION public.mark_supplier_public_changes_pending();

CREATE OR REPLACE FUNCTION public.promote_supply_hub_supplier(p_profile_id uuid, p_settings jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actor uuid:=auth.uid();v_profile public.supplier_company_profiles%ROWTYPE;v_supplier public.suppliers%ROWTYPE;v_verified public.verified_supplier%ROWTYPE;v_name text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=v_actor AND role='admin') THEN RAISE EXCEPTION 'Admin authorization required'; END IF;
 SELECT * INTO v_profile FROM public.supplier_company_profiles WHERE profile_id=p_profile_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Supplier profile not found'; END IF;
 IF v_profile.verification_status NOT IN ('approved','verified') THEN RAISE EXCEPTION 'Supplier must be approved before promotion'; END IF;
 IF NOT (coalesce((v_profile.verification_checklist->>'company_registration_reviewed')::boolean,false)
   AND coalesce((v_profile.verification_checklist->>'company_identity_confirmed')::boolean,false)
   AND coalesce((v_profile.verification_checklist->>'primary_contact_verified')::boolean,false)
   AND coalesce((v_profile.verification_checklist->>'compliance_review_completed')::boolean,false))
 THEN RAISE EXCEPTION 'Mandatory verification checklist items are incomplete'; END IF;
 v_name:=coalesce(nullif(v_profile.public_display_name,''),nullif(v_profile.company_name,''),'Verified Supplier');
 INSERT INTO public.suppliers(source_profile_id,supplier_name,company_name,country,city,website,contact_email,contact_phone,verified_supplier,supplier_status,updated_date)
 VALUES(v_profile.profile_id,v_name,v_profile.company_name,v_profile.country_name,v_profile.public_city,v_profile.website,v_profile.company_email,v_profile.company_phone,true,'active',now())
 ON CONFLICT(source_profile_id) WHERE source_profile_id IS NOT NULL DO UPDATE SET supplier_name=excluded.supplier_name,company_name=excluded.company_name,country=excluded.country,city=excluded.city,website=excluded.website,verified_supplier=true,supplier_status='active',updated_date=now()
 RETURNING * INTO v_supplier;
 INSERT INTO public.verified_supplier(canonical_supplier_id,name,pic,delivery_product,public_display_name,public_short_description,public_detailed_description,public_country,public_city,public_supplier_type,public_brands,public_categories,cover_image_url,show_external_website,public_website_url,show_on_homepage,show_public_website,is_public,is_active,homepage_sort_order,public_directory_sort_order,source_updated_at,public_profile_updated_at,has_pending_public_changes)
 VALUES(v_supplier.supplier_id,v_name,v_profile.logo_url,v_profile.product_categories_text,v_name,v_profile.public_short_description,v_profile.public_detailed_description,v_profile.country_name,v_profile.public_city,v_profile.public_supplier_type,v_profile.public_brands,coalesce(v_profile.public_categories,v_profile.product_categories_text),v_profile.cover_image_url,coalesce((p_settings->>'show_external_website')::boolean,false),CASE WHEN coalesce((p_settings->>'show_external_website')::boolean,false) THEN v_profile.website ELSE NULL END,coalesce((p_settings->>'show_on_homepage')::boolean,false),coalesce((p_settings->>'show_public_website')::boolean,false),coalesce((p_settings->>'is_public')::boolean,true),true,coalesce((p_settings->>'homepage_sort_order')::integer,0),coalesce((p_settings->>'public_directory_sort_order')::integer,0),v_profile.updated_at,now(),false)
 ON CONFLICT(canonical_supplier_id) WHERE canonical_supplier_id IS NOT NULL DO UPDATE SET name=excluded.name,pic=excluded.pic,delivery_product=excluded.delivery_product,public_display_name=excluded.public_display_name,public_short_description=excluded.public_short_description,public_detailed_description=excluded.public_detailed_description,public_country=excluded.public_country,public_city=excluded.public_city,public_supplier_type=excluded.public_supplier_type,public_brands=excluded.public_brands,public_categories=excluded.public_categories,cover_image_url=excluded.cover_image_url,show_external_website=excluded.show_external_website,public_website_url=excluded.public_website_url,show_on_homepage=excluded.show_on_homepage,show_public_website=excluded.show_public_website,is_public=excluded.is_public,is_active=true,homepage_sort_order=excluded.homepage_sort_order,public_directory_sort_order=excluded.public_directory_sort_order,source_updated_at=excluded.source_updated_at,public_profile_updated_at=now(),has_pending_public_changes=false
 RETURNING * INTO v_verified;
 UPDATE public.supplier_contact_emails SET supplier_id=v_verified.supplier_id WHERE source_profile_id=p_profile_id AND supplier_id IS NULL;
 UPDATE public.supplier_company_profiles SET verification_status='verified',verified_by=v_actor,verified_at=coalesce(verified_at,now()),has_pending_public_changes=false WHERE profile_id=p_profile_id;
 INSERT INTO public.supplier_verification_audit_log(profile_id,canonical_supplier_id,verified_supplier_id,action,new_values,performed_by) VALUES(p_profile_id,v_supplier.supplier_id,v_verified.supplier_id,'promoted_to_verified',jsonb_build_object('verification_status','verified'),v_actor);
 RETURN jsonb_build_object('profile_id',p_profile_id,'verified_supplier_id',v_verified.supplier_id,'public_slug',v_verified.public_slug,'verification_status','verified');
END $$;
REVOKE ALL ON FUNCTION public.promote_supply_hub_supplier(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_supply_hub_supplier(uuid,jsonb) TO authenticated;

-- G. Grants and RLS follow table/function creation.
ALTER TABLE public.supplier_verification_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Internal users read supplier verification audit" ON public.supplier_verification_audit_log;
CREATE POLICY "Internal users read supplier verification audit" ON public.supplier_verification_audit_log FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND p.role IN ('admin','support')));

-- H. Reload PostgREST only after the complete migration is defined.
NOTIFY pgrst,'reload schema';
