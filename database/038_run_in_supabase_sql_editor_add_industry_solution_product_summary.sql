-- Manual Supabase SQL Editor migration. Do not execute automatically.
ALTER TABLE public.industry_solution
  ADD COLUMN IF NOT EXISTS product_summary text NULL;

ALTER TABLE public.industry_solution
  DROP CONSTRAINT IF EXISTS industry_solution_product_summary_length_check;

ALTER TABLE public.industry_solution
  ADD CONSTRAINT industry_solution_product_summary_length_check
  CHECK (product_summary IS NULL OR char_length(product_summary) <= 80);
