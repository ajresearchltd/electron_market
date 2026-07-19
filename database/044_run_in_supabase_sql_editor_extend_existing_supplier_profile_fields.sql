-- Manual Supabase SQL Editor migration. Do not run automatically.
-- Phase 2 only: extend existing supplier profile and approved public snapshot tables.
-- No tables, broad grants, RLS policies, supplier links, or existing data are changed.

ALTER TABLE public.supplier_company_profiles
  ADD COLUMN IF NOT EXISTS supported_languages text[] NULL,
  ADD COLUMN IF NOT EXISTS minimum_order_value numeric NULL,
  ADD COLUMN IF NOT EXISTS minimum_order_currency text NULL,
  ADD COLUMN IF NOT EXISTS typical_lead_time_min_days integer NULL,
  ADD COLUMN IF NOT EXISTS typical_lead_time_max_days integer NULL,
  ADD COLUMN IF NOT EXISTS response_time_hours integer NULL,
  ADD COLUMN IF NOT EXISTS public_incoterms text[] NULL,
  ADD COLUMN IF NOT EXISTS public_payment_terms text NULL,
  ADD COLUMN IF NOT EXISTS manufacturing_capabilities text[] NULL,
  ADD COLUMN IF NOT EXISTS engineering_capabilities text[] NULL,
  ADD COLUMN IF NOT EXISTS testing_capabilities text[] NULL,
  ADD COLUMN IF NOT EXISTS quality_control_capabilities text[] NULL,
  ADD COLUMN IF NOT EXISTS custom_sourcing_capabilities text[] NULL,
  ADD COLUMN IF NOT EXISTS additional_capabilities text[] NULL,
  ADD COLUMN IF NOT EXISTS public_profile_status text NOT NULL DEFAULT 'draft';

