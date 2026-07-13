import { NextResponse } from 'next/server';
import { getStageIndex } from '../../../../../lib/procurement-progress/progress';
import { createClient } from '../../../../../lib/supabase/server';

type Row = Record<string, any>;
type Money = { currency: string; amount: number };

const normalized = (value: unknown) => String(value ?? '').trim().toLowerCase();
const uniqueCount = (rows: Row[], field: string) => new Set(rows.map((row) => String(row[field] ?? '')).filter(Boolean)).size;
const totals = (rows: Row[], amountField: string): Money[] => {
  const grouped = new Map<string, number>();
  for (const row of rows) {
    const amount = Number(row[amountField] ?? 0);
    if (!Number.isFinite(amount) || amount === 0) continue;
    const currency = String(row.currency || 'USD').toUpperCase();
    grouped.set(currency, (grouped.get(currency) || 0) + amount);
  }
  return Array.from(grouped, ([currency, amount]) => ({ currency, amount }));
};

const lifecycleKeys = (row: Row) => [row.procurement_chain_id, row.procurement_number, row.order_number]
  .map((value) => String(value ?? '').trim())
  .filter(Boolean);

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const [bomResult, progressResult, chainResult, rfqResult, orderResult, invoiceResult, waybillResult, receiveResult] = await Promise.all([
    supabase
      .from('customer_bom_uploads')
      .select('id, upload_number, procurement_chain_id, procurement_number, document_name, original_file_name, file_path, file_url, created_at, total_rows, valid_rows, warning_rows, error_rows, ai_processing_status, status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase.from('procurement_progress').select('*').eq('customer_user_id', user.id).order('updated_at', { ascending: false }),
    supabase
      .from('procurement_chains')
      .select('id, procurement_number, customer_reference, document_name, source_bom_upload_id')
      .eq('customer_user_id', user.id),
    supabase.from('rfq_orders0').select('rfq_id, order_number, rfq_status').eq('customer_id', user.id),
    supabase.from('active_orders').select('*').eq('customer_id', user.id).order('updated_at', { ascending: false }),
    supabase.from('procurement_invoices').select('id, procurement_chain_id, procurement_number, invoice_number, invoice_status, payment_status, total_amount, currency, supplier_company_name, updated_at').eq('customer_user_id', user.id).order('updated_at', { ascending: false }),
    supabase.from('procurement_waybills').select('id, procurement_chain_id, procurement_number, waybill_number, waybill_status, carrier, tracking_number, shipped_date, actual_delivery_date, updated_at').eq('customer_user_id', user.id).order('updated_at', { ascending: false }),
    supabase.from('procurement_receive_orders').select('id, procurement_chain_id, procurement_number, receive_order_number, receive_status, received_date, updated_at').eq('customer_user_id', user.id).order('updated_at', { ascending: false }),
  ]);

  if (bomResult.error || progressResult.error || chainResult.error) {
    console.error('Customer dashboard canonical data query failed:', {
      bom: bomResult.error?.message,
      progress: progressResult.error?.message,
      chains: chainResult.error?.message,
    });
    return NextResponse.json({ error: 'Customer procurement records could not be loaded.' }, { status: 500 });
  }

  const queryErrors = [rfqResult, orderResult, invoiceResult, waybillResult, receiveResult]
    .map((result) => result.error?.message)
    .filter(Boolean);
  if (queryErrors.length) console.error('Customer dashboard summary query errors:', queryErrors);

  const rfqs = (rfqResult.data || []) as Row[];
  const orderNumbers = rfqs.map((row) => String(row.order_number || '')).filter(Boolean);
  const quoteResult = orderNumbers.length
    ? await supabase.from('supplier_quotes0').select('quote_id, order_number, quote_status').in('order_number', orderNumbers)
    : { data: [], error: null };
  if (quoteResult.error) console.error('Customer quote summary query failed:', quoteResult.error.message);

  const activeRfqs = rfqs.filter((row) => !['', 'draft', 'cancelled', 'closed', 'completed'].includes(normalized(row.rfq_status)));
  const allOrders = (orderResult.data || []) as Row[];
  const activeOrders = allOrders.filter((row) => {
    const finalStage = ['goods_received_by_buyer', 'funds_sent_to_supplier', 'goods_received', 'order_completed'].includes(normalized(row.current_stage));
    const finalStatus = ['completed', 'cancelled'].includes(normalized(row.order_status));
    return !finalStage && !finalStatus && normalized(row.shipping_status) !== 'received' && !row.goods_received_at;
  });
  const activeKeys = new Set(activeOrders.flatMap(lifecycleKeys));
  const belongsToActiveOrder = (row: Row) => lifecycleKeys(row).some((key) => activeKeys.has(key));

  const invoices = (invoiceResult.data || []) as Row[];
  const activeInvoices = invoices.filter(belongsToActiveOrder);
  const paidInvoices = activeInvoices.filter((row) => ['paid', 'completed', 'settled', 'buyer_paid'].includes(normalized(row.payment_status)));
  const waybills = (waybillResult.data || []) as Row[];
  const activeWaybills = waybills.filter(belongsToActiveOrder);
  const shippedWaybills = activeWaybills.filter((row) => row.shipped_date || ['shipped', 'in_transit', 'delivered'].includes(normalized(row.waybill_status)));
  const receives = (receiveResult.data || []) as Row[];
  const received = receives.filter((row) => row.received_date || row.all_items_received || ['received', 'completed', 'confirmed'].includes(normalized(row.receive_status)));
  const receivedKeys = new Set(received.flatMap(lifecycleKeys));
  const receivedInvoices = invoices.filter((row) => lifecycleKeys(row).some((key) => receivedKeys.has(key)));

  const progressRows = ((progressResult.data || []) as Row[]).map((row) => ({
    ...row,
    id: row.id,
    procurement_chain_id: row.procurement_chain_id ?? null,
    procurement_number: row.procurement_number ?? null,
    progress_number: row.progress_number ?? null,
    customer_reference: row.customer_reference ?? row.document_name ?? null,
    source_bom_id: row.customer_bom_upload_id ?? null,
    current_stage: row.current_stage ?? 'bom_received',
    stage_number: Math.max(1, getStageIndex(row.current_stage) + 1),
    updated_at: row.updated_at ?? row.created_at ?? null,
  }));
  const chains = (chainResult.data || []) as Row[];
  const chainsById = new Map(chains.map((chain) => [String(chain.id), chain]));
  const chainsBySourceBomId = new Map(chains.filter((chain) => chain.source_bom_upload_id).map((chain) => [String(chain.source_bom_upload_id), chain]));
  const progressByChainId = new Map(progressRows.filter((row) => row.procurement_chain_id).map((row) => [String(row.procurement_chain_id), row]));
  const uploadedBomRows = ((bomResult.data || []) as Row[]).map((upload) => {
    const chain = chainsById.get(String(upload.procurement_chain_id || '')) || chainsBySourceBomId.get(String(upload.id));
    const procurementChainId = upload.procurement_chain_id || chain?.id || null;
    const progress = progressByChainId.get(String(procurementChainId || ''));
    return {
      id: upload.id,
      upload_number: upload.upload_number,
      procurement_chain_id: procurementChainId,
      procurement_number: chain?.procurement_number || upload.procurement_number || progress?.procurement_number || null,
      customer_reference: chain?.customer_reference || progress?.customer_reference || chain?.document_name || upload.document_name || null,
      document_name: upload.document_name,
      original_file_name: upload.original_file_name,
      created_at: upload.created_at,
      total_rows: upload.total_rows,
      valid_rows: upload.valid_rows,
      warning_rows: upload.warning_rows,
      error_rows: upload.error_rows,
      ai_processing_status: upload.ai_processing_status,
      status: upload.status,
      has_document: Boolean(upload.procurement_chain_id && (upload.file_path || upload.file_url)),
    };
  });

  return NextResponse.json({
    summary: {
      uploadedBomCount: uploadedBomRows.length,
      activeRfqCount: uniqueCount(activeRfqs, 'rfq_id'),
      quoteCount: uniqueCount((quoteResult.data || []) as Row[], 'quote_id'),
      activeOrders: {
        orderCount: uniqueCount(activeOrders, 'active_order_id'),
        invoiceCount: uniqueCount(activeInvoices, 'id'),
        paymentCount: uniqueCount(paidInvoices, 'id'),
        paidAmountByCurrency: totals(paidInvoices, 'total_amount'),
        waybillCount: uniqueCount(shippedWaybills, 'id'),
      },
      received: {
        orderCount: uniqueCount(received, 'id'),
        amountByCurrency: totals(receivedInvoices, 'total_amount'),
      },
    },
    progressRows,
    uploadedBomRows,
    documents: { orders: allOrders, invoices, waybills, receives },
  });
}
