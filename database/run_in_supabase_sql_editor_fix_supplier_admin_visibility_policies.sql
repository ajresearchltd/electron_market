-- Electron Market - Admin visibility helper for supplier company profiles and documents.
-- Run manually in Supabase SQL Editor if Admin Control Center cannot see newly
-- saved supplier company profiles or cannot open supplier uploaded files.

DROP POLICY IF EXISTS "Admins can select supplier company profiles" ON public.supplier_company_profiles;
CREATE POLICY "Admins can select supplier company profiles"
  ON public.supplier_company_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update supplier company profiles" ON public.supplier_company_profiles;
CREATE POLICY "Admins can update supplier company profiles"
  ON public.supplier_company_profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can select supplier company contacts" ON public.supplier_company_contacts;
CREATE POLICY "Admins can select supplier company contacts"
  ON public.supplier_company_contacts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can select supplier company documents" ON public.supplier_company_documents;
CREATE POLICY "Admins can select supplier company documents"
  ON public.supplier_company_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can read supplier company document files" ON storage.objects;
CREATE POLICY "Admins can read supplier company document files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'supplier-company-documents'
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

NOTIFY pgrst, 'reload schema';
