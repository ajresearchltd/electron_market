import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireInternalApi } from '../../../../../../../lib/auth/require-internal-api';
import { reconcilePendingSupplierMessagesForRfq } from '../../../../../../../lib/supplier-email/pipeline';

export async function POST(request: Request, { params }: { params: Promise<{ uploadId: string }> }) {
  const auth = await requireInternalApi();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { uploadId } = await params;
  const upload = await auth.admin.from('customer_bom_uploads').select('id,user_id,procurement_chain_id').eq('id', uploadId).maybeSingle();
  if (upload.error) return NextResponse.json({ error: 'The BOM could not be checked.' }, { status: 500 });
  if (!upload.data) return NextResponse.json({ error: 'BOM upload not found.' }, { status: 404 });
  if (!upload.data.procurement_chain_id) return NextResponse.json({ error: 'The BOM procurement chain was not found.' }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const reviewedValues = body?.reviewedValues && typeof body.reviewedValues === 'object' ? body.reviewedValues : {};
  const result = await auth.admin.rpc('create_draft_rfq_from_bom', { p_bom_upload_id: uploadId, p_customer_user_id: upload.data.user_id, p_reviewed_values: reviewedValues });
  if (result.error) {
    const status = result.error.code === '22023' ? 422 : result.error.code === 'P0002' ? 404 : 500;
    return NextResponse.json({ error: status === 422 ? 'No eligible BOM items are available. Correct the excluded rows before creating an RFQ.' : 'The Draft RFQ could not be created.' }, { status });
  }
  const rfq = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!rfq?.rfq_id) return NextResponse.json({ error: 'The Draft RFQ could not be created.' }, { status: 500 });
  await reconcilePendingSupplierMessagesForRfq(auth.admin, rfq.procurement_chain_id, { rfq_id: rfq.rfq_id, order_number: rfq.procurement_number, rfq_status: 'draft' }).catch((error) => console.error('Supplier offer reconciliation failed', error));
  revalidatePath('/admin');
  revalidatePath(`/admin/procurement-progress/${rfq.procurement_chain_id}`);
  revalidatePath(`/admin/rfqs/${rfq.rfq_id}`);
  revalidatePath('/customer/dashboard');
  return NextResponse.json({ rfq: { id: rfq.rfq_id, procurementChainId: rfq.procurement_chain_id, procurementNumber: rfq.procurement_number, status: 'draft' }, created: Boolean(rfq.created), eligibleCount: Number(rfq.eligible_count ?? 0), excludedCount: Number(rfq.excluded_count ?? 0), navigationUrl: `/admin/rfqs/${rfq.rfq_id}` }, { status: rfq.created ? 201 : 200 });
}
