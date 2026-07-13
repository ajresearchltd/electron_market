-- Run manually in Supabase SQL Editor.
-- This file contains executable SQL only.
-- Do NOT paste Codex prompts, reports, file names, or markdown into Supabase SQL Editor.
-- Electron Market - Optional Customer BOM part number verification fields.

ALTER TABLE public.customer_bom_upload_items
  ADD COLUMN IF NOT EXISTS part_number_check_confidence numeric,
  ADD COLUMN IF NOT EXISTS part_number_matched_mpn text,
  ADD COLUMN IF NOT EXISTS part_number_matched_manufacturer text,
  ADD COLUMN IF NOT EXISTS part_number_matched_description text,
  ADD COLUMN IF NOT EXISTS part_number_datasheet_url text,
  ADD COLUMN IF NOT EXISTS part_number_verification_raw_json jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS part_number_verified_at timestamptz;

NOTIFY pgrst, 'reload schema';
