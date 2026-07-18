'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AiOrderChatModal from '../components/ai/AiOrderChatModal';
import HubButton from '../components/ui/HubButton';
import InvoiceHubTable from '../components/invoices/InvoiceHubTable';
import { createClient } from '../../lib/supabase/client';

type GenericRow = Record<string, any>;

type CustomerOrderStageKey =
  | 'bom_received'
  | 'rfq'
  | 'quote_received'
  | 'approved'
  | 'payment'
  | 'goods_shipped'
  | 'goods_received'
  | 'order_completed';

type CustomerIdentity = {
  email: string;
  name: string;
  companyName: string;
  avatarUrl: string;
};

const emptyIdentity: CustomerIdentity = {
  email: '',
  name: 'Customer Account',
  companyName: 'Electron Market Buyer',
  avatarUrl: '',
};

const customerOrderStageOrder: CustomerOrderStageKey[] = [
  'bom_received',
  'rfq',
  'quote_received',
  'approved',
  'payment',
  'goods_shipped',
  'goods_received',
  'order_completed',
];

const customerOrderStageMeta: Record<CustomerOrderStageKey, { label: string; bgClass: string; textClass: string }> = {
  bom_received: { label: 'BOM received', bgClass: 'bg-blue-500', textClass: 'text-white' },
  rfq: { label: 'RFQ', bgClass: 'bg-cyan-500', textClass: 'text-white' },
  quote_received: { label: 'Quote Received', bgClass: 'bg-emerald-500', textClass: 'text-white' },
  approved: { label: 'Approved', bgClass: 'bg-orange-500', textClass: 'text-white' },
  payment: { label: 'Payment', bgClass: 'bg-violet-500', textClass: 'text-white' },
  goods_shipped: { label: 'Goods Shipped', bgClass: 'bg-teal-500', textClass: 'text-white' },
  goods_received: { label: 'Goods Received', bgClass: 'bg-amber-400', textClass: 'text-slate-900' },
  order_completed: { label: 'Order Completed', bgClass: 'bg-emerald-700', textClass: 'text-white' },
};

const actionButtonClass = 'inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 hover:text-white';

const formatValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(date);
  }
  return String(value);
};

const humanize = (value: unknown) => formatValue(value).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const formatMoney = (amount: unknown, currency: unknown) => {
  const numeric = Number(amount ?? 0);
  if (!numeric) return '-';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: String(currency || 'USD') }).format(numeric);
  } catch {
    return `${numeric.toLocaleString('en-US')} ${String(currency || '')}`.trim();
  }
};

const normalizeCustomerProgressStage = (stage: unknown, row?: GenericRow): CustomerOrderStageKey => {
  const exactStage = String(stage || '').trim();
  if (customerOrderStageOrder.includes(exactStage as CustomerOrderStageKey)) return exactStage as CustomerOrderStageKey;
  if (row?.customer_bom_upload_id) return 'bom_received';
  return 'bom_received';
};

const getCustomerOrderStage = (order: GenericRow): CustomerOrderStageKey => {
  const exactStage = String(order.current_stage || '').trim();
  if (customerOrderStageOrder.includes(exactStage as CustomerOrderStageKey)) return exactStage as CustomerOrderStageKey;

  const value = [
    order.order_status,
    order.payment_status,
    order.shipping_status,
    order.fulfillment_status,
  ]
    .map((item) => String(item || '').toLowerCase())
    .filter(Boolean)
    .join(' ');

  if (!value.trim()) return 'bom_received';
  if (value.includes('completed') || value.includes('closed') || value.includes('funds_sent')) return 'order_completed';
  if (value.includes('goods_received') || value.includes('received') || value.includes('delivered')) return 'goods_received';
  if (value.includes('goods_shipped') || value.includes('shipped') || value.includes('shipping') || value.includes('in_transit')) return 'goods_shipped';
  if (value.includes('payment_sent') || value.includes('buyer_paid') || value.includes('paid') || value.includes('payment')) return 'payment';
  if (value.includes('approved') || value.includes('rejected') || value.includes('cancelled') || value.includes('accepted')) return 'approved';
  if (value.includes('quote_received') || value.includes('quote_sent') || value.includes('confirmed')) return 'quote_received';
  if (value.includes('draft') || value.includes('rfq_created') || value.includes('submitted') || value.includes('sent_to_supplier') || value.includes('created') || value.includes('rfq') || value.includes('open')) return 'rfq';
  return 'bom_received';
};

