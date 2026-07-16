import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { requireInternalApi } from '../../../../../../lib/auth/require-internal-api';
import { evaluateRfqForInvoice } from '../../../../../../lib/procurement-workflow';

export async function POST(request: Request, { params }: { params: Promise<{ rfqId: string }> }) {
  const auth = await requireInternalApi(); if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const rfqId = (await params).rfqId; const body = await request.json().catch(() => ({}));
  const evaluation = await evaluateRfqForInvoice(auth.admin, rfqId);
  if ('error' in evaluation) return NextResponse.json({ error: evaluation.error }, { status: evaluation.status });
  if (!evaluation.data.ready) return NextResponse.json({ error: 'Invoice conversion criteria are not satisfied.', blockers: evaluation.data.blockers }, { status: 422 });
  const idempotencyKey = String(body.idempotencyKey ?? `rfq-invoice:${rfqId}:${randomUUID()}`);
  const result = await auth.admin.rpc('create_draft_invoice_from_rfq', { p_rfq_id: rfqId, p_actor_id: auth.user.id, p_execution_mode: 'manual', p_idempotency_key: idempotencyKey });
  if (result.error) { const status = result.error.code === '22023' ? 422 : result.error.code === 'P0002' ? 404 : result.error.code === '42501' ? 403 : 500; return NextResponse.json({ error: status === 422 ? result.error.message : 'Draft Invoice could not be created.', blockers: status === 422 ? evaluation.data.blockers : undefined }, { status }); }
  const invoice = Array.isArray(result.data) ? result.data[0] : result.data;
  return NextResponse.json({ invoice: { id: invoice.invoice_id, procurementChainId: invoice.procurement_chain_id, procurementNumber: invoice.procurement_number, status: 'draft' }, created: invoice.created, includedCount: invoice.included_count, openCount: invoice.open_count, navigationUrl: `/admin/procurement-progress/${invoice.procurement_chain_id}#invoice` }, { status: invoice.created ? 201 : 200 });
}
