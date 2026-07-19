'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import LogoutButton from '../../components/auth/LogoutButton';
import { createClient } from '../../../lib/supabase/client';
import { getCanonicalSupplierForAuthenticatedUser } from '../../../lib/suppliers/canonical';
import SupplierCompanyProfileModal from './components/SupplierCompanyProfileModal';

type RfqOrderRow = {
  rfq_id: string;
  order_number: string;
  delivery_country_name: string | null;
  rfq_status: string | null;
  priority_status: string | null;
  deadline_at: string | null;
  total_items_count: number | null;
  total_requested_quantity: number | null;
  currency: string | null;
  created_at: string | null;
};

type RfqOrderItemRow = {
  rfq_id: string;
  category_name: string | null;
  requested_quantity: number | null;
  line_number: number | null;
};

type RfqAssignmentRow = {
  assignment_id: string;
  rfq_id: string;
  order_number: string;
  assignment_status: string | null;
};

type StageKey =
  | 'bom_received'
  | 'rfq'
  | 'quote_received'
  | 'approved'
  | 'payment'
  | 'goods_shipped'
  | 'goods_received'
  | 'order_completed';

type ActiveOrderRow = {
  orderId: string;
  buyer: string;
  totalValue: string;
  currentStage: StageKey;
  expectedDelivery: string;
};

type IncomingRfqRow = {
  assignmentId: string;
  rfqId: string;
  procurementNumber: string;
  category: string;
  parts: string;
  quantity: string;
  buyerCountry: string;
  deadline: string;
  statusLabel: string;
  actionLabel: string;
};

type SupplierStockUploadRow = {
  id: string;
  upload_number: number | null;
  document_name: string | null;
  original_file_name: string | null;
  created_at: string | null;
  total_rows: number | null;
  valid_rows: number | null;
  error_rows: number | null;
  status: string | null;
  ai_processing_status: string | null;
};

type ProcurementProgressRow = {
  id: string;
  progress_number: number | null;
  document_name: string | null;
  customer_company_name: string | null;
  supplier_company_name: string | null;
  current_stage: string | null;
  current_stage_label: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type StageMeta = {
  label: string;
  bgClass: string;
  textClass: string;
};

const stageOrder: StageKey[] = [
  'bom_received',
  'rfq',
  'quote_received',
  'approved',
  'payment',
  'goods_shipped',
  'goods_received',
  'order_completed',
];

const stageMeta: Record<StageKey, StageMeta> = {
  bom_received: { label: 'BOM received', bgClass: 'bg-blue-500', textClass: 'text-white' },
  rfq: { label: 'RFQ', bgClass: 'bg-cyan-500', textClass: 'text-white' },
  quote_received: { label: 'Quote received', bgClass: 'bg-emerald-500', textClass: 'text-white' },
  approved: { label: 'Approved', bgClass: 'bg-orange-500', textClass: 'text-white' },
  payment: { label: 'Payment', bgClass: 'bg-violet-500', textClass: 'text-white' },
  goods_shipped: { label: 'Goods Shipped', bgClass: 'bg-teal-500', textClass: 'text-white' },
  goods_received: { label: 'Goods received', bgClass: 'bg-amber-400', textClass: 'text-slate-900' },
  order_completed: { label: 'Order completed', bgClass: 'bg-emerald-700', textClass: 'text-white' },
};

const initialCompanyName = 'Your company';

const emptyMetrics = {
  openRfqs: 0,
  quotesSent: 0,
  ordersInProgress: 0,
  paymentsPending: 0,
};

const verificationChecklist = [
  { label: 'Company information completed', status: 'Completed' },
  { label: 'Business registration number provided', status: 'Completed' },
  { label: 'Quality & product disclaimer updated', status: 'Completed' },
  { label: 'Contact email confirmed', status: 'Completed' },
  { label: 'Product categories selected', status: 'Pending' },
  { label: 'Documents uploaded', status: 'Pending' },
  { label: 'Admin approval', status: 'Pending review' },
];

const formatDate = (value: string | null | undefined) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(date);
};

const formatCurrency = (amount: number | string | null | undefined, currency: string | null | undefined) => {
  const numeric = Number(amount ?? 0);
  const code = currency?.trim() || 'USD';

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 0,
    }).format(numeric);
  } catch {
    return `${code} ${numeric.toLocaleString('en-US')}`;
  }
};