function CustomerStageProgress({ order }: { order: GenericRow }) {
  const currentStage = getCustomerOrderStage(order);
  const currentIndex = customerOrderStageOrder.indexOf(currentStage);

  return (
    <div className="flex min-w-[260px] items-center gap-2">
      {customerOrderStageOrder.map((stage, index) => {
        const meta = customerOrderStageMeta[stage];
        const isActive = index <= currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <span
            key={stage}
            title={meta.label}
            aria-label={meta.label}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition ${
              isActive
                ? `${meta.bgClass} ${meta.textClass} border-transparent`
                : 'border-slate-300 bg-slate-200 text-slate-500'
            } ${
              isCurrent ? 'ring-2 ring-blue-100' : ''
            }`}
          >
            {index + 1}
          </span>
        );
      })}
    </div>
  );
}

function CustomerStageBadge({ stage }: { stage: CustomerOrderStageKey }) {
  const meta = customerOrderStageMeta[stage];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${meta.bgClass} ${meta.textClass}`}>
      {meta.label}
    </span>
  );
}

function CustomerProgressStageBadge({ row }: { row: GenericRow }) {
  const stage = normalizeCustomerProgressStage(row.current_stage, row);
  const meta = customerOrderStageMeta[stage];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${meta.bgClass} ${meta.textClass}`}>
      {row.current_stage_label || meta.label}
    </span>
  );
}

function CustomerProgressStageProgress({ row }: { row: GenericRow }) {
  const currentStage = normalizeCustomerProgressStage(row.current_stage, row);
  const currentIndex = customerOrderStageOrder.indexOf(currentStage);

  return (
    <div className="flex min-w-[260px] items-center gap-2">
      {customerOrderStageOrder.map((stage, index) => {
        const meta = customerOrderStageMeta[stage];
        const isActive = index <= currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <span
            key={stage}
            title={meta.label}
            aria-label={meta.label}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition ${
              isActive
                ? `${meta.bgClass} ${meta.textClass} border-transparent`
                : 'border-slate-300 bg-slate-200 text-slate-500'
            } ${
              isCurrent ? 'ring-2 ring-blue-100' : ''
            }`}
          >
            {index + 1}
          </span>
        );
      })}
    </div>
  );
}

