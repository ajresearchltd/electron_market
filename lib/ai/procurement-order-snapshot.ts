import 'server-only';

import { createHash } from 'crypto';

type SupabaseLike = any;
type Row = Record<string, any>;

export type ProcurementStageCode =
  | 'bom_received'
  | 'rfq'
  | 'quote_received'
  | 'approved'
  | 'payment'
  | 'goods_shipped'
  | 'goods_received'
  | 'order_completed';

export type ProcurementOrderSnapshot = {
  identity: {
    procurementChainId: string;
    procurementNumber: string | null;
    customerReference: string | null;
    bomUploadId: string;
    createdAt: string | null;
    updatedAt: string | null;
  };
  stage: {
    currentStageNumber: number;
    currentStageCode: ProcurementStageCode;
    currentStageLabel: string;
    stageReason: string;
    completedStages: string[];
    nextExpectedStage: string | null;
    actionRequiredFromCustomer: boolean;
    actionRequiredDescription: string | null;
  };
  bom: {
    exists: true;
    justUploaded: boolean;
    originalFileName: string | null;
    itemCount: number;
    totalRequestedQuantity: number | null;
    mappingCompleted: boolean;
    parsingCompleted: boolean;
    parsingErrorCount: number;
  };
  verification: {
    started: boolean;
    completed: boolean;
    totalLines: number;
    verifiedLines: number;
    failedLines: number;
    pendingLines: number;
    duplicateLines: number;
    missingMpnLines: number;
    discontinuedLines: number;
    alternativeCandidateLines: number;
    lastVerifiedAt: string | null;
  };
  preferences: {
    priority: 'price' | 'delivery_time' | 'balanced' | null;
    maxLeadTimeDays: number | null;
    allowedSupplierCountries: string[];
    allowIndependentSuppliers: boolean;
    allowAlternatives: boolean;
    allowSplitDelivery: boolean;
    budgetAmount: number | null;
    budgetCurrency: string | null;
    certificateRequirements: string | null;
  };
  rfq: {
    exists: boolean;
    count: number;
    status: string | null;
    sentAt: string | null;
    anonymousSuppliersInvited: number;
    anonymousSuppliersResponded: number;
    anonymousSuppliersPending: number;
  };
  quotes: {
    exist: boolean;
    count: number;
    currencies: string[];
    quotedBomLines: number;
    fullyCoveredBomLines: number;
    uncoveredBomLines: number;
    lowestTotalByCurrency: Record<string, number>;
    shortestCompleteLeadTimeDays: number | null;
    latestQuoteAt: string | null;
    comparisonReady: boolean;
    validatedResponseCount: number;
    reviewRequiredResponseCount: number;
    partiallyCoveredBomLines: number;
    alternativesAwaitingApproval: number;
  };
  order: { approved: boolean; activeOrderExists: boolean; activeOrderCount: number };
  invoice: { exists: boolean; count: number; paymentStatus: string | null };
  waybill: { exists: boolean; count: number; shipmentStatus: string | null };
  receive: { exists: boolean; count: number; receivedStatus: string | null };
  claims: { exists: boolean; count: number; openCount: number; refundPending: boolean; refundCompleted: boolean };
  documents: { bom: boolean; rfq: boolean; quote: boolean; invoice: boolean; waybill: boolean; receiveOrder: boolean; claim: boolean; refundConfirmation: boolean };
  timeline: Array<{ eventCode: string; label: string; occurredAt: string }>;
  dataAvailability: {
    supplierSearchAvailable: boolean;
    supplierResponsesAvailable: boolean;
    priceDataAvailable: boolean;
    leadTimeDataAvailable: boolean;
    moqDataAvailable: boolean;
    certificateDataAvailable: boolean;
    shippingDataAvailable: boolean;
    receiptDataAvailable: boolean;
  };
};

