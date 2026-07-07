CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Electron Market - Customer company profile records for existing authenticated customer users.

CREATE TABLE IF NOT EXISTS public.customer_company_profiles (
  customer_profile_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text,
  business_registration_number text,
  country_iso2 text,
  country_name text,
  contact_name text,
  contact_email text,
  contact_phone text,
  website text,
  company_address text,
  customer_notes text,
  customer_status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_company_profiles ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_customer_company_profiles_user_id
  ON public.customer_company_profiles(user_id);

CREATE OR REPLACE FUNCTION public.set_customer_company_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customer_company_profiles_set_updated_at ON public.customer_company_profiles;
CREATE TRIGGER customer_company_profiles_set_updated_at
BEFORE UPDATE ON public.customer_company_profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_customer_company_profiles_updated_at();

DROP POLICY IF EXISTS "Users can select own customer company profile" ON public.customer_company_profiles;
CREATE POLICY "Users can select own customer company profile"
  ON public.customer_company_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own customer company profile" ON public.customer_company_profiles;
CREATE POLICY "Users can update own customer company profile"
  ON public.customer_company_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can select customer company profiles" ON public.customer_company_profiles;
CREATE POLICY "Admins can select customer company profiles"
  ON public.customer_company_profiles
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

DROP POLICY IF EXISTS "Admins can insert customer company profiles" ON public.customer_company_profiles;
CREATE POLICY "Admins can insert customer company profiles"
  ON public.customer_company_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update customer company profiles" ON public.customer_company_profiles;
CREATE POLICY "Admins can update customer company profiles"
  ON public.customer_company_profiles
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

DROP POLICY IF EXISTS "Admins can delete customer company profiles" ON public.customer_company_profiles;
CREATE POLICY "Admins can delete customer company profiles"
  ON public.customer_company_profiles
  FOR DELETE
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
