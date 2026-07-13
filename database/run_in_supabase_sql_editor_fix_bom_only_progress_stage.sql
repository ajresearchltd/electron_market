-- Run manually in Supabase SQL Editor.
-- This file contains executable SQL only.
-- Do NOT paste Codex prompts, reports, file names, or markdown into Supabase SQL Editor.
-- Electron Market - Reset BOM-only progress records to the initial BOM received stage.

UPDATE public.procurement_progress
SET
  current_stage = 'bom_received',
  current_stage_label = 'BOM received',
  rfq_sent_at = null,
  quote_received_at = null,
  approved_at = null,
  payment_at = null,
  goods_shipped_at = null,
  goods_received_at = null,
  order_completed_at = null,
  updated_at = now()
WHERE customer_bom_upload_id IS NOT NULL
  AND rfq_id IS NULL
  AND quote_id IS NULL
  AND active_order_id IS NULL
  AND current_stage <> 'bom_received';

NOTIFY pgrst, 'reload schema';