export type AnonymousQuote = {
  supplierAlias: string;
  status: string | null;
  total: number | null;
  currency: string | null;
  validUntil: string | null;
  quotedLines: number;
  coveredLines: number;
  maxLeadTimeDays: number | null;
  minimumOrderQuantity: number | null;
  certificateAvailability: 'available' | 'unavailable' | 'not_recorded';
};

export type CustomerAiContext = {
  snapshot: ProcurementOrderSnapshot;
  bomIssues: Array<{ rowNumber: number | null; partNumber: string | null; status: string; reason: string }>;
  anonymousQuotes: AnonymousQuote[];
  communications: Array<{
    supplierAlias: string;
    direction: 'outbound' | 'inbound';
    messageType: string;
    bomItemIds: string[];
    summary: string;
    structuredFacts: Record<string, unknown>;
    createdAt: string;
  }>;
  supplierAliases: string[];
  internalSupplierIdentifiers: string[];
};

const STAGES: Array<{ code: ProcurementStageCode; label: string }> = [
  { code: 'bom_received', label: 'BOM received' },
  { code: 'rfq', label: 'RFQ' },
  { code: 'quote_received', label: 'Quote Received' },
  { code: 'approved', label: 'Approved' },
  { code: 'payment', label: 'Payment' },
  { code: 'goods_shipped', label: 'Goods Shipped' },
  { code: 'goods_received', label: 'Goods Received' },
  { code: 'order_completed', label: 'Order Completed' },
];

const list = (value: any) => Array.isArray(value) ? value : [];
const numberOrNull = (value: any) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const latest = (rows: Row[], field: string) => rows.map((row) => row[field]).filter(Boolean).sort().at(-1) ?? null;
const statusIncludes = (value: unknown, terms: string[]) => terms.some((term) => String(value ?? '').toLowerCase().includes(term));
const isVerified = (status: unknown) => ['found_internal', 'found_octopart_exact', 'found_exact'].includes(String(status ?? '').toLowerCase());
const isFailed = (status: unknown) => ['not_found', 'invalid_format', 'error'].includes(String(status ?? '').toLowerCase());
const isPending = (status: unknown) => !status || ['not_checked', 'pending'].includes(String(status).toLowerCase());
const allowlistedCommunicationFacts = (value: unknown) => {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const allowed = ['stockConfirmed', 'availableQuantity', 'moq', 'unitPrice', 'currency', 'leadTimeDays', 'certificateAvailable', 'alternativeProposed', 'quoteValidUntil', 'customer_confirmed'];
  return Object.fromEntries(allowed.filter((key) => Object.prototype.hasOwnProperty.call(source, key)).map((key) => [key, source[key]]));
};

async function rows(query: any): Promise<Row[]> {
  try {
    const result = await query;
    return result?.error ? [] : list(result?.data);
  } catch {
    return [];
  }
}

const aliasFromIndex = (index: number) => {
  let value = index + 1;
  let letters = '';
  while (value > 0) {
    value -= 1;
    letters = String.fromCharCode(65 + (value % 26)) + letters;
    value = Math.floor(value / 26);
  }
  return `Supplier ${letters}`;
};

async function resolveAliases(client: SupabaseLike, chainId: string, supplierKeys: string[]) {
  const unique = [...new Set(supplierKeys.filter(Boolean))];
  if (!unique.length) return new Map<string, string>();

  const existing = await rows(client.from('procurement_supplier_aliases').select('supplier_key,alias_label').eq('procurement_chain_id', chainId));
  const result = new Map(existing.map((row) => [String(row.supplier_key), String(row.alias_label)]));
  let nextIndex = existing.length;
  const missing = unique.filter((key) => !result.has(key));
  for (const key of missing) {
    const alias = aliasFromIndex(nextIndex++);
    const inserted = await client.from('procurement_supplier_aliases').insert({ procurement_chain_id: chainId, supplier_key: key, alias_label: alias }).select('alias_label').maybeSingle();
    if (!inserted?.error && inserted?.data?.alias_label) result.set(key, inserted.data.alias_label);
  }

  // Safe deterministic fallback while the manual alias migration is pending. It never exposes the key.
  if (result.size !== unique.length) {
    const used = new Set(result.values());
    const ordered = unique
      .filter((key) => !result.has(key))
      .sort((a, b) => createHash('sha256').update(`${chainId}:${a}`).digest('hex').localeCompare(createHash('sha256').update(`${chainId}:${b}`).digest('hex')));
    for (const key of ordered) {
      let alias = aliasFromIndex(0);
      let index = 0;
      while (used.has(alias)) alias = aliasFromIndex(++index);
      used.add(alias);
      result.set(key, alias);
    }
  }
  return result;
}

