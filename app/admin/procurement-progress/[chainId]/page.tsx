import Link from 'next/link';
import { getProcurementChainOverviewById, type ProcurementChainDocumentSummary } from '../../../../lib/procurement-documents/document-chain';
import { createClient } from '../../../../lib/supabase/server';
import AdminBomRfqAction from './AdminBomRfqAction';

type PageProps = {
  params: Promise<{
    chainId: string;
  }>;
};

const stages = [
  { code: 'bom_received', label: 'BOM received' },
  { code: 'rfq', label: 'RFQ' },
  { code: 'quote_received', label: 'Quote received' },
  { code: 'approved', label: 'Approved' },
  { code: 'payment', label: 'Payment' },
  { code: 'goods_shipped', label: 'Goods shipped' },
  { code: 'goods_received', label: 'Goods received' },
  { code: 'order_completed', label: 'Order completed' },
];

const sectionClass = 'rounded-2xl border border-blue-100 bg-white p-5 shadow-sm';
const labelClass = 'text-xs font-semibold uppercase tracking-wide text-slate-500';
const valueClass = 'mt-1 break-words text-sm font-semibold text-slate-950';

const displayValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(date);
  }
  if (Array.isArray(value)) return value.length ? value.join(', ') : '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const isEligibleBomItem = (item: any) => {
  const partNumber = String(item.manufacturer_part_number || item.normalized_part_number || item.part_number || '').trim();
  const fatalStatuses = new Set(['invalid','error','failed','needs_review','warning']);
  const invalidChecks = new Set(['not_found','invalid_format','error','needs_review','ambiguous','manufacturer_mismatch','suspicious_format']);
  return Boolean(partNumber) && Number(item.quantity) > 0 && (item.validation_errors ?? []).length === 0 && !fatalStatuses.has(String(item.validation_status || 'pending').toLowerCase()) && !invalidChecks.has(String(item.part_number_check_status || 'not_checked').toLowerCase());
};

const humanize = (value: unknown) => displayValue(value).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

function ErrorPanel({ title, message }: { title: string; message: string }) {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
        <Link href="/admin" className="inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 hover:text-white">
          Back to Admin HUB
        </Link>
        <h1 className="mt-5 text-2xl font-bold">{title}</h1>
        <p className="mt-3 text-sm text-red-600">{message}</p>
      </div>
    </main>
  );
}

function InfoGrid({ fields }: { fields: Array<[string, unknown]> }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {fields.map(([label, value]) => (
        <div key={label} className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 p-3">
          <p className={labelClass}>{label}</p>
          <p className={valueClass}>{displayValue(value)}</p>
        </div>
      ))}
    </div>
  );
}

