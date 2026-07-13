import {
  createInvoiceForProcurementCase,
  createProcurementCaseFromBomUpload,
  createReceiveOrderForProcurementCase,
  createWaybillForProcurementCase,
  getOrCreateProcurementCaseForBom,
} from '../procurement-documents/document-chain';

export const PROGRESS_STAGES = [
  { code: 'bom_received', label: 'BOM received', timestampColumn: 'bom_received_at' },
  { code: 'rfq', label: 'RFQ', timestampColumn: 'rfq_sent_at' },
  { code: 'quote_received', label: 'Quote received', timestampColumn: 'quote_received_at' },
  { code: 'approved', label: 'Approved', timestampColumn: 'approved_at' },
  { code: 'payment', label: 'Payment', timestampColumn: 'payment_at' },
  { code: 'goods_shipped', label: 'Goods shipped', timestampColumn: 'goods_shipped_at' },
  { code: 'goods_received', label: 'Goods received', timestampColumn: 'goods_received_at' },
  { code: 'order_completed', label: 'Order completed', timestampColumn: 'order_completed_at' },
] as const;

export type ProgressStageCode = typeof PROGRESS_STAGES[number]['code'];

type SupabaseLike = {
  from: (table: string) => any;
};

type Actor = {
  userId: string | null;
  role: 'customer' | 'supplier' | 'admin' | 'system';
};

export const getStageIndex = (stageCode: string | null | undefined) => (
  PROGRESS_STAGES.findIndex((stage) => stage.code === stageCode)
);

export const getNextStage = (stageCode: string | null | undefined) => {
  const index = getStageIndex(stageCode);
  return PROGRESS_STAGES[index + 1] ?? null;
};

export const getStageLabel = (stageCode: string | null | undefined) => (
  PROGRESS_STAGES.find((stage) => stage.code === stageCode)?.label ?? 'BOM received'
);

const getStage = (stageCode: ProgressStageCode) => PROGRESS_STAGES.find((stage) => stage.code === stageCode)!;

export const isMissingProgressTableError = (message: string | undefined) => {
  const normalized = String(message || '').toLowerCase();
  return normalized.includes('procurement_progress') && (
    normalized.includes('does not exist')
    || normalized.includes('schema cache')
    || normalized.includes('could not find')
  );
};

export async function getProgressForBomUpload(supabase: SupabaseLike, uploadId: string) {
  return supabase
    .from('procurement_progress')
    .select('*')
    .eq('customer_bom_upload_id', uploadId)
    .maybeSingle();
}

export async function createProgressFromBomUpload(supabase: SupabaseLike, upload: Record<string, any>) {
  const now = new Date().toISOString();
  const uploadId = String(upload.id || upload.upload_id || '');
  if (!uploadId || !upload.user_id) return { data: null, error: null };

  const existing = await getProgressForBomUpload(supabase, uploadId);
  if (existing.error && !isMissingProgressTableError(existing.error.message)) return existing;
  if (existing.data) {
    const procurementCase = await getOrCreateProcurementCaseForBom(supabase, uploadId);
    const payload: Record<string, any> = {};
    if (procurementCase.data?.id && procurementCase.data?.procurement_number) {
      payload.procurement_chain_id = procurementCase.data.procurement_chain_id || procurementCase.data.id;
      payload.procurement_case_id = procurementCase.data.id;
      payload.procurement_number = procurementCase.data.procurement_number;
    }
    if (!existing.data.rfq_id && !existing.data.quote_id && !existing.data.active_order_id && existing.data.current_stage !== 'bom_received') {
      payload.current_stage = 'bom_received';
      payload.current_stage_label = 'BOM received';
      payload.rfq_sent_at = null;
      payload.quote_received_at = null;
      payload.approved_at = null;
      payload.payment_at = null;
      payload.goods_shipped_at = null;
      payload.goods_received_at = null;
      payload.order_completed_at = null;
    }
    if (Object.keys(payload).length > 0) {
      const updated = await supabase.from('procurement_progress').update(payload).eq('id', existing.data.id).select('*').single();
      if (!updated.error) return updated;
    }
    return { data: existing.data, error: null };
  }
  if (existing.error && isMissingProgressTableError(existing.error.message)) return existing;

  const procurementCase = await createProcurementCaseFromBomUpload(supabase, upload);

  const progressPayload: Record<string, any> = {
    customer_user_id: upload.user_id,
    customer_bom_upload_id: uploadId,
    procurement_chain_id: procurementCase.data?.procurement_chain_id || procurementCase.data?.id || null,
    procurement_case_id: procurementCase.data?.id || null,
    procurement_number: procurementCase.data?.procurement_number || null,
    document_name: upload.document_name || upload.original_file_name || 'BOM upload',
    customer_company_name: upload.customer_company_name || null,
    current_stage: 'bom_received',
    current_stage_label: 'BOM received',
    status_note: 'BOM uploaded and normalized',
    bom_received_at: now,
    rfq_sent_at: null,
    quote_received_at: null,
    approved_at: null,
    payment_at: null,
    goods_shipped_at: null,
    goods_received_at: null,
    order_completed_at: null,
    metadata: { source: 'customer_bom_upload' },
  };

  let created = await supabase
    .from('procurement_progress')
    .insert(progressPayload)
    .select('*')
    .single();

  if (created.error && String(created.error.message || '').toLowerCase().includes('procurement_')) {
    delete progressPayload.procurement_chain_id;
    delete progressPayload.procurement_case_id;
    delete progressPayload.procurement_number;
    created = await supabase
      .from('procurement_progress')
      .insert(progressPayload)
      .select('*')
      .single();
  }

  if (created.error) return created;

  if (procurementCase.data?.procurement_number && (!created.data.procurement_number || !created.data.procurement_chain_id || !created.data.procurement_case_id)) {
    const updated = await supabase
      .from('procurement_progress')
      .update({
        procurement_chain_id: procurementCase.data.procurement_chain_id || procurementCase.data.id,
        procurement_case_id: procurementCase.data.id,
        procurement_number: procurementCase.data.procurement_number,
      })
      .eq('id', created.data.id)
      .select('*')
      .single();
    if (!updated.error) created.data = updated.data;
  }

  await supabase.from('procurement_progress_events').insert({
    progress_id: created.data.id,
    actor_user_id: upload.user_id,
    actor_role: 'system',
    stage_code: 'bom_received',
    stage_label: 'BOM received',
    event_note: 'Customer BOM uploaded',
    event_data: { customer_bom_upload_id: uploadId },
  });

  return created;
}