function determineStage(data: {
  verificationCompleted: boolean;
  rfqs: Row[];
  quotes: Row[];
  orders: Row[];
  invoices: Row[];
  waybills: Row[];
  receiveOrders: Row[];
  progress: Row | null;
}) {
  const { rfqs, quotes, orders, invoices, waybills, receiveOrders, progress } = data;
  let index = 0;
  let reason = 'A canonical BOM upload exists.';
  if (rfqs.length) { index = 1; reason = 'At least one RFQ record exists for this procurement chain.'; }
  if (quotes.length) { index = 2; reason = 'At least one supplier Quote record exists for this procurement chain.'; }
  if (orders.length || progress?.approved_at) { index = 3; reason = 'An active order or recorded customer approval exists.'; }
  if (invoices.length || orders.some((row) => !statusIncludes(row.payment_status, ['not_paid', 'unpaid', 'pending']))) { index = 4; reason = 'An Invoice/payment-stage record exists.'; }
  if (waybills.length || orders.some((row) => statusIncludes(row.shipping_status, ['shipped', 'received']))) { index = 5; reason = 'A Waybill or shipped order status exists.'; }
  if (receiveOrders.length || orders.some((row) => statusIncludes(row.shipping_status, ['received']))) { index = 6; reason = 'A Receive Order or received order status exists.'; }
  if (orders.some((row) => statusIncludes(row.order_status, ['completed'])) || progress?.order_completed_at) { index = 7; reason = 'The canonical order/progress record is completed.'; }
  const stage = STAGES[index];
  let action: string | null = null;
  if (index === 0 && !data.verificationCompleted) action = 'Verify part numbers.';
  else if (index === 0) action = 'Prepare and confirm the RFQ.';
  else if (index === 1 && !quotes.length) action = 'Wait for anonymous supplier responses and Quotes.';
  else if (index === 2 && !orders.length) action = 'Review and explicitly approve a Quote.';
  else if (index === 3 && !invoices.length) action = 'Wait for the Invoice.';
  else if (index === 4) action = 'Complete the authorized payment step when ready.';
  else if (index === 5) action = 'Track shipment and confirm receiving after inspection.';
  else if (index === 6) action = 'Review receiving discrepancies and complete the order.';
  return {
    currentStageNumber: index + 1,
    currentStageCode: stage.code,
    currentStageLabel: stage.label,
    stageReason: reason,
    completedStages: STAGES.slice(0, index).map((item) => item.code),
    nextExpectedStage: STAGES[index + 1]?.code ?? null,
    actionRequiredFromCustomer: Boolean(action && !action.startsWith('Wait')),
    actionRequiredDescription: action,
  };
}