function StageIndicator({ currentStage }: { currentStage: string | null | undefined }) {
  const currentIndex = Math.max(0, stages.findIndex((stage) => stage.code === currentStage));
  return (
    <div className="flex flex-wrap gap-2">
      {stages.map((stage, index) => {
        const active = index <= currentIndex;
        return (
          <div key={stage.code} className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${active ? 'bg-white text-blue-700' : 'bg-slate-200 text-slate-500'}`}>{index + 1}</span>
            {stage.label}
          </div>
        );
      })}
    </div>
  );
}

const documentItems = (summary: ProcurementChainDocumentSummary, chain: any) => {
  if (summary.type === 'BOM') return chain.bom.items;
  if (summary.type === 'RFQ') return chain.rfq.items;
  if (summary.type === 'QUOTE') return chain.quote.items;
  if (summary.type === 'INVOICE') return chain.invoice.items;
  if (summary.type === 'WAYBILL') return chain.waybill.items;
  return chain.receiveOrder.items;
};

function ItemsTable({ items }: { items: Record<string, any>[] }) {
  if (!items.length) return <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No line items available.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100">
      <table className="min-w-[900px] text-left text-sm">
        <thead className="bg-blue-600 text-xs uppercase text-white">
          <tr>
            {['Line', 'Part Number', 'Manufacturer', 'Description', 'Quantity', 'Unit', 'Unit Price', 'Total', 'Currency'].map((heading) => (
              <th key={heading} className="px-3 py-2">{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {items.map((item, index) => (
            <tr key={String(item.id || item.rfq_item_id || item.quote_item_id || item.active_order_item_id || index)}>
              <td className="px-3 py-2">{displayValue(item.line_number ?? item.row_number ?? item.rec_num ?? index + 1)}</td>
              <td className="px-3 py-2 font-semibold text-slate-950">{displayValue(item.part_number ?? item.part_num)}</td>
              <td className="px-3 py-2">{displayValue(item.manufacturer)}</td>
              <td className="px-3 py-2">{displayValue(item.description ?? item.product_name ?? item.name_of_detail ?? item.specification)}</td>
              <td className="px-3 py-2">{displayValue(item.quantity ?? item.requested_quantity ?? item.quoted_quantity ?? item.ordered_quantity ?? item.received_quantity ?? item.amount)}</td>
              <td className="px-3 py-2">{displayValue(item.unit ?? item.quantity_unit)}</td>
              <td className="px-3 py-2">{displayValue(item.unit_price ?? item.target_unit_price)}</td>
              <td className="px-3 py-2">{displayValue(item.line_total ?? item.line_subtotal ?? item.target_total_price)}</td>
              <td className="px-3 py-2">{displayValue(item.currency ?? item.target_currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocumentSection({ summary, chain, procurementNumber }: { summary: ProcurementChainDocumentSummary; chain: any; procurementNumber: string }) {
  const header = summary.header;
  const items = documentItems(summary, chain);

  return (
    <section id={summary.type.toLowerCase()} className={sectionClass}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-blue-700">{summary.label}</h2>
          <p className="text-sm text-slate-500">{summary.tableName} / {summary.itemTableName}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${summary.exists ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
          {summary.exists ? 'Created' : 'Not created yet'}
        </span>
      </div>

      {!summary.exists ? (
        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">Not created yet</p>
      ) : (
        <div className="mt-4 space-y-4">
          <InfoGrid
            fields={[
              ['System Procurement Number', procurementNumber],
              ['Document Type', summary.label],
              ['Status', humanize(summary.status)],
              ['Created Date', header?.created_at || header?.created_date || header?.uploaded_at],
              ['Updated Date', header?.updated_at],
              ['Customer', header?.customer_company_name],
              ['Supplier', header?.supplier_company_name],
              ['Currency', header?.currency || header?.budget_currency],
              ['Total Amount', header?.total_amount || header?.quote_total || header?.order_total || header?.target_budget],
              ['Delivery Date', header?.required_delivery_date || header?.deadline_at || header?.estimated_delivery_date || header?.actual_delivery_date],
              ['Incoterms', header?.preferred_incoterms || header?.incoterms_preference || header?.delivery_terms],
              ['Uploaded File', header?.original_file_name || header?.file_name || header?.file_url || header?.file_path],
              ['Item Count', summary.itemCount],
              ['Notes', header?.notes || header?.buyer_notes || header?.supplier_notes || header?.shipment_notes || header?.customer_notes],
            ]}
          />
          <ItemsTable items={items} />
        </div>
      )}
    </section>
  );
}

export default async function ProcurementProgressDetailsPage({ params }: PageProps) {
  const { chainId: encodedChainId } = await params;
  let chainId = '';

  try {
    chainId = decodeURIComponent(String(encodedChainId || '')).trim();
  } catch {
    chainId = '';
  }

  if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(chainId)) {
    return <ErrorPanel title="Invalid procurement chain id" message="The procurement chain id is missing or invalid." />;
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return <ErrorPanel title="Admin access required" message="You must be signed in as an administrator to view procurement chain details." />;

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role, email, full_name')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (profileError) return <ErrorPanel title="Admin access check failed" message={profileError.message} />;
  if (profile?.role !== 'admin') return <ErrorPanel title="Admin access required" message="Only administrators can view this procurement chain." />;

  const { data: overview, error } = await getProcurementChainOverviewById(supabase, chainId);
  if (error) return <ErrorPanel title="Procurement chain could not be loaded" message={error.message || 'A database query failed.'} />;
  if (!overview || (!overview.progress && !overview.procurementChain && !overview.procurementCase && !overview.documents.some((document) => document.exists))) {
    return <ErrorPanel title="Procurement chain not found" message={`No procurement chain was found for id ${chainId}.`} />;
  }
  const { data: orderPreferences } = await supabase.from('procurement_order_preferences').select('*').eq('procurement_chain_id', chainId).maybeSingle();

  const progress = overview.progress ?? {};
  const procurementChain = overview.procurementChain ?? overview.procurementCase ?? {};
  const procurementNumber = overview.documentNumber || progress.procurement_number || procurementChain.procurement_number || '-';
  const currentStage = progress.current_stage || procurementChain.current_stage || 'bom_received';
  const stageIndex = Math.max(0, stages.findIndex((stage) => stage.code === currentStage)) + 1;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-blue-900/40 bg-blue-950 p-6 text-white shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">Electron Market</p>
              <h1 className="mt-2 text-3xl font-bold">Procurement Chain Details</h1>
              <p className="mt-1 text-sm text-blue-100">Unified document chain for {procurementNumber}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {profile?.email && <span className="max-w-[240px] truncate text-sm font-semibold text-blue-100">{profile.email}</span>}
              <Link href="/admin" className="inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 hover:text-white">
                Back to Admin HUB
              </Link>
            </div>
          </div>
        </header>

        <section className={sectionClass}>
          <h2 className="text-xl font-bold text-blue-700">Procurement Chain Summary</h2>
          <div className="mt-4">
            <InfoGrid
              fields={[
                ['System Procurement Number', procurementNumber],
                ['Procurement Chain UUID', chainId],
                ['Progress Number', progress.progress_number ? `#${progress.progress_number}` : null],
                ['Customer', progress.customer_company_name || procurementChain.customer_company_name],
                ['Supplier', progress.supplier_company_name || procurementChain.supplier_company_name],
                ['Source Type', procurementChain.source_type],
                ['Source Record', procurementChain.source_record_id || procurementChain.source_bom_upload_id || procurementChain.source_rfq_id],
                ['Customer Reference', progress.customer_reference || progress.document_name || procurementChain.customer_reference || procurementChain.document_name],
                ['Current Stage', humanize(currentStage)],
                ['Current Stage Number', `${stageIndex} of ${stages.length}`],
                ['Progress Status', progress.status_note || procurementChain.current_stage_label || procurementChain.status],
                ['Created Date', progress.created_at || procurementChain.created_at],
                ['Last Updated Date', progress.updated_at || procurementChain.updated_at],
              ]}
            />
          </div>
          <div className="mt-5">
            <StageIndicator currentStage={currentStage} />
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className="text-xl font-bold text-blue-700">Document Chain Overview</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {overview.documents.map((document) => (
              <div key={document.type} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold text-slate-950">{document.label}</h3>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${document.exists ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                    {document.exists ? 'Created' : 'Not created yet'}
                  </span>
                </div>
                <dl className="mt-3 space-y-1 text-sm text-slate-600">
                  <div className="flex justify-between gap-3"><dt>Status</dt><dd className="font-semibold text-slate-900">{humanize(document.status)}</dd></div>
                  <div className="flex justify-between gap-3"><dt>Items</dt><dd className="font-semibold text-slate-900">{document.itemCount}</dd></div>
                  <div className="flex justify-between gap-3"><dt>Table</dt><dd className="font-semibold text-slate-900">{document.tableName}</dd></div>
                  <div className="flex justify-between gap-3"><dt>File</dt><dd className="font-semibold text-slate-900">{document.header?.original_file_name || document.header?.file_name || document.header?.file_path ? 'Available' : 'Not available'}</dd></div>
                </dl>
                {document.exists&&document.type==='RFQ'&&document.header?.rfq_id?<Link href={`/admin/rfqs/${document.header.rfq_id}`} className="mt-3 inline-flex rounded-md bg-blue-700 px-3 py-2 text-xs font-bold text-white">Open RFQ</Link>:document.exists&&document.type==='BOM'?<div className="flex flex-wrap gap-2"><a href="#bom" className="mt-3 inline-flex rounded-md border border-blue-700 px-3 py-2 text-xs font-bold text-blue-700">Open BOM</a><AdminBomRfqAction upload={document.header} preferences={orderPreferences} eligibility={{totalCount:overview.chain.bom.items.length,eligibleCount:overview.chain.bom.items.filter(isEligibleBomItem).length}} existingRfqId={overview.documents.find((entry)=>entry.type==='RFQ')?.header?.rfq_id}/></div>:null}
              </div>
            ))}
          </div>
        </section>

        {overview.documents.map((document) => (
          <DocumentSection key={document.type} summary={document} chain={overview.chain} procurementNumber={procurementNumber} />
        ))}
      </div>
    </main>
  );
}
