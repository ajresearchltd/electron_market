export function normalizeInvoiceStatus(invoice: {invoice_status?:unknown; status?:unknown; paid_boolean?:unknown; paid?:unknown}) {
  const canonical=String(invoice.invoice_status??invoice.status??'draft').trim().toLowerCase().replace(/\s+/g,'_');
  if(canonical==='paid'||invoice.paid_boolean===true||invoice.paid===true)return 'paid';
  return canonical||'draft';
}