export async function getProcurementOrderSnapshotForAI({
  database,
  authenticatedUserId,
  procurementChainId,
  bomUploadId,
}: {
  database: SupabaseLike;
  authenticatedUserId: string;
  procurementChainId: string;
  bomUploadId: string;
}): Promise<CustomerAiContext> {
  const chainResult = await database.from('procurement_chains')
    .select('id,procurement_number,customer_reference,customer_user_id,created_at,updated_at')
    .eq('id', procurementChainId).eq('customer_user_id', authenticatedUserId).maybeSingle();
  if (chainResult?.error || !chainResult?.data) throw new Error('Procurement chain access was rejected.');

  const uploadResult = await database.from('customer_bom_uploads')
    .select('id,user_id,procurement_chain_id,original_file_name,total_rows,error_rows,status,ai_processing_status,column_mapping,main_column_mapping,secondary_column_mapping,created_at,updated_at')
    .eq('id', bomUploadId).eq('user_id', authenticatedUserId).eq('procurement_chain_id', procurementChainId).maybeSingle();
  if (uploadResult?.error || !uploadResult?.data) throw new Error('BOM upload access was rejected.');

  const [items, preferenceRows, progressRows, rfqs, assignments, quotes, quoteItems, orders, invoices, waybills, receiveOrders, communications] = await Promise.all([
    rows(database.from('customer_bom_upload_items').select('id,row_number,part_number,normalized_part_number,quantity,validation_status,validation_errors,validation_warnings,part_number_check_status,part_number_check_message,part_number_verified_at,acceptable_alternatives').eq('upload_id', bomUploadId).eq('user_id', authenticatedUserId).eq('procurement_chain_id', procurementChainId).order('row_number')),
    rows(database.from('procurement_order_preferences').select('search_priority,max_lead_time_days,supplier_countries,allow_independent_suppliers,allow_alternatives,allow_split_delivery,budget_amount,budget_currency,certificate_requirements').eq('procurement_chain_id', procurementChainId).eq('customer_user_id', authenticatedUserId).limit(1)),
    rows(database.from('procurement_progress').select('id,current_stage,current_stage_label,status_note,bom_received_at,rfq_sent_at,quote_received_at,approved_at,payment_at,goods_shipped_at,goods_received_at,order_completed_at,updated_at').eq('procurement_chain_id', procurementChainId).eq('customer_user_id', authenticatedUserId).limit(1)),
    rows(database.from('rfq_orders0').select('rfq_id,rfq_status,created_at,updated_at').eq('procurement_chain_id', procurementChainId).eq('customer_id', authenticatedUserId).order('created_at')),
    rows(database.from('rfq_supplier_assignments').select('rfq_id,supplier_id,assignment_status,assigned_at,supplier_company_name').in('rfq_id', ['00000000-0000-0000-0000-000000000000'])),
    rows(database.from('supplier_quotes0').select('quote_id,rfq_id,supplier_id,supplier_company_name,supplier_contact_name,supplier_email,quote_status,quote_total,currency,valid_until,sent_at,created_at').eq('procurement_chain_id', procurementChainId).order('created_at')),
    rows(database.from('supplier_quote_items0').select('quote_id,rfq_item_id,line_number,requested_quantity,quoted_quantity,unit_price,currency,lead_time_days,availability_status,replacement_allowed').eq('procurement_chain_id', procurementChainId).order('line_number')),
    rows(database.from('active_orders').select('active_order_id,quote_id,current_stage,order_status,payment_status,shipping_status,buyer_decision_at,buyer_paid_at,goods_shipped_at,goods_received_at,created_at').eq('procurement_chain_id', procurementChainId).eq('customer_id', authenticatedUserId)),
    rows(database.from('procurement_invoices').select('id,invoice_status,payment_status,invoice_date,payment_date,created_at').eq('procurement_chain_id', procurementChainId).eq('customer_user_id', authenticatedUserId)),
    rows(database.from('procurement_waybills').select('id,waybill_status,shipped_date,estimated_delivery_date,actual_delivery_date,created_at').eq('procurement_chain_id', procurementChainId).eq('customer_user_id', authenticatedUserId)),
    rows(database.from('procurement_receive_orders').select('id,receive_status,received_date,all_items_received,damaged_items,missing_items,created_at').eq('procurement_chain_id', procurementChainId).eq('customer_user_id', authenticatedUserId)),
    rows(database.from('procurement_supplier_communications').select('supplier_key,direction,message_type,bom_item_ids,customer_visible_summary,structured_facts,created_at').eq('procurement_chain_id', procurementChainId).order('created_at', { ascending: false }).limit(40)),
  ]);

  // The assignment query is intentionally scoped only after owned RFQ IDs are known.
  const assignmentRows = rfqs.length
    ? await rows(database.from('rfq_supplier_assignments').select('rfq_id,supplier_id,assignment_status,assigned_at,supplier_company_name').in('rfq_id', rfqs.map((row) => row.rfq_id)))
    : assignments;
  const [validatedResponses, reviewResponses, inboundResponseItems, coverageRows] = await Promise.all([
    rows(database.from('supplier_responses').select('id,supplier_id,default_currency,quote_valid_until,created_at').eq('procurement_chain_id', procurementChainId).eq('status', 'validated').eq('is_current', true)),
    rows(database.from('supplier_responses').select('id').eq('procurement_chain_id', procurementChainId).eq('needs_review', true).eq('is_current', true)),
    rows(database.from('supplier_response_items').select('supplier_response_id,bom_item_id,requested_quantity,offered_quantity,available_quantity,calculated_unit_price,currency,lead_time_days,moq,certificate_available,response_status,review_status').eq('procurement_chain_id', procurementChainId).eq('is_current', true).neq('review_status', 'pending')),
    rows(database.from('procurement_supplier_coverage').select('*').eq('procurement_chain_id', procurementChainId).limit(1)),
  ]);
  const coverage = coverageRows[0] ?? null;
  const progress = progressRows[0] ?? null;
  const timeline = progress?.id
    ? await rows(database.from('procurement_progress_events').select('stage_code,stage_label,created_at,progress_id').eq('progress_id', progress.id).order('created_at'))
    : [];
  const preference = preferenceRows[0] ?? {};
  const verifiedLines = items.filter((item) => isVerified(item.part_number_check_status)).length;
  const failedLines = items.filter((item) => isFailed(item.part_number_check_status)).length;
  const pendingLines = items.filter((item) => isPending(item.part_number_check_status)).length;
  const verificationStarted = items.some((item) => Boolean(item.part_number_verified_at) || !isPending(item.part_number_check_status));
  const verificationCompleted = items.length > 0 && pendingLines === 0;

  const supplierKeys = [...assignmentRows, ...quotes, ...validatedResponses, ...communications]
    .map((row) => String(row.supplier_id ?? row.supplier_key ?? '').trim()).filter(Boolean);
  const aliases = await resolveAliases(database, procurementChainId, supplierKeys);
  const internalSupplierIdentifiers = [...new Set([...assignmentRows, ...quotes].flatMap((row) => [row.supplier_company_name, row.supplier_contact_name, row.supplier_email]).map((value) => String(value ?? '').trim()).filter(Boolean))];
  const quoteItemsByQuote = new Map<string, Row[]>();
  for (const item of quoteItems) quoteItemsByQuote.set(String(item.quote_id), [...(quoteItemsByQuote.get(String(item.quote_id)) ?? []), item]);
  const legacyAnonymousQuotes: AnonymousQuote[] = quotes.map((quote) => {
    const itemsForQuote = quoteItemsByQuote.get(String(quote.quote_id)) ?? [];
    const key = String(quote.supplier_id ?? '');
    const leadTimes = itemsForQuote.map((item) => numberOrNull(item.lead_time_days)).filter((value): value is number => value !== null);
    return {
      supplierAlias: aliases.get(key) ?? 'Anonymous supplier',
      status: quote.quote_status ?? null,
      total: numberOrNull(quote.quote_total),
      currency: quote.currency ?? null,
      validUntil: quote.valid_until ?? null,
      quotedLines: itemsForQuote.length,
      coveredLines: itemsForQuote.filter((item) => Number(item.quoted_quantity ?? 0) >= Number(item.requested_quantity ?? 0)).length,
      maxLeadTimeDays: leadTimes.length ? Math.max(...leadTimes) : null,
      minimumOrderQuantity: null,
      certificateAvailability: 'not_recorded',
    };
  });
  const validatedItemsByResponse = new Map<string, Row[]>();
  for (const item of inboundResponseItems) validatedItemsByResponse.set(String(item.supplier_response_id), [...(validatedItemsByResponse.get(String(item.supplier_response_id)) ?? []), item]);
  const inboundAnonymousQuotes: AnonymousQuote[] = validatedResponses.map((response) => {
    const responseItems = validatedItemsByResponse.get(String(response.id)) ?? [];
    const leads = responseItems.map((item) => numberOrNull(item.lead_time_days)).filter((value): value is number => value !== null);
    const moqs = responseItems.map((item) => numberOrNull(item.moq)).filter((value): value is number => value !== null);
    return { supplierAlias: aliases.get(String(response.supplier_id)) ?? 'Anonymous supplier', status: 'validated', total: null, currency: response.default_currency ?? responseItems.find((item) => item.currency)?.currency ?? null, validUntil: response.quote_valid_until ?? null, quotedLines: new Set(responseItems.map((item) => item.bom_item_id).filter(Boolean)).size, coveredLines: responseItems.filter((item) => Number(item.available_quantity ?? item.offered_quantity ?? 0) >= Number(item.requested_quantity ?? 0)).length, maxLeadTimeDays: leads.length ? Math.max(...leads) : null, minimumOrderQuantity: moqs.length ? Math.min(...moqs) : null, certificateAvailability: responseItems.some((item) => item.certificate_available === true) ? 'available' : responseItems.some((item) => item.certificate_available === false) ? 'unavailable' : 'not_recorded' };
  });
  const anonymousQuotes = [...legacyAnonymousQuotes, ...inboundAnonymousQuotes];
  const respondedKeys = new Set([...quotes, ...validatedResponses].map((quote) => String(quote.supplier_id ?? '')).filter(Boolean));
  const currencies = [...new Set(quotes.map((quote) => String(quote.currency ?? '').toUpperCase()).filter(Boolean))];
  const lowestTotalByCurrency: Record<string, number> = {};
  for (const quote of quotes) {
    const currency = String(quote.currency ?? '').toUpperCase();
    const total = numberOrNull(quote.quote_total);
    if (currency && total !== null) lowestTotalByCurrency[currency] = Math.min(lowestTotalByCurrency[currency] ?? total, total);
  }
  const quotedLineNumbers = new Set(quoteItems.map((item) => String(item.line_number ?? item.rfq_item_id ?? '')).filter(Boolean));
  const fullyCoveredLineNumbers = new Set(quoteItems.filter((item) => Number(item.quoted_quantity ?? 0) >= Number(item.requested_quantity ?? 0)).map((item) => String(item.line_number ?? item.rfq_item_id ?? '')).filter(Boolean));
  const completeLeadTimes = anonymousQuotes.filter((quote) => quote.quotedLines > 0 && quote.coveredLines === quote.quotedLines && quote.maxLeadTimeDays !== null).map((quote) => quote.maxLeadTimeDays as number);
  const stage = determineStage({ verificationCompleted, rfqs, quotes, orders, invoices, waybills, receiveOrders, progress });
  const itemCount = items.length || Number(uploadResult.data.total_rows ?? 0);
  const totalQuantity = items.length ? items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0) : null;
  const mapping = { ...(uploadResult.data.column_mapping ?? {}), ...(uploadResult.data.main_column_mapping ?? {}), ...(uploadResult.data.secondary_column_mapping ?? {}) };
  const snapshot: ProcurementOrderSnapshot = {
    identity: {
      procurementChainId,
      procurementNumber: chainResult.data.procurement_number ?? null,
      customerReference: chainResult.data.customer_reference ?? null,
      bomUploadId,
      createdAt: chainResult.data.created_at ?? null,
      updatedAt: chainResult.data.updated_at ?? null,
    },
    stage,
    bom: {
      exists: true,
      justUploaded: !verificationStarted && !rfqs.length && !quotes.length,
      originalFileName: uploadResult.data.original_file_name ?? null,
      itemCount,
      totalRequestedQuantity: totalQuantity,
      mappingCompleted: Object.values(mapping).some(Boolean),
      parsingCompleted: !['not_started', 'processing'].includes(String(uploadResult.data.ai_processing_status ?? '')),
      parsingErrorCount: Number(uploadResult.data.error_rows ?? 0),
    },
    verification: {
      started: verificationStarted,
      completed: verificationCompleted,
      totalLines: itemCount,
      verifiedLines,
      failedLines,
      pendingLines,
      duplicateLines: items.filter((item) => JSON.stringify(item.validation_errors ?? []).toLowerCase().includes('duplicate')).length,
      missingMpnLines: items.filter((item) => !String(item.part_number ?? item.normalized_part_number ?? '').trim()).length,
      discontinuedLines: items.filter((item) => String(item.part_number_check_message ?? '').toLowerCase().includes('discontinued')).length,
      alternativeCandidateLines: items.filter((item) => Boolean(String(item.acceptable_alternatives ?? '').trim())).length,
      lastVerifiedAt: latest(items, 'part_number_verified_at'),
    },
    preferences: {
      priority: preference.search_priority ?? null,
      maxLeadTimeDays: numberOrNull(preference.max_lead_time_days),
      allowedSupplierCountries: list(preference.supplier_countries).map(String),
      allowIndependentSuppliers: Boolean(preference.allow_independent_suppliers),
      allowAlternatives: Boolean(preference.allow_alternatives),
      allowSplitDelivery: Boolean(preference.allow_split_delivery),
      budgetAmount: numberOrNull(preference.budget_amount),
      budgetCurrency: preference.budget_currency ?? null,
      certificateRequirements: preference.certificate_requirements ?? null,
    },
    rfq: {
      exists: rfqs.length > 0,
      count: rfqs.length,
      status: rfqs.at(-1)?.rfq_status ?? null,
      sentAt: latest(assignmentRows, 'assigned_at') ?? progress?.rfq_sent_at ?? null,
      anonymousSuppliersInvited: new Set(assignmentRows.map((row) => String(row.supplier_id)).filter(Boolean)).size,
      anonymousSuppliersResponded: respondedKeys.size,
      anonymousSuppliersPending: Math.max(0, new Set(assignmentRows.map((row) => String(row.supplier_id)).filter(Boolean)).size - respondedKeys.size),
    },
    quotes: {
      exist: quotes.length > 0 || validatedResponses.length > 0,
      count: quotes.length + validatedResponses.length,
      currencies,
      quotedBomLines: coverage ? Number(coverage.offered_lines ?? 0) : quotedLineNumbers.size,
      fullyCoveredBomLines: coverage ? Number(coverage.fully_covered_lines ?? 0) : fullyCoveredLineNumbers.size,
      uncoveredBomLines: coverage ? Number(coverage.uncovered_lines ?? 0) : Math.max(0, itemCount - quotedLineNumbers.size),
      lowestTotalByCurrency,
      shortestCompleteLeadTimeDays: completeLeadTimes.length ? Math.min(...completeLeadTimes) : null,
      latestQuoteAt: latest(quotes, 'created_at'),
      comparisonReady: coverage ? Boolean(coverage.comparison_ready) : anonymousQuotes.length > 1,
      validatedResponseCount: validatedResponses.length,
      reviewRequiredResponseCount: reviewResponses.length,
      partiallyCoveredBomLines: Number(coverage?.partially_covered_lines ?? 0),
      alternativesAwaitingApproval: Number(coverage?.alternatives_pending_approval ?? 0),
    },
    order: { approved: orders.length > 0 || Boolean(progress?.approved_at), activeOrderExists: orders.length > 0, activeOrderCount: orders.length },
    invoice: { exists: invoices.length > 0, count: invoices.length, paymentStatus: invoices.at(-1)?.payment_status ?? null },
    waybill: { exists: waybills.length > 0, count: waybills.length, shipmentStatus: waybills.at(-1)?.waybill_status ?? null },
    receive: { exists: receiveOrders.length > 0, count: receiveOrders.length, receivedStatus: receiveOrders.at(-1)?.receive_status ?? null },
    claims: { exists: false, count: 0, openCount: 0, refundPending: false, refundCompleted: orders.some((row) => statusIncludes(row.payment_status, ['refunded'])) },
    documents: { bom: true, rfq: rfqs.length > 0, quote: anonymousQuotes.length > 0, invoice: invoices.length > 0, waybill: waybills.length > 0, receiveOrder: receiveOrders.length > 0, claim: false, refundConfirmation: orders.some((row) => statusIncludes(row.payment_status, ['refunded'])) },
    timeline: timeline.map((event) => ({ eventCode: String(event.stage_code), label: String(event.stage_label), occurredAt: String(event.created_at) })),
    dataAvailability: {
      supplierSearchAvailable: assignmentRows.length > 0,
      supplierResponsesAvailable: respondedKeys.size > 0,
      priceDataAvailable: quotes.some((quote) => numberOrNull(quote.quote_total) !== null) || inboundResponseItems.some((item) => numberOrNull(item.calculated_unit_price) !== null),
      leadTimeDataAvailable: quoteItems.some((item) => numberOrNull(item.lead_time_days) !== null) || inboundResponseItems.some((item) => numberOrNull(item.lead_time_days) !== null),
      moqDataAvailable: inboundResponseItems.some((item) => numberOrNull(item.moq) !== null),
      certificateDataAvailable: inboundResponseItems.some((item) => item.certificate_available !== null),
      shippingDataAvailable: waybills.length > 0,
      receiptDataAvailable: receiveOrders.length > 0,
    },
  };

  const bomIssues = items
    .filter((item) => !isVerified(item.part_number_check_status) || list(item.validation_errors).length || list(item.validation_warnings).length)
    .slice(0, 100)
    .map((item) => ({
      rowNumber: numberOrNull(item.row_number),
      partNumber: item.part_number ?? item.normalized_part_number ?? null,
      status: String(item.part_number_check_status ?? item.validation_status ?? 'pending'),
      reason: String(item.part_number_check_message ?? [...list(item.validation_errors), ...list(item.validation_warnings)].join('; ') ?? 'Review required'),
    }));

  return {
    snapshot,
    bomIssues,
    anonymousQuotes,
    communications: communications.map((message) => ({
      supplierAlias: aliases.get(String(message.supplier_key)) ?? 'Anonymous supplier',
      direction: message.direction === 'outbound' ? 'outbound' : 'inbound',
      messageType: String(message.message_type ?? 'clarification'),
      bomItemIds: list(message.bom_item_ids).map(String),
      summary: String(message.customer_visible_summary ?? ''),
      structuredFacts: allowlistedCommunicationFacts(message.structured_facts),
      createdAt: String(message.created_at),
    })),
    supplierAliases: [...new Set(aliases.values())],
    internalSupplierIdentifiers,
  };
}

export function suggestedQuestionsForStage(snapshot: ProcurementOrderSnapshot) {
  if (!snapshot.verification.completed) return ['What should I do next?', 'How many BOM lines were uploaded?', 'Has part-number verification started?', 'Show my order preferences.'];
  if (!snapshot.rfq.exists) return ['Show verification issues.', 'Which lines require manual review?', 'Are alternatives allowed?', 'Is the BOM ready for RFQ?'];
  if (!snapshot.quotes.exist) return ['How many anonymous suppliers responded?', 'Which BOM lines are still uncovered?', 'What commercial data is still missing?', 'What should I do next?'];
  return ['Compare Cheapest, Fastest, and Balanced.', 'Which positions delay the complete BOM?', 'Which offer best matches my preferences?', 'What commercial information is still missing?'];
}
