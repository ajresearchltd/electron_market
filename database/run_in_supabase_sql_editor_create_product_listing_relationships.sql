-- Run manually in Supabase SQL Editor.
-- Electron Market - canonical relationships used by public product listing pages.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category_id uuid NULL REFERENCES public.category(cat_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);

-- Safely backfill only exact, case-insensitive category-name matches.
UPDATE public.products AS product
SET category_id = category.cat_id
FROM public.category AS category
WHERE product.category_id IS NULL
  AND product.category IS NOT NULL
  AND lower(trim(product.category)) = lower(trim(category.name));

CREATE TABLE IF NOT EXISTS public.product_special_offers (
  product_id uuid NOT NULL REFERENCES public.products(product_id) ON DELETE CASCADE,
  offer_id uuid NOT NULL REFERENCES public.homepage_marketing_discounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, offer_id)
);

CREATE TABLE IF NOT EXISTS public.product_industry_solutions (
  product_id uuid NOT NULL REFERENCES public.products(product_id) ON DELETE CASCADE,
  industry_solution_id uuid NOT NULL REFERENCES public.industry_solution(ind_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, industry_solution_id)
);

ALTER TABLE public.verified_supplier
  ADD COLUMN IF NOT EXISTS canonical_supplier_id uuid NULL REFERENCES public.suppliers(supplier_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_verified_supplier_canonical_supplier_id
  ON public.verified_supplier(canonical_supplier_id);
CREATE INDEX IF NOT EXISTS idx_product_special_offers_offer_id
  ON public.product_special_offers(offer_id);
CREATE INDEX IF NOT EXISTS idx_product_industry_solutions_solution_id
  ON public.product_industry_solutions(industry_solution_id);

ALTER TABLE public.product_special_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_industry_solutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can select product special offers" ON public.product_special_offers;
CREATE POLICY "Anyone can select product special offers" ON public.product_special_offers
  FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Admins can manage product special offers" ON public.product_special_offers;
CREATE POLICY "Admins can manage product special offers" ON public.product_special_offers
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Anyone can select product industry solutions" ON public.product_industry_solutions;
CREATE POLICY "Anyone can select product industry solutions" ON public.product_industry_solutions
  FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Admins can manage product industry solutions" ON public.product_industry_solutions;
CREATE POLICY "Admins can manage product industry solutions" ON public.product_industry_solutions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

NOTIFY pgrst, 'reload schema';
