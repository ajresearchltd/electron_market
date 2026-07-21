import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { reconcilePendingSupplierMessagesForRfq } from '../../../../../../../lib/supplier-email/pipeline';
import { createAdminClient } from '../../../../../../../lib/supabase/admin';
import { createClient } from '../../../../../../../lib/supabase/server';

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(request: NextRequest, { params }: { params: Promise<{ uploadId: string }> }) {
  const { uploadId } = await params;
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return fail('You must be signed in to create an RFQ.', 401);

  const database = createAdminClient();
  if (!database) return fail('RFQ creation is temporarily unavailable.', 500);

  const uploadResult = await database.from('customer_bom_uploads').select('id,user_id,procurement_chain_id').eq('id', uploadId).maybeSingle();
  if (uploadResult.error) return fail('The BOM could not be checked.', 500);
  if (!uploadResult.data) return fail('BOM upload not found.', 404);
  if (uploadResult.data.user_id !== user.id) return fail('You do not have access to this BOM upload.', 403);
  if (!uploadResult.data.procurement_chain_id) return fail('The BOM procurement chain was not found.', 404);

  const chainResult = await database.from('procurement_chains').select('id,customer_user_id').eq('id', uploadResult.data.procurement_chain_id).maybeSingle();
  if (!chainResult.data) return fail('The procurement chain was not found.', 404);
  if (chainResult.data.customer_user_id !== user.id) return fail('You do not have access to this procurement chain.', 403);

  const body = await request.json().catch(() => ({}));
  const reviewedValues = body?.reviewedValues && typeof body.reviewedValues === 'object' ? body.reviewedValues : {};
  const result = await database.rpc('create_draft_rfq_from_bom', { p_bom_upload_id: uploadId, p_customer_user_id: user.id, p_reviewed_values: reviewedValues });
  if (result.error) {
    if (result.error.code === '22023') return fail('No eligible BOM items are available. Correct the excluded rows before creating an RFQ.', 422);
    if (result.error.code === 'P0002') return fail(result.error.message.includes('chain') ? 'The procurement chain was not found.' : 'BOM upload not found.', 404);
    console.error('BOM RFQ creation failed', { code: result.error.code, message: result.error.message });
    return fail('The Draft RFQ could not be created. Confirm that the RFQ support migration has been applied.', 500);
  }

  const rfq = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!rfq?.rfq_id) return fail('The Draft RFQ could not be created.', 500);

  try {
    await reconcilePendingSupplierMessagesForRfq(database, rfq.procurement_chain_id, { rfq_id: rfq.rfq_id, order_number: rfq.procurement_number, rfq_status: 'draft' });
  } catch (error) {
    console.error('Pending supplier email reconciliation failed', { rfqId: rfq.rfq_id, error: error instanceof Error ? error.message : String(error) });
  }

  revalidatePath('/admin');
  revalidatePath(`/admin/procurement-progress/${rfq.procurement_chain_id}`);
  revalidatePath(`/admin/rfqs/${rfq.rfq_id}`);
  revalidatePath('/customer/dashboard');
  revalidatePath(`/customer/rfqs/${rfq.rfq_id}`);

  return NextResponse.json({
    rfq: { id: rfq.rfq_id, procurementChainId: rfq.procurement_chain_id, procurementNumber: rfq.procurement_number, status: 'draft' },
    created: Boolean(rfq.created),
    eligibleCount: Number(rfq.eligible_count ?? 0),
    excludedCount: Number(rfq.excluded_count ?? 0),
    navigationUrl: `/customer/rfqs/${rfq.rfq_id}`,
    message: rfq.created ? 'Draft RFQ created from BOM.' : 'This BOM already has an RFQ.',
  }, { status: rfq.created ? 201 : 200 });
}