export async function advanceProgressStage(
  supabase: SupabaseLike,
  progressId: string,
  nextStage: ProgressStageCode,
  actor: Actor,
  note = '',
  data: Record<string, any> = {},
  options: { allowBackwards?: boolean } = {},
) {
  const current = await supabase.from('procurement_progress').select('*').eq('id', progressId).maybeSingle();
  if (current.error || !current.data) return current;

  const currentIndex = getStageIndex(current.data.current_stage);
  const nextIndex = getStageIndex(nextStage);
  if (nextIndex < 0) return { data: null, error: { message: 'Invalid progress stage.' } };
  if (!options.allowBackwards && nextIndex < currentIndex) return { data: null, error: { message: 'Progress stage cannot move backwards.' } };

  const stage = getStage(nextStage);
  const now = new Date().toISOString();
  const updatePayload: Record<string, any> = {
    current_stage: stage.code,
    current_stage_label: stage.label,
    status_note: note || current.data.status_note || null,
    updated_at: now,
    [stage.timestampColumn]: current.data[stage.timestampColumn] || now,
  };

  if (nextStage === 'payment') {
    updatePayload.payment_reference = data.payment_reference || null;
    updatePayload.payment_amount = data.payment_amount ?? null;
    updatePayload.payment_currency = data.payment_currency || 'USD';
  }
  if (nextStage === 'goods_shipped') {
    updatePayload.shipment_carrier = data.shipment_carrier || null;
    updatePayload.shipment_tracking_number = data.shipment_tracking_number || null;
    updatePayload.shipment_tracking_url = data.shipment_tracking_url || null;
  }
  if (nextStage === 'goods_received') updatePayload.goods_received_confirmed_by = actor.userId;
  if (nextStage === 'order_completed') updatePayload.order_completed_by = actor.userId;

  const updated = await supabase.from('procurement_progress').update(updatePayload).eq('id', progressId).select('*').single();
  if (updated.error) return updated;

  let procurementChainId = updated.data.procurement_chain_id || current.data.procurement_chain_id;
  let procurementNumber = updated.data.procurement_number || current.data.procurement_number;
  if ((!procurementChainId || !procurementNumber) && current.data.customer_bom_upload_id) {
    const procurementCase = await getOrCreateProcurementCaseForBom(supabase, current.data.customer_bom_upload_id);
    procurementChainId = procurementCase.data?.procurement_chain_id || procurementCase.data?.id || procurementChainId;
    procurementNumber = procurementCase.data?.procurement_number || '';
  }
  if (procurementNumber) {
    if (nextStage === 'payment') {
      await createInvoiceForProcurementCase(supabase, procurementNumber, { ...data, admin_user_id: actor.role === 'admin' ? actor.userId : null, note });
    }
    if (nextStage === 'goods_shipped') {
      await createWaybillForProcurementCase(supabase, procurementNumber, { ...data, admin_user_id: actor.role === 'admin' ? actor.userId : null, note });
    }
    if (nextStage === 'goods_received') {
      await createReceiveOrderForProcurementCase(supabase, procurementNumber, { ...data, received_by_user_id: actor.userId, note });
    }
    if (nextStage === 'order_completed') {
      await supabase
        .from('procurement_chains')
        .update({ current_stage: 'order_completed', current_stage_label: 'Order completed' })
        .eq('id', procurementChainId);
      await supabase
        .from('procurement_cases')
        .update({ current_stage: 'order_completed', current_stage_label: 'Order completed' })
        .eq('procurement_number', procurementNumber);
    }
  }

  await supabase.from('procurement_progress_events').insert({
    progress_id: progressId,
    actor_user_id: actor.userId,
    actor_role: actor.role,
    stage_code: stage.code,
    stage_label: stage.label,
    event_note: note || `Progress advanced to ${stage.label}`,
    event_data: data,
  });

  return updated;
}

export async function recalculateProgressFromLinkedRecords(_supabase: SupabaseLike, _progressId: string) {
  return { data: null, error: null };
}

export async function getCustomerProgress(supabase: SupabaseLike, userId: string) {
  return supabase.from('procurement_progress').select('*').eq('customer_user_id', userId).order('updated_at', { ascending: false });
}

export async function getSupplierProgress(supabase: SupabaseLike, userId: string) {
  return supabase.from('procurement_progress').select('*').eq('supplier_user_id', userId).order('updated_at', { ascending: false });
}

export async function getAdminProgress(supabase: SupabaseLike) {
  return supabase.from('procurement_progress').select('*').order('updated_at', { ascending: false }).limit(50);
}
