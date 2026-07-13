-- Electron Market - Supplier stock upload column mapping metadata.
-- Run manually in Supabase SQL Editor before storing upload-level column mapping results.

ALTER TABLE public.supplier_stock_uploads
  ADD COLUMN IF NOT EXISTS column_mapping jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS main_column_mapping jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS secondary_column_mapping jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS unmapped_columns jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS column_mapping_confidence jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS column_mapping_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS column_mapping_warnings jsonb DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
