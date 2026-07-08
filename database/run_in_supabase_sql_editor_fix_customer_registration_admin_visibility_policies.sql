-- Electron Market - Customer registration/admin visibility policy helper.
-- Run manually in Supabase SQL Editor only if customer registration cannot create
-- customer_company_profiles rows or admins cannot see customer RFQ BOM files.

DROP POLICY IF EXISTS "Users can insert own customer company profile" ON public.customer_company_profiles;
CREATE POLICY "Users can insert own customer company profile"
  ON public.customer_company_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can select rfq bom files" ON public.rfq_bom_files;
CREATE POLICY "Admins can select rfq bom files"
  ON public.rfq_bom_files
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

NOTIFY pgrst, 'reload schema';
