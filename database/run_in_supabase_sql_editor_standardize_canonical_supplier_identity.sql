-- Run manually in Supabase SQL Editor. Do not execute automatically.
-- Canonical supplier identity: every business-owned row resolves to public.suppliers.supplier_id.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Columns first.
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS source_profile_id uuid NULL;
ALTER TABLE public.verified_supplier ADD COLUMN IF NOT EXISTS canonical_supplier_id uuid NULL;
ALTER TABLE public.supplier_contact_emails ADD COLUMN IF NOT EXISTS canonical_supplier_id uuid NULL;
ALTER TABLE public.supplier_company_contacts ADD COLUMN IF NOT EXISTS canonical_supplier_id uuid NULL;
ALTER TABLE public.supplier_company_documents ADD COLUMN IF NOT EXISTS canonical_supplier_id uuid NULL;
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS source_upload_id uuid NULL,
  ADD COLUMN IF NOT EXISTS source_upload_item_id uuid NULL,
  ADD COLUMN IF NOT EXISTS source_row_number integer NULL,
  ADD COLUMN IF NOT EXISTS source_file_name text NULL;

-- 2. Backfill only through stable UUID relationships. No email/name matching is used.
UPDATE public.supplier_company_contacts c SET canonical_supplier_id=s.supplier_id
FROM public.suppliers s WHERE c.profile_id=s.source_profile_id AND c.canonical_supplier_id IS DISTINCT FROM s.supplier_id;
UPDATE public.supplier_company_documents d SET canonical_supplier_id=s.supplier_id
FROM public.suppliers s WHERE d.profile_id=s.source_profile_id AND d.canonical_supplier_id IS DISTINCT FROM s.supplier_id;
UPDATE public.supplier_contact_emails e SET canonical_supplier_id=s.supplier_id
FROM public.suppliers s WHERE e.source_profile_id=s.source_profile_id AND e.canonical_supplier_id IS DISTINCT FROM s.supplier_id;

-- Repair an upload only when its authenticated uploader maps through one unique company profile
-- and one unique canonical supplier. Already-correct uploads (including AJ Research) are untouched.
WITH proven AS (
 SELECT u.id,s.supplier_id
 FROM public.supplier_stock_uploads u
 JOIN public.supplier_company_profiles p ON p.user_id=u.uploaded_by_user_id
 JOIN public.suppliers s ON s.source_profile_id=p.profile_id
 WHERE (SELECT count(*) FROM public.supplier_company_profiles px WHERE px.user_id=u.uploaded_by_user_id)=1
   AND (SELECT count(*) FROM public.suppliers sx WHERE sx.source_profile_id=p.profile_id)=1
)
UPDATE public.supplier_stock_uploads u SET supplier_id=p.supplier_id
FROM proven p WHERE u.id=p.id AND u.supplier_id IS DISTINCT FROM p.supplier_id;

-- Migration report. Nonzero ambiguous counts require manual review; the migration does not guess.
DO $$ DECLARE v_null_supplier bigint;v_null_uploader bigint;v_mismatch bigint;v_correct bigint; BEGIN
 SELECT count(*) INTO v_null_supplier FROM public.supplier_stock_uploads WHERE supplier_id IS NULL;
 SELECT count(*) INTO v_null_uploader FROM public.supplier_stock_uploads WHERE uploaded_by_user_id IS NULL;
 SELECT count(*) INTO v_correct FROM public.supplier_stock_uploads u JOIN public.supplier_company_profiles p ON p.user_id=u.uploaded_by_user_id JOIN public.suppliers s ON s.source_profile_id=p.profile_id AND s.supplier_id=u.supplier_id;
 SELECT count(*) INTO v_mismatch FROM public.supplier_stock_uploads u WHERE u.supplier_id IS NOT NULL AND u.uploaded_by_user_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.supplier_company_profiles p JOIN public.suppliers s ON s.source_profile_id=p.profile_id WHERE p.user_id=u.uploaded_by_user_id AND s.supplier_id=u.supplier_id);
 RAISE NOTICE 'supplier_stock_uploads report: already/proven correct=%, null supplier requiring review=%, null uploader requiring review=%, unresolved mismatch=%',v_correct,v_null_supplier,v_null_uploader,v_mismatch;
END $$;

