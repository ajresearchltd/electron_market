import { NextRequest, NextResponse } from 'next/server';
import { guardAssistantOutput } from '../../../../../../../lib/ai/supplier-confidentiality';
import { getProcurementOrderSnapshotForAI } from '../../../../../../../lib/ai/procurement-order-snapshot';
import { createAdminClient } from '../../../../../../../lib/supabase/admin';
import { createClient } from '../../../../../../../lib/supabase/server';

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(request: NextRequest, { params }: { params: Promise<{ uploadId: string }> }) {
  const { uploadId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('Authentication required.', 401);
  const { data: upload } = await supabase.from('customer_bom_uploads')
    .select('id,procurement_chain_id,user_id').eq('id', uploadId).eq('user_id', user.id).maybeSingle();
  if (!upload?.procurement_chain_id) return fail('BOM upload not found.', 404);
  const { data: chain } = await supabase.from('procurement_chains')
    .select('id,customer_user_id').eq('id', upload.procurement_chain_id).eq('customer_user_id', user.id).maybeSingle();
  if (!chain) return fail('BOM upload not found.', 404);

  const body = await request.json().catch(() => ({}));
  const messageId = String(body.messageId ?? '');
  const action = String(body.action ?? '');
  if (!messageId || !['confirm', 'cancel'].includes(action)) return fail('Invalid clarification action.');
  const { data: message } = await supabase.from('ai_chat_messages')
    .select('id,metadata,procurement_chain_id,user_id').eq('id', messageId)
    .eq('procurement_chain_id', chain.id).eq('user_id', user.id).eq('role', 'assistant').maybeSingle();
  const draft = message?.metadata?.clarification_draft;
  if (!draft || !Array.isArray(draft.recipients)) return fail('Clarification draft not found.', 404);

  const admin = createAdminClient();
  if (!admin) return fail('The authorized supplier messaging service is not configured.', 503);
  const snapshot = await getProcurementOrderSnapshotForAI({ database: admin, authenticatedUserId: user.id, procurementChainId: chain.id, bomUploadId: upload.id });
  const recipients = [...new Set<string>((draft.recipients as unknown[]).map((value) => String(value)))].filter((alias) => snapshot.supplierAliases.includes(alias));
  if (!recipients.length) return fail('No authorized anonymous supplier recipients were found.');
  const question = String(body.question ?? draft.question ?? '').trim().slice(0, 2000);
  if (!question) return fail('Clarification question is required.');
  const guarded = guardAssistantOutput(question, snapshot.internalSupplierIdentifiers);
  if (!guarded.safe) return fail('The clarification contains confidential supplier-identifying information. Remove it before sending.');
  const lineNumbers = [...new Set((Array.isArray(draft.bomLineNumbers) ? draft.bomLineNumbers : []).map(Number).filter(Number.isFinite))];
  const { data: bomItems } = lineNumbers.length ? await admin.from('customer_bom_upload_items')
    .select('id,row_number').eq('upload_id', upload.id).eq('user_id', user.id).eq('procurement_chain_id', chain.id).in('row_number', lineNumbers) : { data: [] };

  if (action === 'cancel') {
    const { error } = await admin.from('procurement_ai_action_proposals').insert({
      procurement_chain_id: chain.id, customer_user_id: user.id, chat_message_id: message.id,
      action_type: 'supplier_clarification', customer_visible_payload: { recipients, question: guarded.value, bomLineNumbers: lineNumbers },
      status: 'cancelled', cancelled_at: new Date().toISOString(),
    });
    if (error) return fail('The procurement AI security migration must be run before recording this decision.', 503);
    return NextResponse.json({ ok: true, status: 'cancelled' });
  }

  const { data: mappings, error: mappingError } = await admin.from('procurement_supplier_aliases')
    .select('supplier_key,alias_label').eq('procurement_chain_id', chain.id).in('alias_label', recipients);
  if (mappingError || (mappings ?? []).length !== recipients.length) return fail('Stable supplier aliases are not configured for every recipient.', 409);
  const proposal = await admin.from('procurement_ai_action_proposals').insert({
    procurement_chain_id: chain.id, customer_user_id: user.id, chat_message_id: message.id,
    action_type: 'supplier_clarification', customer_visible_payload: { recipients, question: guarded.value, bomLineNumbers: lineNumbers },
    status: 'confirmed', confirmed_at: new Date().toISOString(),
  }).select('id').single();
  if (proposal.error) return fail('The procurement AI security migration must be run before sending clarifications.', 503);
  const bomItemIds = (bomItems ?? []).map((item: any) => item.id);
  const communications = (mappings ?? []).map((mapping: any) => ({
    procurement_chain_id: chain.id,
    supplier_key: mapping.supplier_key,
    direction: 'outbound',
    message_type: 'clarification',
    bom_item_ids: bomItemIds,
    customer_visible_summary: guarded.value,
    structured_facts: { recipient_alias: mapping.alias_label, customer_confirmed: true, proposal_id: proposal.data.id },
  }));
  const sent = await admin.from('procurement_supplier_communications').insert(communications);
  if (sent.error) {
    await admin.from('procurement_ai_action_proposals').update({ status: 'failed' }).eq('id', proposal.data.id);
    return fail('The clarification could not be sent.', 500);
  }
  await admin.from('procurement_ai_action_proposals').update({ status: 'completed' }).eq('id', proposal.data.id);
  return NextResponse.json({ ok: true, status: 'sent', recipients });
}
