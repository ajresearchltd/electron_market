import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '../../../../../../lib/supabase/server';
import { createAdminClient } from '../../../../../../lib/supabase/admin';
import { evaluateRfqForInvoice } from '../../../../../../lib/procurement-workflow';
import { sendTestInvoiceEmail } from '../../../../../../lib/email/invoice-email';
import { invoiceAutoSendEnabled } from '../../../../../../lib/email/smtp';

export async function POST(request: Request, { params }: { params: Promise<{ rfqId: string }> }) {
  const { rfqId } = await params;
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 });
  const db = createAdminClient();
  if (!db) return NextResponse.json({ error: 'Invoice creation is unavailable.' }, { status: 503 });
  const rfq = await db.from('rfq_orders0').select('customer_id,procurement_chain_id').eq('rfq_id', rfqId).maybeSingle();
  if (!rfq.data) return NextResponse.json({ error: 'RFQ not found.' }, { status: 404 });
  if (rfq.data.customer_id !== user.id) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  const evaluation = await evaluateRfqForInvoice(db, rfqId);
  if ('error' in evaluation) return NextResponse.json({ error: evaluation.error }, { status: evaluation.status });
  if (!evaluation.data.ready) return NextResponse.json({ error: 'Approve at least one Invoice-eligible supplier offer.', blockers: evaluation.data.blockers }, { status: 422 });
  const body = await request.json().catch(() => ({}));
  const reviewedValues = body?.reviewedValues && typeof body.reviewedValues === 'object' ? body.reviewedValues : {};
  const suppliedKey = String(body?.idempotencyKey ?? '').trim();
  const idempotencyKey = suppliedKey || `customer:${rfqId}:${randomUUID()}`;
  const result = await db.rpc('create_draft_invoice_from_rfq', { p_rfq_id: rfqId, p_actor_id: user.id, p_execution_mode: 'manual', p_idempotency_key: idempotencyKey, p_reviewed_values: reviewedValues });
  if (result.error) {
    const status = result.error.code === '42501' ? 403 : result.error.code === '22023' ? 422 : result.error.code === '23505' || result.error.code === '23503' ? 409 : 500;
    console.error('Customer Draft Invoice RPC failed:', { code: result.error.code });
    return NextResponse.json({ error: status < 500 ? result.error.message : 'Invoice could not be created.' }, { status });
  }
  const invoice = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!invoice?.invoice_id || invoice.included_count < 1) return NextResponse.json({ error: 'Invoice could not be created: the database returned no canonical Invoice.' }, { status: 500 });
  const emailDelivery = invoice.created && invoiceAutoSendEnabled() ? await sendTestInvoiceEmail(db, invoice.invoice_id) : { status: 'not_attempted', recipient: null, messageId: null, error: null, invoiceNumber: null };
  return NextResponse.json({ invoice: { id: invoice.invoice_id, invoiceNumber: emailDelivery.invoiceNumber, procurementChainId: invoice.procurement_chain_id, procurementNumber: invoice.procurement_number, created: invoice.created }, emailDelivery, created: invoice.created, includedCount: invoice.included_count, openCount: invoice.open_count, navigationUrl: `/customer/progress/${rfq.data.procurement_chain_id}` }, { status: invoice.created ? 201 : 200 });
}