-- 3/4. Foreign keys after backfill. Constraint names make partial reruns safe.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='supplier_contacts_canonical_supplier_fkey' AND conrelid='public.supplier_company_contacts'::regclass) THEN ALTER TABLE public.supplier_company_contacts ADD CONSTRAINT supplier_contacts_canonical_supplier_fkey FOREIGN KEY(canonical_supplier_id) REFERENCES public.suppliers(supplier_id) ON DELETE CASCADE; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='supplier_documents_canonical_supplier_fkey' AND conrelid='public.supplier_company_documents'::regclass) THEN ALTER TABLE public.supplier_company_documents ADD CONSTRAINT supplier_documents_canonical_supplier_fkey FOREIGN KEY(canonical_supplier_id) REFERENCES public.suppliers(supplier_id) ON DELETE CASCADE; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='supplier_emails_canonical_supplier_fkey' AND conrelid='public.supplier_contact_emails'::regclass) THEN ALTER TABLE public.supplier_contact_emails ADD CONSTRAINT supplier_emails_canonical_supplier_fkey FOREIGN KEY(canonical_supplier_id) REFERENCES public.suppliers(supplier_id) ON DELETE CASCADE; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='products_source_upload_fkey' AND conrelid='public.products'::regclass) THEN ALTER TABLE public.products ADD CONSTRAINT products_source_upload_fkey FOREIGN KEY(source_upload_id) REFERENCES public.supplier_stock_uploads(id) ON DELETE SET NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='products_source_upload_item_fkey' AND conrelid='public.products'::regclass) THEN ALTER TABLE public.products ADD CONSTRAINT products_source_upload_item_fkey FOREIGN KEY(source_upload_item_id) REFERENCES public.supplier_stock_upload_items(id) ON DELETE SET NULL; END IF;
END $$;

-- New rows cannot omit ownership, while unresolved legacy rows remain available for manual review.
ALTER TABLE public.supplier_stock_uploads DROP CONSTRAINT IF EXISTS supplier_stock_uploads_supplier_required;
ALTER TABLE public.supplier_stock_uploads ADD CONSTRAINT supplier_stock_uploads_supplier_required CHECK(supplier_id IS NOT NULL) NOT VALID;
ALTER TABLE public.supplier_stock_uploads DROP CONSTRAINT IF EXISTS supplier_stock_uploads_uploader_required;
ALTER TABLE public.supplier_stock_uploads ADD CONSTRAINT supplier_stock_uploads_uploader_required CHECK(uploaded_by_user_id IS NOT NULL) NOT VALID;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_canonical_supplier_required;
ALTER TABLE public.products ADD CONSTRAINT products_canonical_supplier_required CHECK(supplier_id IS NOT NULL) NOT VALID;
ALTER TABLE public.verified_supplier DROP CONSTRAINT IF EXISTS verified_supplier_canonical_required;
ALTER TABLE public.verified_supplier ADD CONSTRAINT verified_supplier_canonical_required CHECK(canonical_supplier_id IS NOT NULL) NOT VALID;

-- 5. Uniqueness and query indexes after columns/FKs.
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_source_profile_unique ON public.suppliers(source_profile_id) WHERE source_profile_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS verified_supplier_one_per_canonical_supplier ON public.verified_supplier(canonical_supplier_id) WHERE canonical_supplier_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS products_one_per_source_upload_item ON public.products(source_upload_item_id) WHERE source_upload_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_contacts_canonical ON public.supplier_company_contacts(canonical_supplier_id,is_active);
CREATE INDEX IF NOT EXISTS idx_supplier_documents_canonical ON public.supplier_company_documents(canonical_supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_emails_canonical ON public.supplier_contact_emails(canonical_supplier_id,is_active);

-- products_count has one meaning: active structured products owned by the canonical supplier.
UPDATE public.suppliers s SET products_count=(SELECT count(*) FROM public.products p WHERE p.supplier_id=s.supplier_id AND p.product_status='active');

-- 6. Supplier reads are tied to the authenticated canonical relationship; internal RLS remains intact.
DROP POLICY IF EXISTS "Suppliers select canonical stock uploads" ON public.supplier_stock_uploads;
CREATE POLICY "Suppliers select canonical stock uploads" ON public.supplier_stock_uploads FOR SELECT TO authenticated USING (
 uploaded_by_user_id=auth.uid() AND EXISTS(SELECT 1 FROM public.supplier_company_profiles p JOIN public.suppliers s ON s.source_profile_id=p.profile_id WHERE p.user_id=auth.uid() AND s.supplier_id=supplier_stock_uploads.supplier_id));
DROP POLICY IF EXISTS "Internal users select supplier stock uploads" ON public.supplier_stock_uploads;
CREATE POLICY "Internal users select supplier stock uploads" ON public.supplier_stock_uploads FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.user_profiles u WHERE u.id=auth.uid() AND u.role IN ('admin','support')));
DROP POLICY IF EXISTS "Internal users select supplier stock upload items" ON public.supplier_stock_upload_items;
CREATE POLICY "Internal users select supplier stock upload items" ON public.supplier_stock_upload_items FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.user_profiles u WHERE u.id=auth.uid() AND u.role IN ('admin','support')));

-- 7. Refresh API schema only after the complete migration.
NOTIFY pgrst, 'reload schema';