function SectionCard({ title, children, action, className = '' }: { title: string; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <section className={`w-full max-w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-blue-900">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">{children}</div>;
}

function StatusBadge({ value }: { value: unknown }) {
  return (
    <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
      {humanize(value)}
    </span>
  );
}

function DataTable({
  columns,
  rows,
  emptyText,
  onRowActivate,
}: {
  columns: Array<{ key: string; label: string; sticky?: boolean; render?: (row: GenericRow) => React.ReactNode }>;
  rows: GenericRow[];
  emptyText: string;
  onRowActivate?: (row: GenericRow) => void;
}) {
  return (
    <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-[920px] text-left text-sm">
        <thead className="bg-blue-600 text-white">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide ${column.sticky?'sticky left-0 z-20 bg-blue-700 shadow-[2px_0_4px_rgba(15,23,42,.18)]':''}`}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-slate-500">
                {emptyText}
              </td>
            </tr>
          ) : rows.map((row, index) => (
            <tr key={String(row.id ?? row.rfq_id ?? row.quote_id ?? row.order_number ?? row.file_name ?? index)} role={onRowActivate?'link':undefined} tabIndex={onRowActivate?0:undefined} onClick={()=>onRowActivate?.(row)} onKeyDown={event=>{if(onRowActivate&&(event.key==='Enter'||event.key===' ')){event.preventDefault();onRowActivate(row)}}} className={`${onRowActivate?'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ':''}hover:bg-blue-50/50`}>
              {columns.map((column) => (
                <td key={column.key} className={`px-4 py-3 text-slate-700 ${column.sticky?'sticky left-0 z-10 bg-white shadow-[2px_0_4px_rgba(15,23,42,.12)]':''}`}>
                  {column.render ? column.render(row) : formatValue(row[column.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CustomerHubPage() {
  const supabase = useMemo(() => createClient(), []);
  const [, setIdentity] = useState<CustomerIdentity>(emptyIdentity);
  const [rfqs, setRfqs] = useState<GenericRow[]>([]);
  const [quotes, setQuotes] = useState<GenericRow[]>([]);
  const [orders, setOrders] = useState<GenericRow[]>([]);
  const [progressRows, setProgressRows] = useState<GenericRow[]>([]);
  const [bomFiles, setBomFiles] = useState<GenericRow[]>([]);
  const [messages, setMessages] = useState<GenericRow[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<GenericRow | null>(null);
  const [bomLoadFailed, setBomLoadFailed] = useState(false);
  const [invoices, setInvoices] = useState<GenericRow[]>([]);
  const [waybills, setWaybills] = useState<GenericRow[]>([]);
  const [receives, setReceives] = useState<GenericRow[]>([]);
  const [aiSessions, setAiSessions] = useState<GenericRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiOpen, setAiOpen] = useState(false);
  const [progressAction, setProgressAction] = useState('');

  useEffect(() => {
    let active = true;

    const addError = (label: string, message?: string) => {
      if (!message) return;
      setErrors((current) => [...current, `${label}: ${message}`]);
    };

    const loadCustomerHub = async () => {
      setLoading(true);
      setErrors([]);
      setBomLoadFailed(false);

      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!active) return;

      if (!user) {
        setIdentity(emptyIdentity);
        setRfqs([]);
        setQuotes([]);
        setOrders([]);
        setProgressRows([]);
        setBomFiles([]);
        setBomLoadFailed(false);
        setMessages([]);
        setAiSessions([]);
        setLoading(false);
        return;
      }

      const metadata = user.user_metadata || {};
      const fallbackEmail = user.email || '';
      const fallbackName = (metadata.full_name as string | undefined) || fallbackEmail || 'Customer Account';
      const fallbackCompany = (metadata.company_name as string | undefined) || 'Electron Market Buyer';
      const avatarUrl = ((metadata.avatar_url as string | undefined) || (metadata.picture as string | undefined) || '').trim();

      const [profileResult, customerProfileResult, rfqResult, orderResult, aiResult] = await Promise.all([
        supabase.from('user_profiles').select('email, full_name, company_name, role, created_at').eq('id', user.id).maybeSingle(),
        supabase.from('customer_company_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('rfq_orders0').select('*').eq('customer_id', user.id).order('created_at', { ascending: false }).limit(30),
        supabase.from('active_orders').select('*').eq('customer_id', user.id).order('created_at', { ascending: false }).limit(30),
        supabase.from('ai_chat_sessions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
      ]);

      if (!active) return;

      addError('User profile', profileResult.error?.message);
      addError('Customer profile', customerProfileResult.error?.message);
      addError('My RFQs', rfqResult.error?.message);
      addError('Active Orders', orderResult.error?.message);
      addError('AI sessions', aiResult.error?.message);

      const profile = profileResult.data as GenericRow | null;
      const customerProfile = customerProfileResult.data as GenericRow | null;
      const rfqRows = (rfqResult.data ?? []) as GenericRow[];
      const orderRows = (orderResult.data ?? []) as GenericRow[];
      const rfqIds = rfqRows.map((row) => String(row.rfq_id || '')).filter(Boolean);
      const orderNumbers = rfqRows.map((row) => String(row.order_number || '')).filter(Boolean);
      let profilePhotoUrl = String(customerProfile?.profile_photo_url || '');
      if (customerProfile?.profile_photo_path) {
        const { data: signedPhoto } = await supabase.storage
          .from('customer-profile-photos')
          .createSignedUrl(String(customerProfile.profile_photo_path), 60 * 60);
        profilePhotoUrl = signedPhoto?.signedUrl || profilePhotoUrl;
      }

      setIdentity({
        email: String(profile?.email || customerProfile?.contact_email || fallbackEmail),
        name: String(profile?.full_name || customerProfile?.contact_name || fallbackName),
        companyName: String(customerProfile?.company_name || profile?.company_name || fallbackCompany),
        avatarUrl: profilePhotoUrl || avatarUrl,
      });
      setRfqs(rfqRows);
      setOrders(orderRows);
      setAiSessions((aiResult.data ?? []) as GenericRow[]);

      const summaryResponse = await fetch('/api/customer/dashboard/summary');
      const summaryResult = await summaryResponse.json().catch(() => ({}));
      if (!active) return;
      const validSummaryResponse = summaryResponse.ok
        && summaryResult.summary
        && Array.isArray(summaryResult.progressRows)
        && Array.isArray(summaryResult.uploadedBomRows);
      if (validSummaryResponse) {
        setDashboardSummary(summaryResult.summary || null);
        setBomLoadFailed(false);
        setProgressRows((summaryResult.progressRows || []) as GenericRow[]);
        setBomFiles((summaryResult.uploadedBomRows || []) as GenericRow[]);
        setInvoices(summaryResult.documents?.invoices || []);
        setWaybills(summaryResult.documents?.waybills || []);
        setReceives(summaryResult.documents?.receives || []);
      } else {
        setDashboardSummary(null);
        setProgressRows([]);
        setBomFiles([]);
        setBomLoadFailed(true);
        addError('Dashboard summary', summaryResult.error || (summaryResponse.ok ? 'The dashboard returned a malformed response.' : 'Customer procurement records could not be loaded.'));
      }

      const quoteQuery = orderNumbers.length > 0
        ? supabase.from('supplier_quotes0').select('*').in('order_number', orderNumbers).order('created_at', { ascending: false }).limit(30)
        : Promise.resolve({ data: [], error: null });
      const messageQuery = rfqIds.length > 0
        ? supabase.from('rfq_messages').select('message_id,rfq_id,supplier_id,sender_user_id,receiver_user_id,message_subject,message_text,message_status,sent_date,read_date').in('rfq_id', rfqIds).order('sent_date', { ascending: false }).limit(20)
        : Promise.resolve({ data: [], error: null });

      const [quoteResult, messageResult] = await Promise.all([quoteQuery, messageQuery]);
      if (!active) return;

      addError('Supplier Quotes', quoteResult.error?.message);
      if (messageResult.error) console.error('Customer Messages query failed.', { code: messageResult.error.code });

      setQuotes((quoteResult.data ?? []) as GenericRow[]);
      setMessages(((messageResult.data ?? []) as GenericRow[]).map((message) => ({ ...message, messageTimestamp: message.sent_date })));
      setLoading(false);
    };

    loadCustomerHub();

    return () => {
      active = false;
    };
  }, [supabase]);

  const moneyLines=(values:GenericRow[]|undefined)=>(values||[]).map(value=>formatMoney(value.amount,value.currency));
  const latestAiSession = aiSessions[0] ?? null;
  const latestBomFile = bomFiles[0] ?? null;
  const latestRfqDraft = rfqs.find((rfq) => String(rfq.rfq_status || rfq.status || '').toLowerCase() === 'draft') ?? null;
  const aiStatus = latestAiSession ? humanize(latestAiSession.status || latestAiSession.chat_status || 'active') : 'No AI sessions yet.';
  const advanceCustomerProgress = async (progressId: string, nextStage: CustomerOrderStageKey, note: string) => {
    const actionKey = `${progressId}:${nextStage}`;
    setProgressAction(actionKey);
    try {
      const response = await fetch(`/api/progress/${progressId}/advance`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ next_stage: nextStage, note }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setErrors((current) => [...current, `Progress: ${result.error || 'Unable to update progress.'}`]); return; }
      setProgressRows((current) => current.map((row) => (row.id === progressId ? result.progress : row)));
    } catch {
      setErrors((current) => [...current, 'Progress: Unable to update procurement progress.']);
    } finally { setProgressAction(''); }
  };

  const kpis = [
    { label: 'Uploaded BOM', value: bomLoadFailed ? 'Unavailable' : (dashboardSummary?.uploadedBomCount ?? 0), caption: 'uploaded files' },
    { label: 'Active RFQ', value: dashboardSummary?.activeRfqCount ?? 0, caption: 'active requests' },
    { label: 'Quotes', value: dashboardSummary?.quoteCount ?? 0, caption: 'supplier quote records' },
    {
      label: 'Active Orders', value: dashboardSummary?.activeOrders?.orderCount ?? 0, caption: 'active orders',
      details: `Invoices ${dashboardSummary?.activeOrders?.invoiceCount ?? 0} · Paid ${dashboardSummary?.activeOrders?.paymentCount ?? 0} · Shipped ${dashboardSummary?.activeOrders?.waybillCount ?? 0}`,
      amounts: moneyLines(dashboardSummary?.activeOrders?.paidAmountByCurrency),
    },
    { label: 'Received', value: dashboardSummary?.received?.orderCount ?? 0, caption: 'received orders', amounts: moneyLines(dashboardSummary?.received?.amountByCurrency) },
  ];

  return (
    <main className="min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-slate-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {loading && <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">Loading customer hub...</div>}
        {errors.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {errors.map((error) => <p key={error}>{error}</p>)}
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {kpis.map((item) => (
            <div key={item.label} className="flex min-h-44 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-500">{item.label}</p>
              <p className="mt-3 text-4xl font-bold text-slate-950">{loading ? '-' : item.value}</p>
              <p className="mt-2 text-xs leading-5 text-blue-700">{item.caption}</p>
              {'details' in item && item.details ? <p className="mt-auto pt-3 text-xs font-semibold leading-5 text-slate-700">{item.details}</p> : null}
              {'amounts' in item && item.amounts?.map((amount) => <p key={amount} className="mt-1 text-xs font-semibold text-slate-700">{amount}</p>)}
            </div>
          ))}
        </section>

        <SectionCard title="Requests">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              <Link href="/customer/bom/upload" className="admin-primary-button">Upload BOM</Link>
              <Link href="/create-request?mode=manual" className="admin-primary-button">Create RFQ Manually</Link>
              <button type="button" onClick={() => setAiOpen(true)} className="admin-primary-button">Ask AI Agent</button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Progress">
          <p className="mb-4 text-sm leading-6 text-slate-600">
            Track BOM uploads, RFQs, quotes, approval, payment, shipping, delivery and completion.
          </p>
          <DataTable
            rows={progressRows}
            emptyText="No progress records yet. Upload a BOM to start tracking."
            columns={[
              { key: 'progress_number', label: 'Progress No', render: (row) => <span className="font-semibold text-slate-950">#{formatValue(row.progress_number)}</span> },
              { key: 'procurement_number', label: 'Procurement No', render: (row) => <span className="font-semibold text-slate-950">{formatValue(row.procurement_number)}</span> },
              { key: 'document_name', label: 'Document / RFQ', render: (row) => formatValue(row.document_name || row.rfq_id || row.customer_bom_upload_id) },
              { key: 'current_stage', label: 'Current Stage', render: (row) => <CustomerProgressStageBadge row={row} /> },
              { key: 'stage_progress', label: 'Progress', render: (row) => <CustomerProgressStageProgress row={row} /> },
              { key: 'updated_at', label: 'Updated', render: (row) => formatValue(row.updated_at || row.created_at) },
              {
                key: 'action',
                label: 'Action',
                render: (row) => (
                  <div className="flex flex-wrap gap-2">
                    {row.current_stage === 'quote_received' && (
                      <HubButton size="sm" onClick={() => advanceCustomerProgress(String(row.id), 'approved', 'Quote approved by customer')} loading={progressAction === `${row.id}:approved`} loadingText="Approving...">Approve Quote</HubButton>
                    )}
                    {row.current_stage === 'goods_shipped' && (
                      <HubButton size="sm" onClick={() => advanceCustomerProgress(String(row.id), 'goods_received', 'Customer confirmed goods received')} loading={progressAction === `${row.id}:goods_received`} loadingText="Confirming...">Confirm Goods Received</HubButton>
                    )}
                    {String(row.procurement_chain_id ?? '').trim() ? (
                      <Link href={`/customer/progress/${encodeURIComponent(String(row.procurement_chain_id).trim())}`} className={`${actionButtonClass} cursor-pointer !text-white hover:!text-white visited:!text-white focus:!text-white`}>View Details</Link>
                    ) : (
                      <span className="inline-flex cursor-not-allowed items-center justify-center rounded-md bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500">Procurement chain unavailable</span>
                    )}
                  </div>
                ),
              },
            ]}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {customerOrderStageOrder.map((stage) => {
              const meta = customerOrderStageMeta[stage];
              return (
                <div key={stage} className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${meta.bgClass} ${meta.textClass}`} aria-hidden="true">{customerOrderStageOrder.indexOf(stage) + 1}</span>
                  {meta.label}
                </div>
              );
            })}
          </div>
        </SectionCard>

        <InvoiceHubTable role="customer" title="Invoices" />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <SectionCard title="RFQ" className="order-2">
            <DataTable
              rows={rfqs}
              emptyText="No RFQs yet."
              onRowActivate={(row)=>{if(row.rfq_id)window.location.href=`/customer/rfqs/${encodeURIComponent(String(row.rfq_id))}`}}
              columns={[
                {key:'action',label:'Action',sticky:true,render:(row)=><Link href={`/customer/rfqs/${encodeURIComponent(String(row.rfq_id||''))}`} aria-label={`View RFQ ${String(row.order_number||row.rfq_id||'')}`} onClick={(event)=>event.stopPropagation()} className="inline-flex items-center justify-center rounded-md border border-white bg-indigo-950 px-3 py-1.5 text-xs font-semibold text-white shadow-md transition hover:bg-blue-100 hover:text-slate-950">View</Link>},
                { key: 'order_number', label: 'RFQ No', render: (row) => <span className="font-semibold text-slate-950">{formatValue(row.order_number)}</span> },
                { key: 'rfq_name', label: 'RFQ Name', render: (row) => formatValue(row.rfq_name || row.category_name || row.buyer_notes || row.order_number) },
                { key: 'rfq_type', label: 'Type', render: (row) => humanize(row.rfq_type || row.request_type || 'RFQ') },
                { key: 'total_items_count', label: 'Items', render: (row) => formatValue(row.total_items_count) },
                { key: 'created_at', label: 'Created Date', render: (row) => formatValue(row.created_at) },
                { key: 'deadline_at', label: 'Required Delivery', render: (row) => formatValue(row.deadline_at || row.required_delivery_at) },
                { key: 'rfq_status', label: 'Status', render: (row) => <StatusBadge value={row.rfq_status || 'open'} /> },
                { key: 'quotes', label: 'Quotes', render: (row) => quotes.filter((quote) => quote.order_number === row.order_number).length },
              ]}
            />
          </SectionCard>

          <SectionCard title="Quotes" className="order-3">
            <div id="supplier-quotes" />
            <DataTable
              rows={quotes}
              emptyText="No supplier quotes yet."
              columns={[
                { key: 'quote_id', label: 'Quote No', render: (row) => <span className="font-semibold text-slate-950">{formatValue(row.quote_number || row.quote_id)}</span> },
                { key: 'order_number', label: 'RFQ No' },
                { key: 'supplier_company_name', label: 'Supplier' },
                { key: 'quote_total', label: 'Total Price', render: (row) => formatMoney(row.quote_total || row.total_price, row.currency) },
                { key: 'currency', label: 'Currency' },
                { key: 'lead_time', label: 'Lead Time', render: (row) => formatValue(row.lead_time_days ? `${row.lead_time_days} days` : row.lead_time) },
                { key: 'quote_status', label: 'Status', render: (row) => <StatusBadge value={row.quote_status || row.status || 'received'} /> },
                { key: 'action', label: 'Action', render: () => <button type="button" className={actionButtonClass}>Compare</button> },
              ]}
            />
          </SectionCard>

          <SectionCard title="Active Orders" className="order-4">
            <DataTable
              rows={orders}
              emptyText="No active orders yet."
              columns={[
                { key: 'order_number', label: 'Order No', render: (row) => <span className="font-semibold text-slate-950">{formatValue(row.order_number)}</span> },
                { key: 'supplier_company_name', label: 'Supplier' },
                { key: 'items', label: 'Items', render: (row) => formatValue(row.total_items_count || row.items_count) },
                { key: 'order_total', label: 'Total Value', render: (row) => formatMoney(row.order_total || row.total_value, row.currency) },
                { key: 'invoice', label: 'Invoice', render: (row) => <StatusBadge value={invoices.find((item) => item.procurement_chain_id === row.procurement_chain_id || item.procurement_number === row.procurement_number)?.invoice_status || 'Not created'} /> },
                { key: 'payment', label: 'Payment', render: (row) => <StatusBadge value={invoices.find((item) => item.procurement_chain_id === row.procurement_chain_id || item.procurement_number === row.procurement_number)?.payment_status || 'Not paid'} /> },
                { key: 'waybill', label: 'Waybill', render: (row) => <StatusBadge value={waybills.find((item) => item.procurement_chain_id === row.procurement_chain_id || item.procurement_number === row.procurement_number)?.waybill_status || 'Not created'} /> },
                { key: 'current_stage', label: 'Current Stage', render: (row) => <CustomerStageBadge stage={getCustomerOrderStage(row)} /> },
                { key: 'expected_delivery_at', label: 'Delivery Date', render: (row) => formatValue(row.expected_delivery_at || row.delivery_date) },
                { key: 'order_status', label: 'Status', render: (row) => <StatusBadge value={row.order_status || 'active'} /> },
                { key: 'action', label: 'Action', render: () => <button type="button" className={actionButtonClass}>View</button> },
              ]}
            />
          </SectionCard>

          <SectionCard title="Uploaded BOM" className="order-1">
            <DataTable
              rows={bomFiles}
              emptyText={bomLoadFailed ? 'Uploaded BOM records could not be loaded.' : 'No uploaded BOM files yet.'}
              columns={[
                { key: 'procurement_number', label: 'Procurement No', render: (row) => <span className="font-semibold text-slate-950">{formatValue(row.procurement_number)}</span> },
                { key: 'customer_reference', label: 'Customer Reference', render: (row) => formatValue(row.customer_reference || row.document_name) },
                { key: 'document_name', label: 'Original File', render: (row) => <span className="font-semibold text-slate-950">{formatValue(row.original_file_name || row.document_name || row.file_name || row.bom_file_name)}</span> },
                { key: 'uploaded_date', label: 'Uploaded Date', render: (row) => formatValue(row.uploaded_date || row.created_at) },
                { key: 'ai_processing_status', label: 'AI Status', render: (row) => <StatusBadge value={row.ai_processing_status || row.ai_analysis_status || row.analysis_status || row.status || 'pending'} /> },
                { key: 'items', label: 'Items', render: (row) => formatValue(row.total_items || row.items_count || row.total_rows) },
                {
                  key: 'action',
                  label: 'Action',
                  render: (row) => <div className="flex flex-wrap gap-2">{row.id ? <Link href={`/customer/bom-uploads/${row.id}`} className={`${actionButtonClass} !text-white`}>View</Link> : null}{row.procurement_chain_id && row.has_document ? <a href={`/api/customer/procurement-chains/${encodeURIComponent(String(row.procurement_chain_id))}/documents/bom/download`} target="_blank" rel="noopener noreferrer" className={`${actionButtonClass} !text-white`}>Doc</a> : null}</div>,
                },
              ]}
            />
          </SectionCard>

          <SectionCard title="Receive" className="order-5">
            <DataTable
              rows={receives}
              emptyText="No received orders yet."
              columns={[
                { key: 'receive_order_number', label: 'Receive Order No', render: (row) => <span className="font-semibold text-slate-950">{formatValue(row.receive_order_number || row.id)}</span> },
                { key: 'procurement_number', label: 'Procurement No' },
                { key: 'received_date', label: 'Received Date', render: (row) => formatValue(row.received_date) },
                { key: 'receive_status', label: 'Status', render: (row) => <StatusBadge value={row.receive_status || 'pending'} /> },
                { key: 'updated_at', label: 'Updated', render: (row) => formatValue(row.updated_at) },
                { key: 'action', label: 'Action', render: (row) => row.procurement_chain_id ? <Link href={`/customer/progress/${encodeURIComponent(String(row.procurement_chain_id))}`} className={`${actionButtonClass} !text-white`}>View Details</Link> : '-' },
              ]}
            />
          </SectionCard>

          <SectionCard title="Messages" className="order-6">
            <DataTable
              rows={messages}
              emptyText="No messages yet."
              columns={[
                { key: 'from', label: 'From', render: (row) => formatValue(row.sender_name || row.from || row.supplier_company_name) },
                { key: 'related', label: 'Related RFQ / Order', render: (row) => formatValue(row.order_number || row.rfq_id || row.active_order_id) },
                { key: 'subject', label: 'Subject', render: (row) => <span className="font-semibold text-slate-950">{formatValue(row.subject || row.title || 'Message')}</span> },
                { key: 'date', label: 'Date', render: (row) => formatValue(row.created_at || row.sent_at) },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status || 'new'} /> },
                { key: 'action', label: 'Action', render: () => <button type="button" className={actionButtonClass}>Open</button> },
              ]}
            />
          </SectionCard>
        </div>

      </div>

      <AiOrderChatModal isOpen={aiOpen} onClose={() => setAiOpen(false)} />
    </main>
  );
}
