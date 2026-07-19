-- Manual Supabase SQL Editor migration. Do not run automatically.
-- Phase 1 only: deterministic canonical supplier ownership and legacy RLS repair.

-- Backfill only through the declared profile UUID relationship. No email/name matching.
UPDATE public.supplier_company_contacts c
SET canonical_supplier_id = s.supplier_id
FROM public.suppliers s
WHERE c.profile_id = s.source_profile_id
  AND c.canonical_supplier_id IS DISTINCT FROM s.supplier_id;

UPDATE public.supplier_company_documents d
SET canonical_supplier_id = s.supplier_id
FROM public.suppliers s
WHERE d.profile_id = s.source_profile_id
  AND d.canonical_supplier_id IS DISTINCT FROM s.supplier_id;

UPDATE public.supplier_contact_emails e
SET canonical_supplier_id = s.supplier_id
FROM public.suppliers s
WHERE e.source_profile_id = s.source_profile_id
  AND e.canonical_supplier_id IS DISTINCT FROM s.supplier_id;

-- Existing orphan snapshots (including Samsung) remain stored. NOT VALID avoids
-- rewriting or deleting legacy data while enforcing the rule for new/updated rows.
ALTER TABLE public.verified_supplier
  DROP CONSTRAINT IF EXISTS verified_supplier_publication_requires_canonical;
ALTER TABLE public.verified_supplier
  ADD CONSTRAINT verified_supplier_publication_requires_canonical
  CHECK (
    canonical_supplier_id IS NOT NULL
    OR NOT (is_active AND is_public AND (show_on_homepage OR show_public_website))
  ) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_verified_supplier_public_directory_canonical
  ON public.verified_supplier(show_public_website, is_public, is_active, public_directory_sort_order, name)
  WHERE canonical_supplier_id IS NOT NULL;

-- Public product reads expose approved active published rows only.
DROP POLICY IF EXISTS "Anyone can select products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can delete products" ON public.products;
DROP POLICY IF EXISTS "Public can select approved supplier products" ON public.products;
DROP POLICY IF EXISTS "Suppliers can select own canonical products" ON public.products;
DROP POLICY IF EXISTS "Suppliers can insert own canonical products" ON public.products;
DROP POLICY IF EXISTS "Suppliers can update own canonical products" ON public.products;
DROP POLICY IF EXISTS "Suppliers can delete own canonical products" ON public.products;
DROP POLICY IF EXISTS "Internal users manage supplier products" ON public.products;

CREATE POLICY "Public can select approved supplier products"
  ON public.products FOR SELECT TO anon, authenticated
  USING (is_public = true AND is_active = true AND review_status = 'approved');

CREATE POLICY "Suppliers can select own canonical products"
  ON public.products FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.suppliers s
    JOIN public.supplier_company_profiles p ON p.profile_id = s.source_profile_id
    WHERE s.supplier_id = products.supplier_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Suppliers can insert own canonical products"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.suppliers s
    JOIN public.supplier_company_profiles p ON p.profile_id = s.source_profile_id
    WHERE s.supplier_id = products.supplier_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Suppliers can update own canonical products"
  ON public.products FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.suppliers s
    JOIN public.supplier_company_profiles p ON p.profile_id = s.source_profile_id
    WHERE s.supplier_id = products.supplier_id AND p.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.suppliers s
    JOIN public.supplier_company_profiles p ON p.profile_id = s.source_profile_id
    WHERE s.supplier_id = products.supplier_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Suppliers can delete own canonical products"
  ON public.products FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.suppliers s
    JOIN public.supplier_company_profiles p ON p.profile_id = s.source_profile_id
    WHERE s.supplier_id = products.supplier_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Internal users manage supplier products"
  ON public.products FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles u WHERE u.id = auth.uid() AND u.role IN ('admin','support')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles u WHERE u.id = auth.uid() AND u.role IN ('admin','support')));

-- Keep public SELECT, but remove legacy direct writes by arbitrary authenticated users.
DROP POLICY IF EXISTS "Authenticated users can insert verified_supplier" ON public.verified_supplier;
DROP POLICY IF EXISTS "Authenticated users can update verified_supplier" ON public.verified_supplier;
DROP POLICY IF EXISTS "Authenticated users can delete verified_supplier" ON public.verified_supplier;
DROP POLICY IF EXISTS "Admins manage verified supplier snapshots" ON public.verified_supplier;

CREATE POLICY "Admins manage verified supplier snapshots"
  ON public.verified_supplier FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles u WHERE u.id = auth.uid() AND u.role = 'admin'));

NOTIFY pgrst, 'reload schema';
