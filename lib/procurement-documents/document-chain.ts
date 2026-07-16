type SupabaseLike = {
  from: (table: string) => any;
};

export type ProcurementDocumentFile = {
  storageBucket: string;
  storagePath: string;
  originalFileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
};

const validStoredPath = (value: unknown) => {
  const path = String(value ?? '').trim();
  if (!path || path === '[object Object]' || path.startsWith('blob:') || path.includes('localhost')) return null;
  return path;
};

export function getProcurementDocumentFile(type: 'bom' | 'rfq' | 'quote' | 'invoice' | 'waybill' | 'receive_order', header: Record<string, any> | null): ProcurementDocumentFile | null {
  if (type !== 'bom' || !header) return null;
  const storagePath = validStoredPath(header.file_path || header.file_url);
  if (!storagePath || /^https?:\/\//i.test(storagePath)) return null;
  return { storageBucket: 'customer-bom-files', storagePath, originalFileName: header.original_file_name || null, mimeType: header.file_type || null, sizeBytes: header.file_size ?? null };
}

export type ProcurementDocumentChain = {
  procurementChain: Record<string, any> | null;
  procurementCase: Record<string, any> | null;
  progress: Record<string, any> | null;
  bom: { header: Record<string, any> | null; items: Record<string, any>[] };
  rfq: { headers: Record<string, any>[]; items: Record<string, any>[] };
  quote: { headers: Record<string, any>[]; items: Record<string, any>[] };
  invoice: { headers: Record<string, any>[]; items: Record<string, any>[] };
  waybill: { headers: Record<string, any>[]; items: Record<string, any>[] };
  receiveOrder: { headers: Record<string, any>[]; items: Record<string, any>[] };
};

export type ProcurementChainDocumentSummary = {
  type: 'BOM' | 'RFQ' | 'QUOTE' | 'INVOICE' | 'WAYBILL' | 'RECEIVE_ORDER';
  label: string;
  exists: boolean;
  status: string;
  header: Record<string, any> | null;
  itemCount: number;
  tableName: string;
  itemTableName: string;
};

export type ProcurementChainOverview = {
  chainId?: string;
  documentNumber: string;
  progress: Record<string, any> | null;
  procurementChain: Record<string, any> | null;
  procurementCase: Record<string, any> | null;
  documents: ProcurementChainDocumentSummary[];
  chain: ProcurementDocumentChain;
};

const missingDocumentChainError = (message: string | undefined) => {
  const normalized = String(message || '').toLowerCase();
  return normalized.includes('procurement_cases')
    || normalized.includes('procurement_chains')
    || normalized.includes('procurement_number')
    || normalized.includes('procurement_case_id')
    || normalized.includes('procurement_chain_id')
    || normalized.includes('procurement_invoices')
    || normalized.includes('procurement_waybills')
    || normalized.includes('procurement_receive_orders')
    || (
      normalized.includes('procurement_progress')
      && (
        normalized.includes('does not exist')
        || normalized.includes('schema cache')
        || normalized.includes('could not find')
      )
    );
};

const normalizeNumber = (value: unknown) => String(value || '').trim();

const maybeData = async (query: any) => {
  const result = await query;
  if (result.error && missingDocumentChainError(result.error.message)) return { data: null, error: null };
  return result;
};

const safeUpdateById = async (
  supabase: SupabaseLike,
  table: string,
  idColumn: string,
  idValue: string,
  payload: Record<string, any>,
) => maybeData(supabase.from(table).update(payload).eq(idColumn, idValue));

const safeUpdateByColumn = async (
  supabase: SupabaseLike,
  table: string,
  column: string,
  value: string,
  payload: Record<string, any>,
) => maybeData(supabase.from(table).update(payload).eq(column, value));

export const generateProcurementNumber = () => {
  const year = new Date().getFullYear();
  const suffix = Date.now().toString().slice(-6);
  return `PR-${year}-${suffix}`;
};

const normalizeChainRecord = (chain: Record<string, any> | null) => {
  if (!chain) return null;
  return {
    ...chain,
    procurement_chain_id: chain.procurement_chain_id || chain.id,
    procurement_case_id: chain.procurement_case_id || chain.id,
  };
};

async function getProcurementChainBySource(supabase: SupabaseLike, sourceType: string, sourceRecordId: string) {
  return maybeData(
    supabase
      .from('procurement_chains')
      .select('*')
      .eq('source_type', sourceType)
      .eq('source_record_id', sourceRecordId)
      .maybeSingle(),
  );
}

async function getProcurementChainById(supabase: SupabaseLike, chainId: string) {
  return maybeData(
    supabase
      .from('procurement_chains')
      .select('*')
      .eq('id', chainId)
      .maybeSingle(),
  );
}

async function getProcurementChainByNumber(supabase: SupabaseLike, procurementNumber: string) {
  return maybeData(
    supabase
      .from('procurement_chains')
      .select('*')
      .eq('procurement_number', procurementNumber)
      .maybeSingle(),
  );
}

export async function getOrCreateProcurementChain(
  supabase: SupabaseLike,
  input: {
    sourceType: 'customer_bom_upload' | 'rfq' | string;
    sourceRecordId: string;
    customerUserId: string;
    supplierUserId?: string | null;
    adminUserId?: string | null;
    customerCompanyName?: string | null;
    supplierCompanyName?: string | null;
    customerReference?: string | null;
    documentName?: string | null;
    currentStage?: string;
    currentStageLabel?: string;
  },
) {
  const sourceRecordId = normalizeNumber(input.sourceRecordId);
  const customerUserId = normalizeNumber(input.customerUserId);
  if (!sourceRecordId || !customerUserId) return { data: null, error: null };

  const existing = await getProcurementChainBySource(supabase, input.sourceType, sourceRecordId);
  if (existing.error) return existing;
  if (existing.data) return { data: normalizeChainRecord(existing.data), error: null };

  const inserted = await maybeData(
    supabase
      .from('procurement_chains')
      .insert({
        customer_user_id: customerUserId,
        supplier_user_id: input.supplierUserId || null,
        admin_user_id: input.adminUserId || null,
        customer_company_name: input.customerCompanyName || null,
        supplier_company_name: input.supplierCompanyName || null,
        customer_reference: input.customerReference || input.documentName || null,
        document_name: input.documentName || input.customerReference || null,
        current_stage: input.currentStage || 'bom_received',
        current_stage_label: input.currentStageLabel || 'BOM received',
        status: 'active',
        source_type: input.sourceType,
        source_record_id: sourceRecordId,
      })
      .select('*')
      .single(),
  );
  if (inserted.error || !inserted.data) return inserted;
  return { data: normalizeChainRecord(inserted.data), error: null };
}

export async function createProcurementCaseFromBomUpload(supabase: SupabaseLike, upload: Record<string, any>) {
  const uploadId = String(upload.id || upload.upload_id || '').trim();
  if (!uploadId || !upload.user_id) return { data: null, error: null };

  if (upload.procurement_number && (upload.procurement_chain_id || upload.procurement_case_id)) {
    return {
      data: {
        id: upload.procurement_chain_id || upload.procurement_case_id,
        procurement_chain_id: upload.procurement_chain_id || upload.procurement_case_id,
        procurement_case_id: upload.procurement_case_id || upload.procurement_chain_id,
        procurement_number: upload.procurement_number,
      },
      error: null,
    };
  }

  const chain = await getOrCreateProcurementChain(supabase, {
    sourceType: 'customer_bom_upload',
    sourceRecordId: uploadId,
    customerUserId: upload.user_id,
    customerCompanyName: upload.customer_company_name || null,
    customerReference: upload.document_name || upload.original_file_name || null,
    documentName: upload.document_name || upload.original_file_name || 'BOM upload',
    currentStage: 'bom_received',
    currentStageLabel: 'BOM received',
  });
  if (!chain.error && chain.data?.id) {
    await attachBomToProcurementCase(supabase, uploadId, chain.data.id, chain.data.procurement_number);
    return chain;
  }

  const existingByBom = await maybeData(
    supabase
      .from('procurement_cases')
      .select('*')
      .eq('source_bom_upload_id', uploadId)
      .maybeSingle(),
  );
  if (existingByBom.error) return existingByBom;
  if (existingByBom.data) {
    await attachBomToProcurementCase(supabase, uploadId, existingByBom.data.id, existingByBom.data.procurement_number);
    return { data: existingByBom.data, error: null };
  }

  const inserted = await maybeData(
    supabase
      .from('procurement_cases')
      .insert({
        customer_user_id: upload.user_id,
        customer_company_name: upload.customer_company_name || null,
        document_name: upload.document_name || upload.original_file_name || 'BOM upload',
        current_stage: 'bom_received',
        current_stage_label: 'BOM received',
        source_type: 'customer_bom_upload',
        source_bom_upload_id: uploadId,
      })
      .select('*')
      .single(),
  );
  if (inserted.error || !inserted.data) return inserted;

  await attachBomToProcurementCase(supabase, uploadId, inserted.data.id, inserted.data.procurement_number);
  return inserted;
}

export async function getOrCreateProcurementCaseForBom(supabase: SupabaseLike, uploadId: string) {
  const upload = await maybeData(
    supabase
      .from('customer_bom_uploads')
      .select('*')
      .eq('id', uploadId)
      .maybeSingle(),
  );
  if (upload.error || !upload.data) return upload;
  return createProcurementCaseFromBomUpload(supabase, upload.data);
}

async function attachBomToProcurementCase(
  supabase: SupabaseLike,
  uploadId: string,
  procurementCaseId: string,
  procurementNumber: string,
) {
  const payload = { procurement_chain_id: procurementCaseId, procurement_case_id: procurementCaseId, procurement_number: procurementNumber };
  await safeUpdateById(supabase, 'customer_bom_uploads', 'id', uploadId, payload);
  await safeUpdateByColumn(supabase, 'customer_bom_upload_items', 'upload_id', uploadId, payload);
  await safeUpdateByColumn(supabase, 'procurement_progress', 'customer_bom_upload_id', uploadId, payload);
}

export async function attachRfqToProcurementChain(supabase: SupabaseLike, procurementChainId: string, rfqId: string) {
  const procurementCase = await getProcurementChainById(supabase, procurementChainId);
  if (procurementCase.error || !procurementCase.data) return procurementCase;
  const payload = { procurement_chain_id: procurementCase.data.id, procurement_case_id: procurementCase.data.id, procurement_number: procurementCase.data.procurement_number };
  await safeUpdateById(supabase, 'rfq', 'rfq_id', rfqId, payload);
  await safeUpdateByColumn(supabase, 'rfq_items', 'rfq_id', rfqId, payload);
  await safeUpdateById(supabase, 'rfq_orders0', 'rfq_id', rfqId, payload);
  await safeUpdateByColumn(supabase, 'rfq_order_items0', 'rfq_id', rfqId, payload);
  await safeUpdateByColumn(supabase, 'procurement_progress', 'rfq_id', rfqId, payload);
  return procurementCase;
}

export async function attachRfqToProcurementCase(supabase: SupabaseLike, procurementNumber: string, rfqId: string) {
  const procurementCase = await getProcurementChainByNumber(supabase, procurementNumber);
  if (!procurementCase.error && procurementCase.data?.id) return attachRfqToProcurementChain(supabase, procurementCase.data.id, rfqId);
  const legacyCase = await getProcurementCaseByNumber(supabase, procurementNumber);
  if (legacyCase.error || !legacyCase.data) return legacyCase;
  const payload = { procurement_chain_id: legacyCase.data.id, procurement_case_id: legacyCase.data.id, procurement_number: procurementNumber };
  await safeUpdateById(supabase, 'rfq', 'rfq_id', rfqId, payload);
  await safeUpdateByColumn(supabase, 'rfq_items', 'rfq_id', rfqId, payload);
  await safeUpdateById(supabase, 'rfq_orders0', 'rfq_id', rfqId, payload);
  await safeUpdateByColumn(supabase, 'rfq_order_items0', 'rfq_id', rfqId, payload);
  await safeUpdateByColumn(supabase, 'procurement_progress', 'rfq_id', rfqId, payload);
  return legacyCase;
}

export async function createProcurementCaseFromRfq(supabase: SupabaseLike, rfq: Record<string, any>) {
  const rfqId = String(rfq.rfq_id || '').trim();
  const customerUserId = String(rfq.customer_id || rfq.created_by_user_id || '').trim();
  if (!rfqId || !customerUserId) return { data: null, error: null };

  if (rfq.procurement_number && (rfq.procurement_chain_id || rfq.procurement_case_id)) {
    return {
      data: {
        id: rfq.procurement_chain_id || rfq.procurement_case_id,
        procurement_chain_id: rfq.procurement_chain_id || rfq.procurement_case_id,
        procurement_case_id: rfq.procurement_case_id || rfq.procurement_chain_id,
        procurement_number: rfq.procurement_number,
      },
      error: null,
    };
  }

  if (rfq.source_bom_upload_id) {
    const bomChain = await getOrCreateProcurementCaseForBom(supabase, rfq.source_bom_upload_id);
    if (bomChain.data?.id) {
      await attachRfqToProcurementChain(supabase, bomChain.data.id, rfqId);
      return bomChain;
    }
    if (bomChain.error) return bomChain;
  }

  const chain = await getOrCreateProcurementChain(supabase, {
    sourceType: 'rfq',
    sourceRecordId: rfqId,
    customerUserId,
    customerCompanyName: rfq.customer_company_name || null,
    customerReference: rfq.order_number || rfq.rfq_name || null,
    documentName: rfq.order_number || rfq.rfq_name || 'RFQ',
    currentStage: 'rfq',
    currentStageLabel: 'RFQ',
  });
  if (!chain.error && chain.data?.id) {
    await attachRfqToProcurementChain(supabase, chain.data.id, rfqId);
    return chain;
  }

  const existing = await maybeData(
    supabase
      .from('procurement_cases')
      .select('*')
      .eq('source_rfq_id', rfqId)
      .maybeSingle(),
  );
  if (existing.error) return existing;
  if (existing.data) {
    await attachRfqToProcurementCase(supabase, existing.data.procurement_number, rfqId);
    return { data: existing.data, error: null };
  }

  const inserted = await maybeData(
    supabase
      .from('procurement_cases')
      .insert({
        customer_user_id: customerUserId,
        customer_company_name: rfq.customer_company_name || null,
        document_name: rfq.order_number || rfq.rfq_name || 'RFQ',
        current_stage: 'rfq',
        current_stage_label: 'RFQ',
        source_type: 'rfq',
        source_rfq_id: rfqId,
      })
      .select('*')
      .single(),
  );
  if (inserted.error || !inserted.data) return inserted;
  await attachRfqToProcurementCase(supabase, inserted.data.procurement_number, rfqId);
  return inserted;
}

export async function attachQuoteToProcurementCase(supabase: SupabaseLike, procurementNumber: string, quoteId: string) {
  const procurementCase = await getProcurementChainByNumber(supabase, procurementNumber);
  if (procurementCase.error || !procurementCase.data) return procurementCase;
  const payload = { procurement_chain_id: procurementCase.data.id, procurement_case_id: procurementCase.data.id, procurement_number: procurementNumber };
  await safeUpdateById(supabase, 'rfq_quotes', 'quote_id', quoteId, payload);
  await safeUpdateByColumn(supabase, 'rfq_quote_items', 'quote_id', quoteId, payload);
  await safeUpdateById(supabase, 'supplier_quotes0', 'quote_id', quoteId, payload);
  await safeUpdateByColumn(supabase, 'supplier_quote_items0', 'quote_id', quoteId, payload);
  await safeUpdateByColumn(supabase, 'procurement_progress', 'quote_id', quoteId, payload);
  return procurementCase;
}

async function getProcurementCaseByNumber(supabase: SupabaseLike, procurementNumber: string) {
  return maybeData(
    supabase
      .from('procurement_cases')
      .select('*')
      .eq('procurement_number', procurementNumber)
      .maybeSingle(),
  );
}

async function getProgressByNumber(supabase: SupabaseLike, procurementNumber: string) {
  return maybeData(
    supabase
      .from('procurement_progress')
      .select('*')
      .eq('procurement_number', procurementNumber)
      .maybeSingle(),
  );
}

async function sourceLineItems(supabase: SupabaseLike, progress: Record<string, any> | null, procurementNumber: string) {
  if (progress?.active_order_id) {
    const activeItems = await maybeData(supabase.from('active_order_items').select('*').eq('active_order_id', progress.active_order_id));
    if (!activeItems.error && activeItems.data?.length) return activeItems.data;
  }
  if (progress?.quote_id) {
    const quoteItems = await maybeData(supabase.from('supplier_quote_items0').select('*').eq('quote_id', progress.quote_id));
    if (!quoteItems.error && quoteItems.data?.length) return quoteItems.data;
  }
  if (progress?.rfq_id) {
    const rfqItems = await maybeData(supabase.from('rfq_order_items0').select('*').eq('rfq_id', progress.rfq_id));
    if (!rfqItems.error && rfqItems.data?.length) return rfqItems.data;
  }
  if (progress?.customer_bom_upload_id) {
    const bomItems = await maybeData(supabase.from('customer_bom_upload_items').select('*').eq('upload_id', progress.customer_bom_upload_id));
    if (!bomItems.error && bomItems.data?.length) return bomItems.data;
  }
  const byNumber = await maybeData(supabase.from('customer_bom_upload_items').select('*').eq('procurement_number', procurementNumber));
  return byNumber.data ?? [];
}

const mapInvoiceItem = (item: Record<string, any>, invoiceId: string, procurementCaseId: string, procurementNumber: string) => ({
  invoice_id: invoiceId,
  procurement_chain_id: procurementCaseId,
  procurement_case_id: procurementCaseId,
  procurement_number: procurementNumber,
  line_number: item.line_number ?? item.row_number ?? null,
  part_number: item.part_number ?? null,
  manufacturer: item.manufacturer ?? null,
  description: item.description ?? item.product_name ?? item.name_of_detail ?? null,
  quantity: item.confirmed_quantity ?? item.quoted_quantity ?? item.requested_quantity ?? item.quantity ?? item.amount ?? null,
  unit: item.quantity_unit ?? item.unit ?? 'pcs',
  unit_price: item.unit_price ?? item.target_unit_price ?? null,
  currency: item.currency ?? item.target_currency ?? 'USD',
  line_total: item.line_subtotal ?? item.target_total_price ?? null,
  notes: item.supplier_line_notes ?? item.customer_line_notes ?? item.notes ?? null,
});

const mapWaybillItem = (item: Record<string, any>, waybillId: string, procurementCaseId: string, procurementNumber: string) => ({
  waybill_id: waybillId,
  procurement_chain_id: procurementCaseId,
  procurement_case_id: procurementCaseId,
  procurement_number: procurementNumber,
  line_number: item.line_number ?? item.row_number ?? null,
  part_number: item.part_number ?? null,
  manufacturer: item.manufacturer ?? null,
  description: item.description ?? item.product_name ?? item.name_of_detail ?? null,
  quantity: item.confirmed_quantity ?? item.quoted_quantity ?? item.requested_quantity ?? item.quantity ?? item.amount ?? null,
  unit: item.quantity_unit ?? item.unit ?? 'pcs',
  country_of_origin: item.preferred_origin_country ?? null,
  notes: item.supplier_line_notes ?? item.customer_line_notes ?? item.notes ?? null,
});

const mapReceiveOrderItem = (item: Record<string, any>, receiveOrderId: string, procurementCaseId: string, procurementNumber: string) => ({
  receive_order_id: receiveOrderId,
  procurement_chain_id: procurementCaseId,
  procurement_case_id: procurementCaseId,
  procurement_number: procurementNumber,
  line_number: item.line_number ?? item.row_number ?? null,
  part_number: item.part_number ?? null,
  manufacturer: item.manufacturer ?? null,
  description: item.description ?? item.product_name ?? item.name_of_detail ?? null,
  ordered_quantity: item.confirmed_quantity ?? item.quoted_quantity ?? item.requested_quantity ?? item.quantity ?? item.amount ?? null,
  received_quantity: item.confirmed_quantity ?? item.quoted_quantity ?? item.requested_quantity ?? item.quantity ?? item.amount ?? null,
  accepted_quantity: item.confirmed_quantity ?? item.quoted_quantity ?? item.requested_quantity ?? item.quantity ?? item.amount ?? null,
  rejected_quantity: 0,
  unit: item.quantity_unit ?? item.unit ?? 'pcs',
  condition_status: 'not_checked',
  customer_comment: item.customer_line_notes ?? item.notes ?? null,
});

export async function createInvoiceForProcurementCase(
  supabase: SupabaseLike,
  procurementNumber: string,
  data: Record<string, any> = {},
) {
  const procurementCase = await getProcurementChainByNumber(supabase, procurementNumber);
  if (procurementCase.error || !procurementCase.data) return procurementCase;
  const existing = await maybeData(supabase.from('procurement_invoices').select('*').eq('procurement_chain_id', procurementCase.data.id).maybeSingle());
  if (existing.error || existing.data) return existing;

  const progress = (await getProgressByNumber(supabase, procurementNumber)).data;
  const inserted = await maybeData(
    supabase
      .from('procurement_invoices')
      .insert({
        procurement_chain_id: procurementCase.data.id,
        procurement_case_id: procurementCase.data.id,
        procurement_number: procurementNumber,
        invoice_status: 'issued',
        customer_user_id: procurementCase.data.customer_user_id,
        supplier_user_id: procurementCase.data.supplier_user_id || progress?.supplier_user_id || null,
        admin_user_id: data.admin_user_id || progress?.admin_user_id || null,
        customer_company_name: procurementCase.data.customer_company_name || progress?.customer_company_name || null,
        supplier_company_name: procurementCase.data.supplier_company_name || progress?.supplier_company_name || null,
        invoice_date: new Date().toISOString().slice(0, 10),
        currency: data.payment_currency || progress?.payment_currency || 'USD',
        payment_status: data.payment_reference ? 'paid' : 'unpaid',
        payment_reference: data.payment_reference || null,
        payment_date: data.payment_reference ? new Date().toISOString().slice(0, 10) : null,
        notes: data.note || null,
      })
      .select('*')
      .single(),
  );
  if (inserted.error || !inserted.data) return inserted;

  const lineItems = await sourceLineItems(supabase, progress, procurementNumber);
  if (lineItems.length) {
    await maybeData(supabase.from('procurement_invoice_items').insert(lineItems.map((item: Record<string, any>) => mapInvoiceItem(item, inserted.data.id, procurementCase.data.id, procurementNumber))));
  }
  await safeUpdateById(supabase, 'procurement_chains', 'id', procurementCase.data.id, { source_invoice_id: inserted.data.id, current_stage: 'payment', current_stage_label: 'Payment' });
  await safeUpdateById(supabase, 'procurement_cases', 'id', procurementCase.data.id, { source_invoice_id: inserted.data.id, current_stage: 'payment', current_stage_label: 'Payment' });
  return inserted;
}

export async function createWaybillForProcurementCase(
  supabase: SupabaseLike,
  procurementNumber: string,
  data: Record<string, any> = {},
) {
  const procurementCase = await getProcurementChainByNumber(supabase, procurementNumber);
  if (procurementCase.error || !procurementCase.data) return procurementCase;
  const existing = await maybeData(supabase.from('procurement_waybills').select('*').eq('procurement_chain_id', procurementCase.data.id).maybeSingle());
  if (existing.error || existing.data) return existing;

  const progress = (await getProgressByNumber(supabase, procurementNumber)).data;
  const inserted = await maybeData(
    supabase
      .from('procurement_waybills')
      .insert({
        procurement_chain_id: procurementCase.data.id,
        procurement_case_id: procurementCase.data.id,
        procurement_number: procurementNumber,
        waybill_status: 'shipped',
        customer_user_id: procurementCase.data.customer_user_id,
        supplier_user_id: procurementCase.data.supplier_user_id || progress?.supplier_user_id || null,
        admin_user_id: data.admin_user_id || progress?.admin_user_id || null,
        carrier: data.shipment_carrier || null,
        tracking_number: data.shipment_tracking_number || null,
        tracking_url: data.shipment_tracking_url || null,
        shipped_date: new Date().toISOString().slice(0, 10),
        shipment_notes: data.note || null,
      })
      .select('*')
      .single(),
  );
  if (inserted.error || !inserted.data) return inserted;

  const lineItems = await sourceLineItems(supabase, progress, procurementNumber);
  if (lineItems.length) {
    await maybeData(supabase.from('procurement_waybill_items').insert(lineItems.map((item: Record<string, any>) => mapWaybillItem(item, inserted.data.id, procurementCase.data.id, procurementNumber))));
  }
  await safeUpdateById(supabase, 'procurement_chains', 'id', procurementCase.data.id, { source_waybill_id: inserted.data.id, current_stage: 'goods_shipped', current_stage_label: 'Goods shipped' });
  await safeUpdateById(supabase, 'procurement_cases', 'id', procurementCase.data.id, { source_waybill_id: inserted.data.id, current_stage: 'goods_shipped', current_stage_label: 'Goods shipped' });
  return inserted;
}

export async function createReceiveOrderForProcurementCase(
  supabase: SupabaseLike,
  procurementNumber: string,
  data: Record<string, any> = {},
) {
  const procurementCase = await getProcurementChainByNumber(supabase, procurementNumber);
  if (procurementCase.error || !procurementCase.data) return procurementCase;
  const existing = await maybeData(supabase.from('procurement_receive_orders').select('*').eq('procurement_chain_id', procurementCase.data.id).maybeSingle());
  if (existing.error || existing.data) return existing;

  const progress = (await getProgressByNumber(supabase, procurementNumber)).data;
  const inserted = await maybeData(
    supabase
      .from('procurement_receive_orders')
      .insert({
        procurement_chain_id: procurementCase.data.id,
        procurement_case_id: procurementCase.data.id,
        procurement_number: procurementNumber,
        receive_status: 'received',
        customer_user_id: procurementCase.data.customer_user_id,
        supplier_user_id: procurementCase.data.supplier_user_id || progress?.supplier_user_id || null,
        admin_user_id: data.admin_user_id || progress?.admin_user_id || null,
        received_by_user_id: data.received_by_user_id || procurementCase.data.customer_user_id,
        received_date: new Date().toISOString().slice(0, 10),
        all_items_received: true,
        customer_notes: data.note || null,
      })
      .select('*')
      .single(),
  );
  if (inserted.error || !inserted.data) return inserted;

  const lineItems = await sourceLineItems(supabase, progress, procurementNumber);
  if (lineItems.length) {
    await maybeData(supabase.from('procurement_receive_order_items').insert(lineItems.map((item: Record<string, any>) => mapReceiveOrderItem(item, inserted.data.id, procurementCase.data.id, procurementNumber))));
  }
  await safeUpdateById(supabase, 'procurement_chains', 'id', procurementCase.data.id, { source_receive_order_id: inserted.data.id, current_stage: 'goods_received', current_stage_label: 'Goods received' });
  await safeUpdateById(supabase, 'procurement_cases', 'id', procurementCase.data.id, { source_receive_order_id: inserted.data.id, current_stage: 'goods_received', current_stage_label: 'Goods received' });
  return inserted;
}

export async function getProcurementDocumentsByNumber(supabase: SupabaseLike, procurementNumber: string): Promise<{ data: ProcurementDocumentChain; error: any }> {
  const number = normalizeNumber(procurementNumber);
  const empty: ProcurementDocumentChain = {
    procurementChain: null,
    procurementCase: null,
    progress: null,
    bom: { header: null, items: [] },
    rfq: { headers: [], items: [] },
    quote: { headers: [], items: [] },
    invoice: { headers: [], items: [] },
    waybill: { headers: [], items: [] },
    receiveOrder: { headers: [], items: [] },
  };
  if (!number) return { data: empty, error: { message: 'Procurement number is required.' } };

  const procurementCase = await maybeData(supabase.from('procurement_cases').select('*').eq('procurement_number', number).maybeSingle());
  const progressByNumber = await maybeData(supabase.from('procurement_progress').select('*').eq('procurement_number', number).maybeSingle());
  const progressRecord = progressByNumber.data ?? null;
  const canonicalNumber = normalizeNumber(progressRecord?.procurement_number || procurementCase.data?.procurement_number || number);

  const [
    bomHeader,
    bomItems,
    rfqHeaders,
    rfq0Headers,
    rfqItems,
    rfq0Items,
    quoteHeaders,
    quote0Headers,
    quoteItems,
    quote0Items,
    invoiceHeaders,
    invoiceItems,
    waybillHeaders,
    waybillItems,
    receiveHeaders,
    receiveItems,
  ] = await Promise.all([
    maybeData(supabase.from('customer_bom_uploads').select('*').eq('procurement_number', canonicalNumber).maybeSingle()),
    maybeData(supabase.from('customer_bom_upload_items').select('*').eq('procurement_number', canonicalNumber).order('row_number', { ascending: true })),
    maybeData(supabase.from('rfq').select('*').eq('procurement_number', canonicalNumber).order('created_date', { ascending: false })),
    maybeData(supabase.from('rfq_orders0').select('*').eq('procurement_number', canonicalNumber).order('created_at', { ascending: false })),
    maybeData(supabase.from('rfq_items').select('*').eq('procurement_number', canonicalNumber).order('rec_num', { ascending: true })),
    maybeData(supabase.from('rfq_order_items0').select('*').eq('procurement_number', canonicalNumber).order('line_number', { ascending: true })),
    maybeData(supabase.from('rfq_quotes').select('*').eq('procurement_number', canonicalNumber)),
    maybeData(supabase.from('supplier_quotes0').select('*').eq('procurement_number', canonicalNumber).order('created_at', { ascending: false })),
    maybeData(supabase.from('rfq_quote_items').select('*').eq('procurement_number', canonicalNumber)),
    maybeData(supabase.from('supplier_quote_items0').select('*').eq('procurement_number', canonicalNumber).order('line_number', { ascending: true })),
    maybeData(supabase.from('procurement_invoices').select('*').eq('procurement_number', canonicalNumber).order('created_at', { ascending: false })),
    maybeData(supabase.from('procurement_invoice_items').select('*').eq('procurement_number', canonicalNumber).order('line_number', { ascending: true })),
    maybeData(supabase.from('procurement_waybills').select('*').eq('procurement_number', canonicalNumber).order('created_at', { ascending: false })),
    maybeData(supabase.from('procurement_waybill_items').select('*').eq('procurement_number', canonicalNumber).order('line_number', { ascending: true })),
    maybeData(supabase.from('procurement_receive_orders').select('*').eq('procurement_number', canonicalNumber).order('created_at', { ascending: false })),
    maybeData(supabase.from('procurement_receive_order_items').select('*').eq('procurement_number', canonicalNumber).order('line_number', { ascending: true })),
  ]);

  const firstError = [
    procurementCase,
    progressByNumber,
    bomHeader,
    bomItems,
    rfqHeaders,
    rfq0Headers,
    rfqItems,
    rfq0Items,
    quoteHeaders,
    quote0Headers,
    quoteItems,
    quote0Items,
    invoiceHeaders,
    invoiceItems,
    waybillHeaders,
    waybillItems,
    receiveHeaders,
    receiveItems,
  ].find((result) => result.error)?.error;

  return {
    data: {
      procurementChain: null,
      procurementCase: procurementCase.data ?? null,
      progress: progressRecord,
      bom: { header: bomHeader.data ?? null, items: bomItems.data ?? [] },
      rfq: { headers: [...(rfqHeaders.data ?? []), ...(rfq0Headers.data ?? [])], items: [...(rfqItems.data ?? []), ...(rfq0Items.data ?? [])] },
      quote: { headers: [...(quoteHeaders.data ?? []), ...(quote0Headers.data ?? [])], items: [...(quoteItems.data ?? []), ...(quote0Items.data ?? [])] },
      invoice: { headers: invoiceHeaders.data ?? [], items: invoiceItems.data ?? [] },
      waybill: { headers: waybillHeaders.data ?? [], items: waybillItems.data ?? [] },
      receiveOrder: { headers: receiveHeaders.data ?? [], items: receiveItems.data ?? [] },
    },
    error: firstError ?? null,
  };
}

export async function getProcurementDocumentChainByNumber(supabase: SupabaseLike, documentNumber: string) {
  return getProcurementDocumentsByNumber(supabase, documentNumber);
}

const statusFromHeader = (header: Record<string, any> | null, keys: string[]) => {
  if (!header) return 'Not created yet';
  for (const key of keys) {
    if (header[key]) return String(header[key]);
  }
  return 'Created';
};

const buildProcurementOverview = (
  chainId: string,
  procurementNumber: string,
  chain: ProcurementDocumentChain,
): ProcurementChainOverview => {
  const bomHeader = chain.bom.header;
  const rfqHeader = chain.rfq.headers[0] ?? null;
  const quoteHeader = chain.quote.headers[0] ?? null;
  const invoiceHeader = chain.invoice.headers[0] ?? null;
  const waybillHeader = chain.waybill.headers[0] ?? null;
  const receiveHeader = chain.receiveOrder.headers[0] ?? null;

  return {
    chainId,
    documentNumber: procurementNumber,
    progress: chain.progress,
    procurementChain: chain.procurementChain,
    procurementCase: chain.procurementCase,
    chain,
    documents: [
      {
        type: 'BOM',
        label: 'BOM',
        exists: Boolean(bomHeader),
        status: statusFromHeader(bomHeader, ['status', 'ai_processing_status']),
        header: bomHeader,
        itemCount: chain.bom.items.length,
        tableName: 'customer_bom_uploads',
        itemTableName: 'customer_bom_upload_items',
      },
      {
        type: 'RFQ',
        label: 'RFQ',
        exists: Boolean(rfqHeader),
        status: statusFromHeader(rfqHeader, ['rfq_status', 'status']),
        header: rfqHeader,
        itemCount: chain.rfq.items.length,
        tableName: rfqHeader?.order_number ? 'rfq_orders0' : 'rfq',
        itemTableName: rfqHeader?.order_number ? 'rfq_order_items0' : 'rfq_items',
      },
      {
        type: 'QUOTE',
        label: 'Quote',
        exists: Boolean(quoteHeader),
        status: statusFromHeader(quoteHeader, ['quote_status', 'status']),
        header: quoteHeader,
        itemCount: chain.quote.items.length,
        tableName: quoteHeader?.supplier_company_name ? 'supplier_quotes0' : 'rfq_quotes',
        itemTableName: quoteHeader?.supplier_company_name ? 'supplier_quote_items0' : 'rfq_quote_items',
      },
      {
        type: 'INVOICE',
        label: 'Invoice',
        exists: Boolean(invoiceHeader),
        status: statusFromHeader(invoiceHeader, ['invoice_status', 'payment_status']),
        header: invoiceHeader,
        itemCount: chain.invoice.items.length,
        tableName: 'procurement_invoices',
        itemTableName: 'procurement_invoice_items',
      },
      {
        type: 'WAYBILL',
        label: 'Waybill',
        exists: Boolean(waybillHeader),
        status: statusFromHeader(waybillHeader, ['waybill_status']),
        header: waybillHeader,
        itemCount: chain.waybill.items.length,
        tableName: 'procurement_waybills',
        itemTableName: 'procurement_waybill_items',
      },
      {
        type: 'RECEIVE_ORDER',
        label: 'Receive Order',
        exists: Boolean(receiveHeader),
        status: statusFromHeader(receiveHeader, ['receive_status']),
        header: receiveHeader,
        itemCount: chain.receiveOrder.items.length,
        tableName: 'procurement_receive_orders',
        itemTableName: 'procurement_receive_order_items',
      },
    ],
  };
};

export async function getProcurementDocumentsByChainId(supabase: SupabaseLike, chainId: string): Promise<{ data: ProcurementDocumentChain; error: any }> {
  const id = normalizeNumber(chainId);
  const empty: ProcurementDocumentChain = {
    procurementChain: null,
    procurementCase: null,
    progress: null,
    bom: { header: null, items: [] },
    rfq: { headers: [], items: [] },
    quote: { headers: [], items: [] },
    invoice: { headers: [], items: [] },
    waybill: { headers: [], items: [] },
    receiveOrder: { headers: [], items: [] },
  };
  if (!id) return { data: empty, error: { message: 'Procurement chain id is required.' } };

  const procurementChain = await getProcurementChainById(supabase, id);
  const progress = await maybeData(supabase.from('procurement_progress').select('*').eq('procurement_chain_id', id).maybeSingle());
  const procurementCase = await maybeData(supabase.from('procurement_cases').select('*').eq('id', id).maybeSingle());

  let [
    bomHeader,
    bomItems,
    rfqHeaders,
    rfq0Headers,
    rfqItems,
    rfq0Items,
    quoteHeaders,
    quote0Headers,
    quoteItems,
    quote0Items,
    invoiceHeaders,
    invoiceItems,
    waybillHeaders,
    waybillItems,
    receiveHeaders,
    receiveItems,
  ] = await Promise.all([
    maybeData(supabase.from('customer_bom_uploads').select('*').eq('procurement_chain_id', id).maybeSingle()),
    maybeData(supabase.from('customer_bom_upload_items').select('*').eq('procurement_chain_id', id).order('row_number', { ascending: true })),
    maybeData(supabase.from('rfq').select('*').eq('procurement_chain_id', id).order('created_date', { ascending: false })),
    maybeData(supabase.from('rfq_orders0').select('*').eq('procurement_chain_id', id).order('created_at', { ascending: false })),
    maybeData(supabase.from('rfq_items').select('*').eq('procurement_chain_id', id).order('rec_num', { ascending: true })),
    maybeData(supabase.from('rfq_order_items0').select('*').eq('procurement_chain_id', id).order('line_number', { ascending: true })),
    maybeData(supabase.from('rfq_quotes').select('*').eq('procurement_chain_id', id)),
    maybeData(supabase.from('supplier_quotes0').select('*').eq('procurement_chain_id', id).order('created_at', { ascending: false })),
    maybeData(supabase.from('rfq_quote_items').select('*').eq('procurement_chain_id', id)),
    maybeData(supabase.from('supplier_quote_items0').select('*').eq('procurement_chain_id', id).order('line_number', { ascending: true })),
    maybeData(supabase.from('procurement_invoices').select('*').eq('procurement_chain_id', id).order('created_at', { ascending: false })),
    maybeData(supabase.from('procurement_invoice_items').select('*').eq('procurement_chain_id', id).order('line_number', { ascending: true })),
    maybeData(supabase.from('procurement_waybills').select('*').eq('procurement_chain_id', id).order('created_at', { ascending: false })),
    maybeData(supabase.from('procurement_waybill_items').select('*').eq('procurement_chain_id', id).order('line_number', { ascending: true })),
    maybeData(supabase.from('procurement_receive_orders').select('*').eq('procurement_chain_id', id).order('created_at', { ascending: false })),
    maybeData(supabase.from('procurement_receive_order_items').select('*').eq('procurement_chain_id', id).order('line_number', { ascending: true })),
  ]);

  // Older or partially backfilled documents may be reachable through canonical source UUIDs
  // even when their direct procurement_chain_id column is missing.
  const sourceBomId = procurementChain.data?.source_bom_upload_id || progress.data?.customer_bom_upload_id || rfq0Headers.data?.[0]?.source_bom_upload_id;
  if (!bomHeader.data && sourceBomId) bomHeader = await maybeData(supabase.from('customer_bom_uploads').select('*').eq('id', sourceBomId).maybeSingle());
  if (!(bomItems.data ?? []).length && sourceBomId) bomItems = await maybeData(supabase.from('customer_bom_upload_items').select('*').eq('upload_id', sourceBomId).order('row_number', { ascending: true }));
  const sourceRfqId = procurementChain.data?.source_rfq_id || progress.data?.rfq_id || bomHeader.data?.rfq_id;
  if (!(rfq0Headers.data ?? []).length && sourceRfqId) rfq0Headers = await maybeData(supabase.from('rfq_orders0').select('*').eq('rfq_id', sourceRfqId).limit(1));
  const resolvedRfqId = rfq0Headers.data?.[0]?.rfq_id || sourceRfqId;
  if (!(rfq0Items.data ?? []).length && resolvedRfqId) rfq0Items = await maybeData(supabase.from('rfq_order_items0').select('*').eq('rfq_id', resolvedRfqId).order('line_number', { ascending: true }));

  const firstError = [
    procurementChain,
    progress,
    procurementCase,
    bomHeader,
    bomItems,
    rfqHeaders,
    rfq0Headers,
    rfqItems,
    rfq0Items,
    quoteHeaders,
    quote0Headers,
    quoteItems,
    quote0Items,
    invoiceHeaders,
    invoiceItems,
    waybillHeaders,
    waybillItems,
    receiveHeaders,
    receiveItems,
  ].find((result) => result.error)?.error;

  return {
    data: {
      procurementChain: procurementChain.data ?? null,
      procurementCase: procurementCase.data ?? null,
      progress: progress.data ?? null,
      bom: { header: bomHeader.data ?? null, items: bomItems.data ?? [] },
      rfq: { headers: [...(rfqHeaders.data ?? []), ...(rfq0Headers.data ?? [])], items: [...(rfqItems.data ?? []), ...(rfq0Items.data ?? [])] },
      quote: { headers: [...(quoteHeaders.data ?? []), ...(quote0Headers.data ?? [])], items: [...(quoteItems.data ?? []), ...(quote0Items.data ?? [])] },
      invoice: { headers: invoiceHeaders.data ?? [], items: invoiceItems.data ?? [] },
      waybill: { headers: waybillHeaders.data ?? [], items: waybillItems.data ?? [] },
      receiveOrder: { headers: receiveHeaders.data ?? [], items: receiveItems.data ?? [] },
    },
    error: firstError ?? null,
  };
}

export async function getProcurementChainOverviewById(supabase: SupabaseLike, chainId: string): Promise<{ data: ProcurementChainOverview | null; error: any }> {
  const result = await getProcurementDocumentsByChainId(supabase, chainId);
  if (result.error) return { data: null, error: result.error };
  const chain = result.data;
  const canonical = chain.procurementChain ?? chain.procurementCase ?? null;
  const procurementNumber = normalizeNumber(canonical?.procurement_number || chain.progress?.procurement_number);
  if (!canonical && !chain.progress) return { data: null, error: null };
  return { data: buildProcurementOverview(chainId, procurementNumber || '-', chain), error: null };
}

export async function getProcurementChainOverviewByNumber(supabase: SupabaseLike, documentNumber: string): Promise<{ data: ProcurementChainOverview | null; error: any }> {
  const result = await getProcurementDocumentsByNumber(supabase, documentNumber);
  if (result.error) return { data: null, error: result.error };

  const chain = result.data;
  const bomHeader = chain.bom.header;
  const rfqHeader = chain.rfq.headers[0] ?? null;
  const quoteHeader = chain.quote.headers[0] ?? null;
  const invoiceHeader = chain.invoice.headers[0] ?? null;
  const waybillHeader = chain.waybill.headers[0] ?? null;
  const receiveHeader = chain.receiveOrder.headers[0] ?? null;

  return {
    data: {
      documentNumber,
      progress: chain.progress,
      procurementChain: chain.procurementChain,
      procurementCase: chain.procurementCase,
      chain,
      documents: [
        {
          type: 'BOM',
          label: 'BOM',
          exists: Boolean(bomHeader),
          status: statusFromHeader(bomHeader, ['status', 'ai_processing_status']),
          header: bomHeader,
          itemCount: chain.bom.items.length,
          tableName: 'customer_bom_uploads',
          itemTableName: 'customer_bom_upload_items',
        },
        {
          type: 'RFQ',
          label: 'RFQ',
          exists: Boolean(rfqHeader),
          status: statusFromHeader(rfqHeader, ['rfq_status', 'status']),
          header: rfqHeader,
          itemCount: chain.rfq.items.length,
          tableName: rfqHeader?.order_number ? 'rfq_orders0' : 'rfq',
          itemTableName: rfqHeader?.order_number ? 'rfq_order_items0' : 'rfq_items',
        },
        {
          type: 'QUOTE',
          label: 'Quote',
          exists: Boolean(quoteHeader),
          status: statusFromHeader(quoteHeader, ['quote_status', 'status']),
          header: quoteHeader,
          itemCount: chain.quote.items.length,
          tableName: quoteHeader?.supplier_company_name ? 'supplier_quotes0' : 'rfq_quotes',
          itemTableName: quoteHeader?.supplier_company_name ? 'supplier_quote_items0' : 'rfq_quote_items',
        },
        {
          type: 'INVOICE',
          label: 'Invoice',
          exists: Boolean(invoiceHeader),
          status: statusFromHeader(invoiceHeader, ['invoice_status', 'payment_status']),
          header: invoiceHeader,
          itemCount: chain.invoice.items.length,
          tableName: 'procurement_invoices',
          itemTableName: 'procurement_invoice_items',
        },
        {
          type: 'WAYBILL',
          label: 'Waybill',
          exists: Boolean(waybillHeader),
          status: statusFromHeader(waybillHeader, ['waybill_status']),
          header: waybillHeader,
          itemCount: chain.waybill.items.length,
          tableName: 'procurement_waybills',
          itemTableName: 'procurement_waybill_items',
        },
        {
          type: 'RECEIVE_ORDER',
          label: 'Receive Order',
          exists: Boolean(receiveHeader),
          status: statusFromHeader(receiveHeader, ['receive_status']),
          header: receiveHeader,
          itemCount: chain.receiveOrder.items.length,
          tableName: 'procurement_receive_orders',
          itemTableName: 'procurement_receive_order_items',
        },
      ],
    },
    error: null,
  };
}

export async function getProcurementDocumentsByProgressId(supabase: SupabaseLike, progressId: string) {
  const progress = await maybeData(supabase.from('procurement_progress').select('*').eq('id', progressId).maybeSingle());
  if (progress.error || !progress.data) return { data: null, error: progress.error || { message: 'Progress record was not found.' } };

  if (!progress.data.procurement_chain_id && progress.data.customer_bom_upload_id) {
    const procurementCase = await getOrCreateProcurementCaseForBom(supabase, progress.data.customer_bom_upload_id);
    if (procurementCase.error) return { data: null, error: procurementCase.error };
    if (procurementCase.data?.procurement_number) {
      progress.data.procurement_number = procurementCase.data.procurement_number;
      progress.data.procurement_chain_id = procurementCase.data.procurement_chain_id || procurementCase.data.id;
      progress.data.procurement_case_id = procurementCase.data.id;
    }
  }

  const procurementChainId = normalizeNumber(progress.data.procurement_chain_id);
  if (procurementChainId) {
    const documents = await getProcurementDocumentsByChainId(supabase, procurementChainId);
    if (documents.data) documents.data.progress = progress.data;
    return documents;
  }

  const procurementNumber = normalizeNumber(progress.data.procurement_number);
  if (!procurementNumber) return { data: null, error: { message: 'This progress record is not linked to a procurement number yet.' } };
  const documents = await getProcurementDocumentsByNumber(supabase, procurementNumber);
  if (documents.data) documents.data.progress = progress.data;
  return documents;
}
