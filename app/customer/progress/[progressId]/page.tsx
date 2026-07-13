import Link from 'next/link';
import { getProcurementDocumentFile, getProcurementDocumentsByChainId } from '../../../../lib/procurement-documents/document-chain';
import { PROGRESS_STAGES, getStageIndex } from '../../../../lib/procurement-progress/progress';
import { createClient } from '../../../../lib/supabase/server';

const displayValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(date);
  }
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const humanize = (value: unknown) => displayValue(value).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const sectionClass = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm';
const labelClass = 'text-xs font-semibold uppercase tracking-wide text-slate-500';
const valueClass = 'mt-1 break-words text-sm font-semibold text-slate-950';

function InfoGrid({ fields }: { fields: Array<[string, unknown]> }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {fields.map(([label, value]) => (
        <div key={label} className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 p-3">
          <p className={labelClass}>{label}</p>
          <p className={valueClass}>{displayValue(value)}</p>
        </div>
      ))}
    </div>
  );
}

function ItemsTable({ items }: { items: Record<string, any>[] }) {
  if (items.length === 0) return <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No line items yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[760px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2">Line</th>
            <th className="px-3 py-2">Part Number</th>
            <th className="px-3 py-2">Manufacturer</th>
            <th className="px-3 py-2">Description</th>
            <th className="px-3 py-2">Quantity</th>
            <th className="px-3 py-2">Unit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item, index) => (
            <tr key={String(item.id || item.rfq_item_id || item.quote_item_id || item.active_order_item_id || index)}>
              <td className="px-3 py-2">{displayValue(item.line_number ?? item.row_number ?? item.rec_num ?? index + 1)}</td>
              <td className="px-3 py-2 font-semibold text-slate-950">{displayValue(item.part_number ?? item.part_num)}</td>
              <td className="px-3 py-2">{displayValue(item.manufacturer)}</td>
              <td className="px-3 py-2">{displayValue(item.description ?? item.product_name ?? item.name_of_detail ?? item.specification)}</td>
              <td className="px-3 py-2">{displayValue(item.quantity ?? item.requested_quantity ?? item.quoted_quantity ?? item.ordered_quantity ?? item.received_quantity ?? item.amount)}</td>
              <td className="px-3 py-2">{displayValue(item.unit ?? item.quantity_unit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocumentSection({
  title,
  headers,
  items,
  fields,
  downloadUrl,
}: {
  title: string;
  headers: Record<string, any>[];
  items: Record<string, any>[];
  fields: (header: Record<string, any>) => Array<[string, unknown]>;
  downloadUrl?: string | null;
}) {
  if (headers.length === 0) {
    return (
      <section className={sectionClass}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-950">{title}</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Not created yet</span>
        </div>
      </section>
    );
  }

  return (
    <section className={sectionClass}>
      <div className="flex flex-wrap items-center justify-between gap-4"><h2 className="text-lg font-bold text-slate-950">{title}</h2>{downloadUrl ? <a href={downloadUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${title} document`} className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">Doc</a> : null}</div>
      <div className="mt-4 space-y-5">
        {headers.map((header, index) => (
          <div key={String(header.id || header.rfq_id || header.quote_id || header.upload_number || index)} className="space-y-4">
            <InfoGrid fields={fields(header)} />
            <ItemsTable items={items} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function CustomerProgressDetailsPage({ params }: { params: Promise<{ progressId: string }> }) {
  const { progressId } = await params;
  let chainId = '';
  try { chainId = decodeURIComponent(String(progressId || '')).trim(); } catch { chainId = ''; }
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-950">Progress Details</h1>
          <p className="mt-3 text-sm text-slate-600">You must be signed in to view procurement progress.</p>
          <Link href="/login" className="mt-5 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 hover:text-white">Sign in</Link>
        </div>
      </main>
    );
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(chainId);
  if (!isUuid) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-white p-6 shadow-sm">
          <Link href="/customer/dashboard" className="text-sm font-semibold text-blue-700 hover:text-blue-800">Back to Customer HUB</Link>
          <h1 className="mt-4 text-2xl font-bold text-slate-950">Progress Details</h1>
          <p className="mt-3 text-sm text-red-600">Invalid procurement chain identifier.</p>
        </div>
      </main>
    );
  }

  const { data: ownedChain, error: ownershipError } = await supabase.from('procurement_chains').select('id, procurement_number, customer_user_id, customer_reference, status, created_at, updated_at').eq('id', chainId).eq('customer_user_id', authData.user.id).maybeSingle();
  if (ownershipError) console.error('Customer procurement chain ownership lookup failed:', ownershipError.message);
  if (!ownedChain) {
    return <main className="min-h-screen bg-slate-50 px-6 py-10"><div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-white p-6 shadow-sm"><Link href="/customer/dashboard" className="text-sm font-semibold text-blue-700">Back to Customer HUB</Link><h1 className="mt-4 text-2xl font-bold">Procurement Chain Details</h1><p className="mt-3 text-sm text-red-600">You do not have permission to view this procurement chain, or it was not found.</p></div></main>;
  }

  const { data, error } = await getProcurementDocumentsByChainId(supabase, chainId);

  const hasAnyDocument = Boolean(
    data?.bom.header
    || data?.rfq.headers.length
    || data?.quote.headers.length
    || data?.invoice.headers.length
    || data?.waybill.headers.length
    || data?.receiveOrder.headers.length
  );

  if (error || !data || (!data.progress && !data.procurementCase && !hasAnyDocument)) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-white p-6 shadow-sm">
          <Link href="/customer/dashboard" className="text-sm font-semibold text-blue-700 hover:text-blue-800">Back to Customer HUB</Link>
          <h1 className="mt-4 text-2xl font-bold text-slate-950">Progress Details</h1>
          <p className="mt-3 text-sm text-red-600">{error ? 'The procurement details could not be loaded.' : 'No procurement progress record exists for this procurement chain.'}</p>
        </div>
      </main>
    );
  }

  const progress = data.progress ?? {};
  const procurementCase: Record<string, any> = data.procurementChain ?? data.procurementCase ?? ownedChain;
  const procurementNumber = progress.procurement_number || procurementCase.procurement_number;
  const { data: profile } = await supabase.from('user_profiles').select('email, company_name, full_name').eq('id', authData.user.id).maybeSingle();
  const currentStageIndex = Math.max(0, getStageIndex(progress.current_stage || procurementCase.current_stage));
  const bomFile = getProcurementDocumentFile('bom', data.bom.header);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 pb-8">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/customer/dashboard" className="text-sm font-semibold text-blue-700 hover:text-blue-800">Back to Customer HUB</Link>
            <h1 className="mt-2 text-3xl font-bold text-white">Progress Details</h1>
            <p className="mt-1 text-sm text-blue-100">All documents connected by one procurement chain.</p>
          </div>
          <span className="rounded-full bg-blue-100 px-4 py-2 text-sm font-bold text-blue-700">{displayValue(procurementNumber)}</span>
        </div>

        <section className={sectionClass}>
          <h2 className="text-lg font-bold text-slate-950">Procurement Chain</h2>
          <div className="mt-4">
            <InfoGrid
              fields={[
                ['Procurement Number', procurementNumber],
                ['Progress Number', progress.progress_number ? `#${progress.progress_number}` : null],
                ['Current Stage', humanize(progress.current_stage || procurementCase.current_stage)],
                ['Customer Company', progress.customer_company_name || procurementCase.customer_company_name],
                ['Supplier Company', progress.supplier_company_name || procurementCase.supplier_company_name],
                ['Customer Reference', progress.customer_reference || procurementCase.customer_reference || progress.document_name],
                ['Procurement Chain Status', procurementCase.status || progress.status],
                ['BOM Upload Reference', progress.customer_bom_upload_id],
                ['Created Date', progress.created_at || procurementCase.created_at],
                ['Updated Date', progress.updated_at || procurementCase.updated_at],
              ]}
            />
          </div>
        </section>

        <section className={sectionClass}><h2 className="text-lg font-bold text-slate-950">Procurement Progress</h2><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">{PROGRESS_STAGES.map((stage,index)=><div key={stage.code} className={`rounded-xl border p-3 text-center text-xs font-semibold ${index<=currentStageIndex?'border-blue-500 bg-blue-600 text-white':'border-slate-200 bg-slate-50 text-slate-500'}`}><span className="mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/20">{index+1}</span>{stage.label}</div>)}</div></section>

        <DocumentSection
          title="BOM Document"
          downloadUrl={bomFile ? `/api/customer/procurement-chains/${encodeURIComponent(chainId)}/documents/bom/download` : null}
          headers={data.bom.header ? [data.bom.header] : []}
          items={data.bom.items}
          fields={(header) => [
            ['Unified Document Number', procurementNumber],
            ['Document Type', 'BOM'],
            ['BOM Upload No', header.upload_number ? `BOM #${header.upload_number}` : header.id],
            ['Document Name', header.document_name],
            ['Status', humanize(header.status)],
            ['Rows', header.total_rows],
            ['Original File', header.original_file_name],
            ['Created', header.created_at],
          ]}
        />

        <DocumentSection
          title="RFQ Document"
          headers={data.rfq.headers}
          items={data.rfq.items}
          fields={(header) => [
            ['Unified Document Number', procurementNumber],
            ['Document Type', 'RFQ'],
            ['RFQ', header.order_number || header.rfq_name || header.rfq_id],
            ['Status', humanize(header.rfq_status)],
            ['Customer', header.customer_company_name],
            ['Items', header.total_items_count],
            ['Currency', header.currency],
            ['Created', header.created_at || header.created_date],
          ]}
        />

        <DocumentSection
          title="Quote Document"
          headers={data.quote.headers}
          items={data.quote.items}
          fields={(header) => [
            ['Unified Document Number', procurementNumber],
            ['Document Type', 'Quote'],
            ['Quote', header.quote_id],
            ['Status', humanize(header.quote_status)],
            ['Supplier', header.supplier_company_name],
            ['Total', header.quote_total],
            ['Currency', header.currency],
            ['Created', header.created_at || header.created_date],
          ]}
        />

        <DocumentSection
          title="Invoice Document"
          headers={data.invoice.headers}
          items={data.invoice.items}
          fields={(header) => [
            ['Unified Document Number', procurementNumber],
            ['Document Type', 'Invoice'],
            ['Invoice', header.invoice_number || header.id],
            ['Status', humanize(header.invoice_status)],
            ['Payment', humanize(header.payment_status)],
            ['Total', header.total_amount],
            ['Currency', header.currency],
            ['Created', header.created_at],
          ]}
        />

        <DocumentSection
          title="Waybill Document"
          headers={data.waybill.headers}
          items={data.waybill.items}
          fields={(header) => [
            ['Unified Document Number', procurementNumber],
            ['Document Type', 'Waybill'],
            ['Waybill', header.waybill_number || header.id],
            ['Status', humanize(header.waybill_status)],
            ['Carrier', header.carrier],
            ['Tracking', header.tracking_number],
            ['Shipped', header.shipped_date],
            ['Created', header.created_at],
          ]}
        />

        <DocumentSection
          title="Receive Order Document"
          headers={data.receiveOrder.headers}
          items={data.receiveOrder.items}
          fields={(header) => [
            ['Unified Document Number', procurementNumber],
            ['Document Type', 'Receive Order'],
            ['Receive Order', header.receive_order_number || header.id],
            ['Status', humanize(header.receive_status)],
            ['Received Date', header.received_date],
            ['All Items Received', header.all_items_received ? 'Yes' : 'No'],
            ['Damaged Items', header.damaged_items ? 'Yes' : 'No'],
            ['Created', header.created_at],
          ]}
        />
      </div>
    </main>
  );
}
