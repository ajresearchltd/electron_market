-- Manual Supabase SQL Editor migration. Do not run automatically.
-- Phase 10 correction: align the canonical Procurement role and make explicit
-- Product Finder Support authorization usable from RLS without exposing rows.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.user_profiles'::regclass
      AND conname = 'user_profiles_role_check'
      AND contype = 'c'
  ) THEN
    RAISE EXCEPTION 'Expected CHECK constraint public.user_profiles.user_profiles_role_check was not found.';
  END IF;

  -- Procurement is the canonical lowercase role used by the Product Finder.
  -- Preserve every role accepted by the existing application contract.
  ALTER TABLE public.user_profiles
    DROP CONSTRAINT user_profiles_role_check;
  ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_role_check
    CHECK (role IN ('customer', 'supplier', 'admin', 'support', 'procurement'));
END
$$;

-- This helper avoids the nested-RLS failure from migration 045. It accepts no
-- actor identifier, returns no authorization details, and evaluates only the
-- current authenticated user's active Product Finder authorization.
CREATE OR REPLACE FUNCTION public.product_finder_current_user_has_support_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    -- Replaces the invalid reserved-alias expression: authorization.user_id = auth.uid().
    FROM public.product_finder_internal_authorizations AS authz
    WHERE authz.user_id = auth.uid()
      AND authz.can_access_discovery IS TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.product_finder_current_user_has_support_access() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.product_finder_current_user_has_support_access() FROM anon;
GRANT EXECUTE ON FUNCTION public.product_finder_current_user_has_support_access() TO authenticated;

-- Replace the migration 045 confidential-read policies. Customer ownership and
-- Customer-safe candidate policies are intentionally unchanged.
DROP POLICY IF EXISTS "Internal users read product searches" ON public.product_search_sessions;
CREATE POLICY "Internal users read product searches"
ON public.product_search_sessions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles AS profile
    WHERE profile.id = auth.uid()
      AND (
        profile.role IN ('admin', 'procurement')
        OR (profile.role = 'support' AND public.product_finder_current_user_has_support_access())
      )
  )
);

DROP POLICY IF EXISTS "Authorized internal users manage supplier discovery" ON public.product_supplier_candidates;
CREATE POLICY "Authorized internal users read supplier discovery"
ON public.product_supplier_candidates FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles AS profile
    WHERE profile.id = auth.uid()
      AND (
        profile.role IN ('admin', 'procurement')
        OR (profile.role = 'support' AND public.product_finder_current_user_has_support_access())
      )
  )
);
CREATE POLICY "Admin and Procurement manage supplier discovery"
ON public.product_supplier_candidates FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_profiles AS profile WHERE profile.id = auth.uid() AND profile.role IN ('admin', 'procurement')))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles AS profile WHERE profile.id = auth.uid() AND profile.role IN ('admin', 'procurement')));

DROP POLICY IF EXISTS "Internal users manage sourcing outreach" ON public.product_sourcing_outreach;
CREATE POLICY "Authorized internal users read sourcing outreach"
ON public.product_sourcing_outreach FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles AS profile
    WHERE profile.id = auth.uid()
      AND (
        profile.role IN ('admin', 'procurement')
        OR (profile.role = 'support' AND public.product_finder_current_user_has_support_access())
      )
  )
);
CREATE POLICY "Admin and Procurement manage sourcing outreach"
ON public.product_sourcing_outreach FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_profiles AS profile WHERE profile.id = auth.uid() AND profile.role IN ('admin', 'procurement')))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles AS profile WHERE profile.id = auth.uid() AND profile.role IN ('admin', 'procurement')));

DROP POLICY IF EXISTS "Authorized internal users read product search audit" ON public.product_search_events;
CREATE POLICY "Authorized internal users read product search audit"
ON public.product_search_events FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles AS profile
    WHERE profile.id = auth.uid()
      AND (
        profile.role IN ('admin', 'procurement')
        OR (profile.role = 'support' AND public.product_finder_current_user_has_support_access())
      )
  )
);

-- Authorization records remain Admin-only; Support receives only the helper's
-- boolean decision and can neither list nor inspect authorization rows.
NOTIFY pgrst, 'reload schema';
