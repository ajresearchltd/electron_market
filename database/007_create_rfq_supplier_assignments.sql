CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Electron Market - Manual admin RFQ assignment to suppliers.
-- Run manually in Supabase SQL Editor. This file creates only the assignment structure.

CREATE TABLE IF NOT EXISTS public.rfq_supplier_assignments (
  assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.rfq_orders0(rfq_id) ON DELETE CASCADE,
  order_number text NOT NULL,
  supplier_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_company_name text,
  assigned_by_admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assignment_status text NOT NULL DEFAULT 'assigned',
  supplier_viewed_at timestamptz,
  quote_id uuid REFERENCES public.supplier_quotes0(quote_id) ON DELETE SET NULL,
  admin_notes text,
  supplier_notes text,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rfq_supplier_assignments_unique_supplier UNIQUE (rfq_id, supplier_id),
  CONSTRAINT rfq_supplier_assignments_status_check
    CHECK (assignment_status IN ('assigned', 'viewed', 'quote_sent', 'declined', 'expired', 'cancelled'))
);

ALTER TABLE public.rfq_supplier_assignments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_rfq_supplier_assignments_order_number
  ON public.rfq_supplier_assignments(order_number);
CREATE INDEX IF NOT EXISTS idx_rfq_supplier_assignments_rfq_id
  ON public.rfq_supplier_assignments(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_supplier_assignments_supplier_id
  ON public.rfq_supplier_assignments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_rfq_supplier_assignments_assignment_status
  ON public.rfq_supplier_assignments(assignment_status);
CREATE INDEX IF NOT EXISTS idx_rfq_supplier_assignments_assigned_at
  ON public.rfq_supplier_assignments(assigned_at);

CREATE OR REPLACE FUNCTION public.set_rfq_supplier_assignments_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rfq_supplier_assignments_set_updated_at ON public.rfq_supplier_assignments;
CREATE TRIGGER rfq_supplier_assignments_set_updated_at
BEFORE UPDATE ON public.rfq_supplier_assignments
FOR EACH ROW
EXECUTE FUNCTION public.set_rfq_supplier_assignments_updated_at();

-- Supplier update policy allows updates on the supplier's own assignment row.
-- Review column-level restrictions before production if suppliers should only update viewed/notes fields.
DROP POLICY IF EXISTS "Suppliers can select own rfq assignments" ON public.rfq_supplier_assignments;
CREATE POLICY "Suppliers can select own rfq assignments"
  ON public.rfq_supplier_assignments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = supplier_id);

DROP POLICY IF EXISTS "Suppliers can update own rfq assignments" ON public.rfq_supplier_assignments;
CREATE POLICY "Suppliers can update own rfq assignments"
  ON public.rfq_supplier_assignments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = supplier_id)
  WITH CHECK (auth.uid() = supplier_id);

DROP POLICY IF EXISTS "Admins can select rfq assignments" ON public.rfq_supplier_assignments;
CREATE POLICY "Admins can select rfq assignments"
  ON public.rfq_supplier_assignments
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

DROP POLICY IF EXISTS "Admins can insert rfq assignments" ON public.rfq_supplier_assignments;
CREATE POLICY "Admins can insert rfq assignments"
  ON public.rfq_supplier_assignments
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

DROP POLICY IF EXISTS "Admins can update rfq assignments" ON public.rfq_supplier_assignments;
CREATE POLICY "Admins can update rfq assignments"
  ON public.rfq_supplier_assignments
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

DROP POLICY IF EXISTS "Admins can delete rfq assignments" ON public.rfq_supplier_assignments;
CREATE POLICY "Admins can delete rfq assignments"
  ON public.rfq_supplier_assignments
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
