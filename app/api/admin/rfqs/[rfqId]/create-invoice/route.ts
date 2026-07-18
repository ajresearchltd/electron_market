import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { requireInternalApi } from '../../../../../../lib/auth/require-internal-api';
import { evaluateNewInvoiceReadiness } from '../../../../../../lib/invoices/new-invoice-readiness';

export async function POST(request: Request, { params }: { params: Promise<{ rfqId: string }> }) {
  const auth = await requireInternalApi(); if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const rfqId = (await params).rfqId; const body = await request.json().catch(() => ({}));
  if(auth.role!=='admin')return NextResponse.json({error:'Only an Admin may create an Invoice.'},{status:403});
  const evaluation = await evaluateNewInvoiceReadiness(auth.admin, rfqId);
  if ('error' in evaluation) return NextResponse.json({ error: evaluation.error }, { status: evaluation.status });
  if (!evaluation.data.ready) return NextResponse.json({ error: evaluation.data.message, readiness:evaluation.data }, { status: 422 });
  const suppliedKey=String(body.idempotencyKey??'').trim();const idempotencyKey=suppliedKey||`rfq-invoice:${rfqId}:${randomUUID()}`;
  if(idempotencyKey.length>200)return NextResponse.json({error:'Invalid idempotency key.'},{status:400});
  const result = await auth.admin.rpc('create_draft_invoice_from_rfq', { p_rfq_id: rfqId, p_actor_id: auth.user.id, p_execution_mode: 'manual', p_idempotency_key: idempotencyKey });
  if (result.error) { const status = result.error.code === '22023' ? 422 : result.error.code === 'P0002' ? 404 : result.error.code === '42501' ? 403 : result.error.code==='23505' ? 409 : 500; return NextResponse.json({ error: status === 422||status===409 ? result.error.message : 'Draft Invoice could not be created.', readiness: status === 422 ? evaluation.data : undefined }, { status }); }
  const invoice = Array.isArray(result.data) ? result.data[0] : result.data;
  const header=invoice?.invoice_id?await auth.admin.from('procurement_invoices').select('id,invoice_number,invoice_sequence,procurement_chain_id,procurement_number,invoice_status,supplier_user_id,currency,total_amount,generated_at').eq('id',invoice.invoice_id).maybeSingle():{data:null,error:null};
  if(!invoice?.invoice_id||header.error||!header.data)return NextResponse.json({error:'The canonical Invoice could not be reloaded after creation.'},{status:500});
  return NextResponse.json({ invoice: { id: header.data.id, invoiceNumber:header.data.invoice_number,invoiceSequence:header.data.invoice_sequence,procurementChainId: header.data.procurement_chain_id, procurementNumber: header.data.procurement_number, status: header.data.invoice_status,supplierId:header.data.supplier_user_id,currency:header.data.currency,total:header.data.total_amount,generatedAt:header.data.generated_at }, created: invoice.created, includedCount: invoice.included_count, openCount: invoice.open_count, result:invoice.created?'created':'already_created_for_request', navigationUrl: `/admin/procurement-progress/${invoice.procurement_chain_id}#invoice` }, { status: invoice.created ? 201 : 200 });
}
