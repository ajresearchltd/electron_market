-- Electron Market - Safe product table additions for Supplier Add Product form.
-- Run manually in Supabase SQL Editor before using the full supplier product form.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS compare_at_price numeric,
  ADD COLUMN IF NOT EXISTS discount_percent numeric,
  ADD COLUMN IF NOT EXISTS stock_quantity integer,
  ADD COLUMN IF NOT EXISTS unit_type text,
  ADD COLUMN IF NOT EXISTS rohs_compliant boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reach_compliant boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS certification_text text,
  ADD COLUMN IF NOT EXISTS product_video_url text,
  ADD COLUMN IF NOT EXISTS product_video_description text,
  ADD COLUMN IF NOT EXISTS tags text,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS alt_text text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.product_specifications
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

ALTER TABLE public.product_documents
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

NOTIFY pgrst, 'reload schema';
