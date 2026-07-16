-- Manual Supabase SQL Editor migration. Do not run automatically.
-- Preserves product-match evidence and deterministic quantity coverage independently of commercial completeness.

ALTER TABLE public.supplier_response_items
  ADD COLUMN IF NOT EXISTS original_product_name text NULL,
  ADD COLUMN IF NOT EXISTS normalized_offered_mpn text NULL,
  ADD COLUMN IF NOT EXISTS product_type text NULL,
  ADD COLUMN IF NOT EXISTS technical_parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS commercial_terms jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS technical_similarities jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS technical_differences jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS review_reason text NULL,
  ADD COLUMN IF NOT EXISTS quantity_coverage_status text NULL
    CHECK (quantity_coverage_status IS NULL OR quantity_coverage_status IN ('full','partial','quantity_unknown')),
  ADD COLUMN IF NOT EXISTS covered_quantity numeric NULL CHECK (covered_quantity IS NULL OR covered_quantity >= 0),
  ADD COLUMN IF NOT EXISTS uncovered_quantity numeric NULL CHECK (uncovered_quantity IS NULL OR uncovered_quantity >= 0),
  ADD COLUMN IF NOT EXISTS sourcing_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS commercial_review_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS missing_commercial_fields jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS supplier_response_items_rfq_match_idx
  ON public.supplier_response_items(rfq_id, rfq_item_id, is_current);

NOTIFY pgrst, 'reload schema';