-- Approved public snapshot fields. These are populated only by a future Admin
-- approval workflow; adding the storage contract does not publish profile data.
ALTER TABLE public.verified_supplier
  ADD COLUMN IF NOT EXISTS supported_languages text[] NULL,
  ADD COLUMN IF NOT EXISTS employee_count integer NULL,
  ADD COLUMN IF NOT EXISTS minimum_order_value numeric NULL,
  ADD COLUMN IF NOT EXISTS minimum_order_currency text NULL,
  ADD COLUMN IF NOT EXISTS typical_lead_time_min_days integer NULL,
  ADD COLUMN IF NOT EXISTS typical_lead_time_max_days integer NULL,
  ADD COLUMN IF NOT EXISTS response_time_hours integer NULL,
  ADD COLUMN IF NOT EXISTS public_incoterms text[] NULL,
  ADD COLUMN IF NOT EXISTS preferred_currencies text NULL,
  ADD COLUMN IF NOT EXISTS public_payment_terms text NULL,
  ADD COLUMN IF NOT EXISTS regions_served text NULL,
  ADD COLUMN IF NOT EXISTS delivery_countries text NULL,
  ADD COLUMN IF NOT EXISTS manufacturing_capabilities text[] NULL,
  ADD COLUMN IF NOT EXISTS engineering_capabilities text[] NULL,
  ADD COLUMN IF NOT EXISTS testing_capabilities text[] NULL,
  ADD COLUMN IF NOT EXISTS quality_control_capabilities text[] NULL,
  ADD COLUMN IF NOT EXISTS custom_sourcing_capabilities text[] NULL,
  ADD COLUMN IF NOT EXISTS additional_capabilities text[] NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.supplier_company_profiles'::regclass AND conname='supplier_company_profiles_public_profile_status_check') THEN
    ALTER TABLE public.supplier_company_profiles ADD CONSTRAINT supplier_company_profiles_public_profile_status_check
      CHECK (public_profile_status IN ('draft','pending_review','approved','rejected','suspended'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.supplier_company_profiles'::regclass AND conname='supplier_company_profiles_minimum_order_check') THEN
    ALTER TABLE public.supplier_company_profiles ADD CONSTRAINT supplier_company_profiles_minimum_order_check CHECK (minimum_order_value IS NULL OR minimum_order_value >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.supplier_company_profiles'::regclass AND conname='supplier_company_profiles_minimum_order_currency_check') THEN
    ALTER TABLE public.supplier_company_profiles ADD CONSTRAINT supplier_company_profiles_minimum_order_currency_check CHECK (minimum_order_currency IS NULL OR minimum_order_currency ~ '^[A-Z]{3}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.supplier_company_profiles'::regclass AND conname='supplier_company_profiles_lead_time_check') THEN
    ALTER TABLE public.supplier_company_profiles ADD CONSTRAINT supplier_company_profiles_lead_time_check CHECK (
      (typical_lead_time_min_days IS NULL OR typical_lead_time_min_days >= 0) AND
      (typical_lead_time_max_days IS NULL OR typical_lead_time_max_days >= 0) AND
      (typical_lead_time_min_days IS NULL OR typical_lead_time_max_days IS NULL OR typical_lead_time_min_days <= typical_lead_time_max_days)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.supplier_company_profiles'::regclass AND conname='supplier_company_profiles_response_time_check') THEN
    ALTER TABLE public.supplier_company_profiles ADD CONSTRAINT supplier_company_profiles_response_time_check CHECK (response_time_hours IS NULL OR response_time_hours >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.supplier_company_profiles'::regclass AND conname='supplier_company_profiles_public_array_limits_check') THEN
    ALTER TABLE public.supplier_company_profiles ADD CONSTRAINT supplier_company_profiles_public_array_limits_check CHECK (
      coalesce(cardinality(supported_languages),0) <= 20 AND coalesce(cardinality(public_incoterms),0) <= 20 AND
      coalesce(cardinality(manufacturing_capabilities),0) <= 30 AND coalesce(cardinality(engineering_capabilities),0) <= 30 AND
      coalesce(cardinality(testing_capabilities),0) <= 30 AND coalesce(cardinality(quality_control_capabilities),0) <= 30 AND
      coalesce(cardinality(custom_sourcing_capabilities),0) <= 30 AND coalesce(cardinality(additional_capabilities),0) <= 30
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.verified_supplier'::regclass AND conname='verified_supplier_public_commercial_terms_check') THEN
    ALTER TABLE public.verified_supplier ADD CONSTRAINT verified_supplier_public_commercial_terms_check CHECK (
      (employee_count IS NULL OR employee_count >= 0) AND
      (minimum_order_value IS NULL OR minimum_order_value >= 0) AND
      (minimum_order_currency IS NULL OR minimum_order_currency ~ '^[A-Z]{3}$') AND
      (typical_lead_time_min_days IS NULL OR typical_lead_time_min_days >= 0) AND
      (typical_lead_time_max_days IS NULL OR typical_lead_time_max_days >= 0) AND
      (typical_lead_time_min_days IS NULL OR typical_lead_time_max_days IS NULL OR typical_lead_time_min_days <= typical_lead_time_max_days) AND
      (response_time_hours IS NULL OR response_time_hours >= 0)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.verified_supplier'::regclass AND conname='verified_supplier_public_array_limits_check') THEN
    ALTER TABLE public.verified_supplier ADD CONSTRAINT verified_supplier_public_array_limits_check CHECK (
      coalesce(cardinality(supported_languages),0) <= 20 AND coalesce(cardinality(public_incoterms),0) <= 20 AND
      coalesce(cardinality(manufacturing_capabilities),0) <= 30 AND coalesce(cardinality(engineering_capabilities),0) <= 30 AND
      coalesce(cardinality(testing_capabilities),0) <= 30 AND coalesce(cardinality(quality_control_capabilities),0) <= 30 AND
      coalesce(cardinality(custom_sourcing_capabilities),0) <= 30 AND coalesce(cardinality(additional_capabilities),0) <= 30
    );
  END IF;
END $$;

-- Only indexes justified by planned controlled-string filters are added now.
CREATE INDEX IF NOT EXISTS idx_supplier_company_profiles_public_profile_status
  ON public.supplier_company_profiles(public_profile_status);
CREATE INDEX IF NOT EXISTS idx_supplier_company_profiles_supported_languages
  ON public.supplier_company_profiles USING gin(supported_languages);
CREATE INDEX IF NOT EXISTS idx_supplier_company_profiles_public_incoterms
  ON public.supplier_company_profiles USING gin(public_incoterms);

NOTIFY pgrst, 'reload schema';