const formatDeadline = (value: string | null | undefined) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const diffDays = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    const overdue = Math.abs(diffDays);
    return `${overdue} day${overdue === 1 ? '' : 's'} overdue`;
  }
  if (diffDays === 0) return 'Due today';
  return `${diffDays} day${diffDays === 1 ? '' : 's'} left`;
};

const humanizeKey = (value: string | null | undefined) => {
  if (!value) return '—';
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

const normalizeStage = (value: string | null | undefined): StageKey => {
  if (value && stageOrder.includes(value as StageKey)) {
    return value as StageKey;
  }
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('completed') || normalized.includes('funds_sent')) return 'order_completed';
  if (normalized.includes('received')) return 'goods_received';
  if (normalized.includes('shipped')) return 'goods_shipped';
  if (normalized.includes('paid') || normalized.includes('payment')) return 'payment';
  if (normalized.includes('approved')) return 'approved';
  if (normalized.includes('quote')) return 'quote_received';
  if (normalized.includes('rfq')) return 'rfq';
  return 'bom_received';
};

function StageProgress({ currentStage }: { currentStage: StageKey }) {
  const currentIndex = stageOrder.indexOf(currentStage);

  return (
    <div className="flex flex-wrap gap-2">
      {stageOrder.map((stage, index) => {
        const isFilled = index <= currentIndex;
        const meta = stageMeta[stage];
        return (
          <div key={stage} className="flex flex-col items-center gap-1 text-[10px] font-semibold text-slate-500">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full border ${isFilled ? `${meta.bgClass} ${meta.textClass}` : 'border-slate-300 bg-slate-200 text-slate-500'}`}
              title={meta.label}
              aria-label={meta.label}
            >
              {index + 1}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SectionCard({
  title,
  children,
  link,
  className = '',
  id,
  centeredTitle = false,
}: {
  title: string;
  children: ReactNode;
  link?: React.ReactNode;
  className?: string;
  id?: string;
  centeredTitle?: boolean;
}) {
  return (
    <section id={id} className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <div className={`mb-4 flex items-center gap-4 ${centeredTitle ? 'relative justify-center' : 'justify-between'}`}>
        <h2 className={centeredTitle ? 'text-center text-2xl font-bold tracking-tight text-blue-700' : 'text-xl font-semibold tracking-tight text-slate-900'}>{title}</h2>
        {link && <div className={centeredTitle ? 'absolute right-0 top-1/2 -translate-y-1/2' : ''}>{link}</div>}
      </div>
      {children}
    </section>
  );
}

function AlertBox({ tone, children }: { tone: 'error' | 'warning'; children: ReactNode }) {
  const styles =
    tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-amber-200 bg-amber-50 text-amber-800';

  return <div className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

const tableHeaderCellClass = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white';
const emptyTableCellClass = 'px-4 py-8 text-center text-sm text-slate-600';

const statusBadgeClass = (value: string | null | undefined) => {
  const normalized = (value ?? '').toLowerCase();
  if (normalized.includes('error') || normalized.includes('failed')) return 'bg-red-100 text-red-700';
  if (normalized.includes('warning')) return 'bg-amber-100 text-amber-700';
  if (normalized.includes('valid') || normalized.includes('complete') || normalized.includes('processed')) return 'bg-emerald-100 text-emerald-700';
  return 'bg-blue-100 text-blue-700';
};

export default function SupplierDashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [userEmail, setUserEmail] = useState('');
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [incomingRfqs, setIncomingRfqs] = useState<IncomingRfqRow[]>([]);
  const [activeOrderRows, setActiveOrderRows] = useState<ActiveOrderRow[]>([]);
  const [metrics, setMetrics] = useState(emptyMetrics);
  const [pageLoading, setPageLoading] = useState(true);
  const [metricsError, setMetricsError] = useState('');
  const [rfqError, setRfqError] = useState('');
  const [activeOrdersError, setActiveOrdersError] = useState('');
  const [availabilityUploads, setAvailabilityUploads] = useState<SupplierStockUploadRow[]>([]);
  const [availabilityError, setAvailabilityError] = useState('');
  const [progressRows, setProgressRows] = useState<ProcurementProgressRow[]>([]);
  const [progressError, setProgressError] = useState('');

  const kpiCards = [
    { label: 'Open RFQs', value: metrics.openRfqs, caption: 'Buyer requests waiting for quotes' },
    { label: 'Quotes Sent', value: metrics.quotesSent, caption: 'Commercial offers submitted' },
    { label: 'Orders in Progress', value: metrics.ordersInProgress, caption: 'Active orders across all stages' },
    { label: 'Payments Pending', value: metrics.paymentsPending, caption: 'Funds pending from buyers' },
  ];

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!active || !authData.user) return;
      setUserEmail(authData.user.email || '');

      const metadataCompany = (authData.user.user_metadata?.company_name as string | undefined)?.trim();
      const metadataFullName = (authData.user.user_metadata?.full_name as string | undefined)?.trim();
      const { data: supplierProfile } = await supabase
        .from('supplier_company_profiles')
        .select('company_name')
        .eq('user_id', authData.user.id)
        .maybeSingle();
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('company_name')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (!active) return;

      const supplierProfileCompany = typeof supplierProfile?.company_name === 'string' ? supplierProfile.company_name.trim() : '';
      const userProfileCompany = typeof userProfile?.company_name === 'string' ? userProfile.company_name.trim() : '';
      const fallbackName = supplierProfileCompany || metadataCompany || userProfileCompany || metadataFullName || 'Supplier Account';

      setCompanyName(fallbackName);
    };

    loadProfile();

    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      setPageLoading(true);
      setMetricsError('');
      setRfqError('');
      setActiveOrdersError('');
      setAvailabilityError('');
      setProgressError('');

      const { data: dashboardAuthData } = await supabase.auth.getUser();
      const authUserId = dashboardAuthData.user?.id;

      const [openRfqsResult, quotesSentResult, activeOrdersCountResult, paymentsPendingResult, activeOrdersResult] = await Promise.all([
        supabase.from('rfq_orders0').select('rfq_id', { count: 'exact', head: true }).eq('rfq_status', 'open'),
        supabase
          .from('supplier_quotes0')
          .select('quote_id', { count: 'exact', head: true })
          .in('quote_status', ['sent', 'viewed', 'approved', 'rejected']),
        supabase.from('active_orders').select('active_order_id', { count: 'exact', head: true }).eq('order_status', 'active'),
        supabase
          .from('active_orders')
          .select('active_order_id', { count: 'exact', head: true })
          .eq('payment_status', 'buyer_paid')
          .in('payout_status', ['not_ready', 'pending_release']),
        supabase
          .from('active_orders')
          .select('active_order_id, order_number, customer_company_name, order_total, currency, current_stage, expected_delivery_at, order_status, payment_status, shipping_status, payout_status, created_at')
          .order('created_at', { ascending: false }),
      ]);

      if (!active) return;

      const metricError = openRfqsResult.error || quotesSentResult.error || activeOrdersCountResult.error || paymentsPendingResult.error;
      if (metricError) {
        setMetrics(emptyMetrics);
        setMetricsError(metricError.message);
      } else {
        setMetrics({
          openRfqs: openRfqsResult.count ?? 0,
          quotesSent: quotesSentResult.count ?? 0,
          ordersInProgress: activeOrdersCountResult.count ?? 0,
          paymentsPending: paymentsPendingResult.count ?? 0,
        });
      }

      if (activeOrdersResult.error) {
        setActiveOrderRows([]);
        setActiveOrdersError(activeOrdersResult.error.message);
      } else {
        const rows = (activeOrdersResult.data ?? []).map((order) => ({
          orderId: order.order_number,
          buyer: order.customer_company_name || '—',
          totalValue: formatCurrency(order.order_total, order.currency),
          currentStage: normalizeStage(order.current_stage),
          expectedDelivery: formatDate(order.expected_delivery_at),
        }));
        setActiveOrderRows(rows);
      }

      if (!authUserId) {
        setIncomingRfqs([]);
        setAvailabilityUploads([]);
        setProgressRows([]);
        setRfqError('You must be signed in to view assigned RFQs.');
        setAvailabilityError('You must be signed in to view product availability uploads.');
        setProgressError('You must be signed in to view progress.');
      } else {
        const progressResponse = await fetch('/api/progress/supplier');
        const progressResult = await progressResponse.json().catch(() => ({}));
        if (!active) return;
        if (progressResponse.ok) {
          setProgressRows((progressResult.progress ?? []) as ProcurementProgressRow[]);
        } else {
          setProgressRows([]);
          setProgressError(progressResult.error || 'Unable to load supplier progress.');
        }

        const assignmentsResult = await supabase
          .from('rfq_supplier_assignments')
          .select('assignment_id, rfq_id, order_number, assignment_status')
          .eq('supplier_id', authUserId)
          .order('assigned_at', { ascending: false });

        if (!active) return;

        if (assignmentsResult.error) {
          setIncomingRfqs([]);
          setRfqError(assignmentsResult.error.message);
        } else {
          const assignments = (assignmentsResult.data ?? []) as RfqAssignmentRow[];
          if (!assignments.length) {
            setIncomingRfqs([]);
          } else {
            const rfqIds = assignments.map((row) => row.rfq_id);
            const rfqOrdersResult = await supabase
              .from('rfq_orders0')
              .select('rfq_id, order_number, delivery_country_name, rfq_status, priority_status, deadline_at, total_items_count, total_requested_quantity, currency, created_at')
              .in('rfq_id', rfqIds)
              .order('created_at', { ascending: false });

            if (!active) return;

            if (rfqOrdersResult.error) {
              setIncomingRfqs([]);
              setRfqError(rfqOrdersResult.error.message);
            } else {
              const rfqOrders = (rfqOrdersResult.data ?? []) as RfqOrderRow[];
              const itemsResult = await supabase
                .from('rfq_order_items0')
                .select('rfq_id, category_name, requested_quantity, line_number')
                .in('rfq_id', rfqIds)
                .order('line_number', { ascending: true });

              if (!active) return;

              if (itemsResult.error) {
                setIncomingRfqs([]);
                setRfqError(itemsResult.error.message);
              } else {
                const items = (itemsResult.data ?? []) as RfqOrderItemRow[];
                const itemsByRfqId = new Map<string, RfqOrderItemRow[]>();
                items.forEach((item) => {
                  const existing = itemsByRfqId.get(item.rfq_id) ?? [];
                  existing.push(item);
                  itemsByRfqId.set(item.rfq_id, existing);
                });

                const assignmentsByRfqId = new Map(assignments.map((assignment) => [assignment.rfq_id, assignment]));
                const rows = rfqOrders.map((order) => {
                  const assignment = assignmentsByRfqId.get(order.rfq_id);
                  const relatedItems = itemsByRfqId.get(order.rfq_id) ?? [];
                  const categoryNames = Array.from(
                    new Set(
                      relatedItems
                        .map((item) => item.category_name?.trim())
                        .filter((name): name is string => Boolean(name))
                    )
                  );
                  const firstCategory = relatedItems.find((item) => item.category_name?.trim())?.category_name?.trim();
                  const category =
                    categoryNames.length > 1
                      ? 'Multiple categories'
                      : firstCategory || order.order_number || 'Uncategorized';
                  const partsCount = order.total_items_count ?? relatedItems.length;
                  const requestedQuantity = order.total_requested_quantity ?? relatedItems.reduce((sum, item) => sum + Number(item.requested_quantity ?? 0), 0);
                  const priority = (order.priority_status ?? '').trim().toLowerCase();
                  const rfqStatus = (order.rfq_status ?? 'open').trim().toLowerCase();
                  const actionLabel = assignment?.assignment_status === 'assigned' ? 'View RFQ' : rfqStatus === 'open' || priority === 'urgent' ? 'Submit Quote' : 'View RFQ';
                  const statusLabel = priority === 'urgent' ? 'Urgent' : humanizeKey(assignment?.assignment_status ?? order.rfq_status ?? 'open');

                  return {
                    assignmentId: assignment?.assignment_id ?? '',
                    rfqId: order.rfq_id,
                    procurementNumber: order.order_number,
                    category,
                    parts: `${partsCount} line item${partsCount === 1 ? '' : 's'}`,
                    quantity: `${requestedQuantity.toLocaleString('en-US')} pcs`,
                    buyerCountry: order.delivery_country_name || '—',
                    deadline: formatDeadline(order.deadline_at),
                    statusLabel,
                    actionLabel,
                  };
                });

                setIncomingRfqs(rows);
              }
            }
          }
        }

        const { data: supplierProfile } = await supabase
          .from('supplier_company_profiles')
          .select('company_name, company_email')
          .eq('user_id', authUserId)
          .maybeSingle();

        if (!active) return;

        const canonical = dashboardAuthData.user ? await getCanonicalSupplierForAuthenticatedUser(supabase, dashboardAuthData.user).catch(() => null) : null;
        const productSupplierId = canonical?.canonicalSupplierId || '';

        if (!productSupplierId) {
          setAvailabilityUploads([]);
          setAvailabilityError('Your Supplier Company Profile is not linked to a canonical supplier. Complete the profile or contact support.');
        } else {
          const uploadsResult = await supabase
            .from('supplier_stock_uploads')
            .select('id, upload_number, document_name, original_file_name, created_at, total_rows, valid_rows, error_rows, status, ai_processing_status')
            .eq('supplier_id', productSupplierId)
            .order('created_at', { ascending: false });

          if (!active) return;

          if (uploadsResult.error) {
            setAvailabilityUploads([]);
            setAvailabilityError(uploadsResult.error.message);
          } else {
            setAvailabilityUploads((uploadsResult.data ?? []) as SupplierStockUploadRow[]);
          }
        }
      }

      setPageLoading(false);
    };

    loadDashboard();

    return () => {
      active = false;
    };
  }, [supabase]);

  const markAssignedRfqViewed = async (assignmentId: string) => {
    if (!assignmentId) return;
    const { error } = await supabase
      .from('rfq_supplier_assignments')
      .update({ assignment_status: 'viewed', supplier_viewed_at: new Date().toISOString() })
      .eq('assignment_id', assignmentId)
      .eq('assignment_status', 'assigned');

    if (error) {
      setRfqError(error.message);
      return;
    }

    setIncomingRfqs((current) =>
      current.map((row) => (row.assignmentId === assignmentId ? { ...row, statusLabel: 'Viewed', actionLabel: 'Submit Quote' } : row))
    );
  };

  const advanceSupplierProgress = async (progressId: string) => {
    const response = await fetch(`/api/progress/${progressId}/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ next_stage: 'quote_received', note: 'Supplier quote received' }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setProgressError(result.error || 'Unable to update supplier progress.');
      return;
    }
    setProgressRows((current) => current.map((row) => (row.id === progressId ? result.progress : row)));
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-800 bg-[#071632] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-cyan-300">Electron Market</p>
            <h1 className="text-2xl font-semibold tracking-tight">Supply Hub</h1>
          </div>

          <div className="flex items-center gap-3">
            {userEmail && (
              <p className="max-w-[220px] truncate text-sm font-medium text-white" title={userEmail}>
                {userEmail}
              </p>
            )}
            <div className="text-right">
              <button
                type="button"
                onClick={() => setProfileModalOpen(true)}
                className="text-sm font-semibold text-white underline-offset-4 hover:text-cyan-200 hover:underline"
              >
                {companyName}
              </button>
              <p className="text-xs text-slate-300">Supplier account</p>
            </div>
            <span className="inline-flex items-center rounded-full border border-amber-300/40 bg-amber-400/15 px-3 py-1 text-xs font-semibold text-amber-200">
              Pending Verification
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">Supplier dashboard</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Welcome to your Supply Hub</h2>
              <p className="mt-3 max-w-2xl text-lg leading-8 text-slate-600">
                Manage your RFQs, send quotes, track order execution,
                and grow your business with Electron Market.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {kpiCards.map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-500">{item.label}</p>
              <div className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">{pageLoading ? '—' : item.value}</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.caption}</p>
            </div>
          ))}
        </section>

        {metricsError && <AlertBox tone="warning">Metrics warning: {metricsError}</AlertBox>}

        <SectionCard title="Progress" centeredTitle>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-blue-600 text-white">
                <tr>
                  <th className={tableHeaderCellClass}>Progress No</th>
                  <th className={tableHeaderCellClass}>Customer</th>
                  <th className={tableHeaderCellClass}>Document / RFQ</th>
                  <th className={tableHeaderCellClass}>Current Stage</th>
                  <th className={tableHeaderCellClass}>Progress</th>
                  <th className={tableHeaderCellClass}>Updated</th>
                  <th className={tableHeaderCellClass}>Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {progressError ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-4"><AlertBox tone="warning">Progress warning: {progressError}</AlertBox></td>
                  </tr>
                ) : pageLoading && !progressRows.length ? (
                  <tr><td colSpan={7} className={emptyTableCellClass}>Loading progress...</td></tr>
                ) : progressRows.length === 0 ? (
                  <tr><td colSpan={7} className={emptyTableCellClass}>No assigned progress yet.</td></tr>
                ) : (
                  progressRows.map((row) => {
                    const stage = normalizeStage(row.current_stage);
                    return (
                      <tr key={row.id}>
                        <td className="px-4 py-3 font-semibold text-slate-900">#{row.progress_number ?? '—'}</td>
                        <td className="px-4 py-3">{row.customer_company_name || '—'}</td>
                        <td className="px-4 py-3">{row.document_name || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${stageMeta[stage].bgClass} ${stageMeta[stage].textClass}`}>
                            {stageMeta[stage].label}
                          </span>
                        </td>
                        <td className="px-4 py-3"><StageProgress currentStage={stage} /></td>
                        <td className="px-4 py-3">{formatDate(row.updated_at || row.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {row.current_stage === 'rfq' && (
                              <button type="button" onClick={() => advanceSupplierProgress(row.id)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 hover:text-white">
                                Send Quote
                              </button>
                            )}
                            <button type="button" className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 hover:text-white">
                              View Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          id="incoming-buyer-rfqs"
          title="Incoming Buyer RFQs"
          centeredTitle
          link={
            <Link href="#incoming-buyer-rfqs" className="text-sm font-semibold text-blue-700 hover:text-blue-800">
              View All RFQs
            </Link>
          }
        >
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-blue-600 text-white">
                <tr>
                  <th className={tableHeaderCellClass}>RFQ ID</th>
                  <th className={tableHeaderCellClass}>Category</th>
                  <th className={tableHeaderCellClass}>Parts</th>
                  <th className={tableHeaderCellClass}>Quantity</th>
                  <th className={tableHeaderCellClass}>Buyer Country</th>
                  <th className={tableHeaderCellClass}>Deadline</th>
                  <th className={tableHeaderCellClass}>Status</th>
                  <th className={tableHeaderCellClass}>Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {rfqError ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-4">
                      <AlertBox tone="error">{rfqError}</AlertBox>
                    </td>
                  </tr>
                ) : pageLoading && !incomingRfqs.length ? (
                  <tr>
                    <td colSpan={8} className={emptyTableCellClass}>Loading incoming RFQs...</td>
                  </tr>
                ) : incomingRfqs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className={emptyTableCellClass}>No incoming RFQs yet.</td>
                  </tr>
                ) : (
                  incomingRfqs.map((row) => (
                    <tr key={row.rfqId}>
                      <td className="px-4 py-3 font-semibold text-slate-900">{row.procurementNumber}</td>
                      <td className="px-4 py-3">{row.category}</td>
                      <td className="px-4 py-3">{row.parts}</td>
                      <td className="px-4 py-3">{row.quantity}</td>
                      <td className="px-4 py-3">{row.buyerCountry}</td>
                      <td className="px-4 py-3">{row.deadline}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${row.statusLabel === 'Urgent' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}
                        >
                          {row.statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/supplier/rfqs/${row.rfqId}`} onClick={() => markAssignedRfqViewed(row.assignmentId)} className="font-semibold text-blue-700 hover:text-blue-800">
                          {row.actionLabel}
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Active Orders" centeredTitle>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-blue-600 text-white">
                <tr>
                  <th className={tableHeaderCellClass}>Order ID</th>
                  <th className={tableHeaderCellClass}>Buyer</th>
                  <th className={tableHeaderCellClass}>Total Value</th>
                  <th className={tableHeaderCellClass}>Current Stage</th>
                  <th className={tableHeaderCellClass}>Progress</th>
                  <th className={tableHeaderCellClass}>Expected Delivery</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {activeOrdersError ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-4">
                      <AlertBox tone="error">{activeOrdersError}</AlertBox>
                    </td>
                  </tr>
                ) : pageLoading && !activeOrderRows.length ? (
                  <tr>
                    <td colSpan={6} className={emptyTableCellClass}>Loading active orders...</td>
                  </tr>
                ) : activeOrderRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={emptyTableCellClass}>No active orders yet.</td>
                  </tr>
                ) : (
                  activeOrderRows.map((row) => (
                    <tr key={row.orderId}>
                      <td className="px-4 py-3 font-semibold text-slate-900">{row.orderId}</td>
                      <td className="px-4 py-3">{row.buyer}</td>
                      <td className="px-4 py-3">{row.totalValue}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${stageMeta[row.currentStage].bgClass} ${stageMeta[row.currentStage].textClass}`}>
                          {stageMeta[row.currentStage].label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StageProgress currentStage={row.currentStage} />
                      </td>
                      <td className="px-4 py-3">{row.expectedDelivery}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {stageOrder.map((stage) => (
              <div key={stage} className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                <span className={`h-3 w-3 rounded-full ${stageMeta[stage].bgClass}`} />
                {stageMeta[stage].label}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Product Availability" centeredTitle>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-blue-600 text-white">
                <tr>
                  <th className={tableHeaderCellClass}>Upload No</th>
                  <th className={tableHeaderCellClass}>Document Name</th>
                  <th className={tableHeaderCellClass}>File Name</th>
                  <th className={tableHeaderCellClass}>Uploaded</th>
                  <th className={tableHeaderCellClass}>Total</th>
                  <th className={tableHeaderCellClass}>Valid</th>
                  <th className={tableHeaderCellClass}>Errors</th>
                  <th className={tableHeaderCellClass}>Status</th>
                  <th className={tableHeaderCellClass}>AI Status</th>
                  <th className={tableHeaderCellClass}>Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {availabilityError ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-4">
                      <AlertBox tone="error">{availabilityError}</AlertBox>
                    </td>
                  </tr>
                ) : pageLoading && !availabilityUploads.length ? (
                  <tr>
                    <td colSpan={10} className={emptyTableCellClass}>Loading product availability uploads...</td>
                  </tr>
                ) : availabilityUploads.length === 0 ? (
                  <tr>
                    <td colSpan={10} className={emptyTableCellClass}>
                      <div className="flex flex-col items-center gap-3">
                        <span>No product availability uploads yet.</span>
                        <Link href="/supplier/products/upload" className="site-button rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                          Upload Product List
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  availabilityUploads.map((upload) => (
                    <tr
                      key={upload.id}
                      className="cursor-pointer hover:bg-blue-50"
                      onClick={() => { window.location.href = `/supplier/product-availability/${upload.id}`; }}
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900">#{upload.upload_number ?? '—'}</td>
                      <td className="px-4 py-3">{upload.document_name || '—'}</td>
                      <td className="px-4 py-3">{upload.original_file_name || '—'}</td>
                      <td className="px-4 py-3">{formatDate(upload.created_at)}</td>
                      <td className="px-4 py-3">{upload.total_rows ?? 0}</td>
                      <td className="px-4 py-3">{upload.valid_rows ?? 0}</td>
                      <td className="px-4 py-3">{upload.error_rows ?? 0}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(upload.status)}`}>
                          {humanizeKey(upload.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(upload.ai_processing_status)}`}>
                          {humanizeKey(upload.ai_processing_status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/supplier/product-availability/${upload.id}`} className="font-semibold text-blue-700 hover:text-blue-800">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/supplier/products/new" className="site-button rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
              Add product
            </Link>
            <Link href="/supplier/products/upload" className="site-button rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Upload Product List
            </Link>
            <Link href="/supplier/products" className="site-button rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Manage Products
            </Link>
          </div>
        </SectionCard>

        <section className="w-full lg:max-w-[620px]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">Supplier Verification</h2>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Pending review</span>
            </div>

            <ul className="space-y-3">
              {verificationChecklist.map((item) => (
                <li key={item.label} className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                    <p className="mt-1 text-xs text-slate-500">Required for supplier activation.</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : item.status === 'Pending review' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>
                    {item.status}
                  </span>
                </li>
              ))}
            </ul>

            <button type="button" className="mt-5 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
              Complete Verification
            </button>
          </div>
        </section>
      </div>
      <SupplierCompanyProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        onSaved={(savedCompanyName) => setCompanyName(savedCompanyName || 'Supplier Account')}
      />
    </main>
  );
}



