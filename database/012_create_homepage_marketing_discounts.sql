CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Electron Market - Homepage marketing discount promo cards.
-- Creates a public-read table for active homepage promotional offers.

CREATE TABLE IF NOT EXISTS public.homepage_marketing_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text,
  title text NOT NULL,
  subtitle text,
  image_url text NOT NULL,
  discount_text text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.homepage_marketing_discounts
  ADD COLUMN IF NOT EXISTS company_name text;

ALTER TABLE public.homepage_marketing_discounts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_homepage_marketing_discounts_active_order
  ON public.homepage_marketing_discounts(is_active, sort_order);

CREATE OR REPLACE FUNCTION public.set_homepage_marketing_discounts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS homepage_marketing_discounts_set_updated_at ON public.homepage_marketing_discounts;
CREATE TRIGGER homepage_marketing_discounts_set_updated_at
BEFORE UPDATE ON public.homepage_marketing_discounts
FOR EACH ROW
EXECUTE FUNCTION public.set_homepage_marketing_discounts_updated_at();

DROP POLICY IF EXISTS "Anyone can select active homepage marketing discounts" ON public.homepage_marketing_discounts;
CREATE POLICY "Anyone can select active homepage marketing discounts"
  ON public.homepage_marketing_discounts
  FOR SELECT
  TO public
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can select homepage marketing discounts" ON public.homepage_marketing_discounts;
CREATE POLICY "Admins can select homepage marketing discounts"
  ON public.homepage_marketing_discounts
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

DROP POLICY IF EXISTS "Admins can insert homepage marketing discounts" ON public.homepage_marketing_discounts;
CREATE POLICY "Admins can insert homepage marketing discounts"
  ON public.homepage_marketing_discounts
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

DROP POLICY IF EXISTS "Admins can update homepage marketing discounts" ON public.homepage_marketing_discounts;
CREATE POLICY "Admins can update homepage marketing discounts"
  ON public.homepage_marketing_discounts
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

INSERT INTO public.homepage_marketing_discounts (company_name, title, subtitle, image_url, discount_text, sort_order, is_active)
SELECT company_name, title, subtitle, image_url, discount_text, sort_order, is_active
FROM (
  VALUES
    ('ElectroMarket Deals', 'Microcontrollers', 'Bulk MCU sourcing deals', '/reference/ai_bom.png', '15% OFF', 1, true),
    ('Power Partner', 'Power Modules', 'Compact power solutions', '/reference/friz_1.jpg', '20% OFF', 2, true),
    ('Sensor Hub', 'Sensors', 'Motion and monitoring parts', '/reference/ver_pro.png', '10% OFF', 3, true),
    ('Connector Source', 'Connectors', 'Board and cable inventory', '/reference/friz_1.jpg', '25% OFF', 4, true),
    ('Industrial Supply', 'Industrial Boards', 'Factory-ready controller stock', '/reference/ai_bom.png', '12% OFF', 5, true),
    ('Wireless Lab', 'Wireless Modules', 'IoT and RF component offers', '/reference/ver_pro.png', '18% OFF', 6, true)
) AS seed_rows(company_name, title, subtitle, image_url, discount_text, sort_order, is_active)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.homepage_marketing_discounts existing
  WHERE existing.title = seed_rows.title
);

NOTIFY pgrst, 'reload schema';
