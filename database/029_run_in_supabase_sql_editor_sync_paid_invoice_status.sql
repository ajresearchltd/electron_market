-- Manual Supabase SQL Editor migration. Do not run automatically.
-- Repairs only canonical Invoices already marked paid by payment-document upload.

UPDATE public.procurement_invoices AS pi
SET invoice_status = 'paid',
    payment_status = 'paid',
    updated_at = now()
WHERE pi.paid_boolean = true
  AND lower(coalesce(pi.invoice_status, '')) <> 'paid';

NOTIFY pgrst, 'reload schema';
