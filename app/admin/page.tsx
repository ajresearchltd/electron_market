'use client';

import Link from 'next/link';
import { MouseEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { createProcurementCaseFromRfq } from '../../lib/procurement-documents/document-chain';
import { createClient } from '../../lib/supabase/client';
import HubButton from '../components/ui/HubButton';
import DeleteRfqButton from './rfqs/DeleteRfqButton';
import InvoiceHubTable from '../components/invoices/InvoiceHubTable';

type StageKey =
  | 'bom_received'
  | 'rfq'
  | 'quote_received'
  | 'approved'
  | 'payment'
  | 'goods_shipped'
  | 'goods_received'
  | 'order_completed';

type RfqRow = {
  rfq_id: string;
  order_number: string;
  customer_id: string | null;
  customer_company_name: string | null;
  customer_email: string | null;
  delivery_country_name: string | null;
  rfq_status: string | null;
  priority_status: string | null;
  deadline_at: string | null;
  total_items_count: number | null;
  total_requested_quantity: number | null;
  buyer_notes: string | null;
  created_at: string | null;
  procurement_chain_id?: string | null;
  procurement_number?: string | null;
  source_bom_upload_id?: string | null;
  source_bom_file?: string | null;
  allow_all_suppliers?: boolean | null;
};

type RfqItemRow = {
  rfq_id: string;
  order_number: string;
  line_number: number | null;
  category_name: string | null;
  part_number: string | null;
  manufacturer: string | null;
  description: string | null;
  requested_quantity: number | null;
  target_total_price: number | null;
  currency: string | null;
};

type AssignmentRow = {
  assignment_id: string;
  rfq_id: string;
  order_number: string;
  supplier_id: string;
  supplier_company_name: string | null;
  assignment_status: string | null;
  admin_notes: string | null;
  assigned_at: string | null;
};

type SupplierProfileRow = {
  canonical_supplier_id?: string | null;
  profile_id: string;
  user_id: string;
  company_name: string | null;
  country_name: string | null;
  business_registration_number: string | null;
  tax_vat_number: string | null;
  company_email: string | null;
  company_phone: string | null;
  main_contact_name: string | null;
  main_contact_email: string | null;
  product_categories_text: string | null;
  bank_name: string | null;
  iban: string | null;
  verification_status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type UserProfileRow = {
  id: string;
  email: string | null;
  role: string | null;
  full_name: string | null;
  company_name: string | null;
  created_at: string | null;
};

type ActiveOrderRow = {
  order_number: string;
  customer_id: string | null;
  customer_company_name: string | null;
  supplier_id?: string | null;
  supplier_company_name?: string | null;
  current_stage: string | null;
  order_status: string | null;
  payment_status?: string | null;
  expected_delivery_at?: string | null;
  order_total?: number | null;
  currency?: string | null;
};

type QuoteRow = {
  quote_id: string;
  order_number: string;
  supplier_company_name: string | null;
  quote_status: string | null;
  quote_total: number | null;
  currency: string | null;
};

type ContactRow = {
  profile_id: string;
  contact_index: number;
  contact_name: string | null;
  contact_position: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

type DocumentRow = {
  profile_id: string;
  document_title: string | null;
  file_name: string | null;
  document_status: string | null;
};

type CountryRow = {
  country_id: number;
  iso2: string;
  iso3: string | null;
  name: string;
};

type CustomerCompanyProfileRow = {
  customer_profile_id: string;
  user_id: string;
  company_name: string | null;
  business_registration_number: string | null;
  country_iso2: string | null;
  country_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  company_address: string | null;
  customer_notes: string | null;
  customer_status: string | null;
  created_at: string | null;
  updated_at?: string | null;
};

type ProcurementProgressRow = {
  id: string;
  progress_number: number | null;
  procurement_chain_id?: string | null;
  procurement_case_id?: string | null;
  procurement_number?: string | null;
  customer_reference?: string | null;
  customer_company_name: string | null;
  supplier_company_name: string | null;
  document_name: string | null;
  current_stage: string | null;
  current_stage_label: string | null;
  status_note?: string | null;
  payment_amount: number | null;
  payment_currency: string | null;
  payment_reference: string | null;
  shipment_carrier: string | null;
  shipment_tracking_number: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type RfqItemFormRow = {
  categoryName: string;
  partNumber: string;
  manufacturer: string;
  description: string;
  requestedQuantity: string;
  quantityUnit: string;
  targetUnitPrice: string;
  requiredDate: string;
  customerLineNotes: string;
};

type RfqFormData = {
  selectedCustomerId: string;
  selectedCustomerUserId: string;
  selectedCustomerCompanyName: string;
  buyerCompanyName: string;
  buyerContactName: string;
  buyerEmail: string;
  buyerCountryIso2: string;
  buyerCountryName: string;
  deliveryCountryIso2: string;
  deliveryCountryName: string;
  deadline: string;
  currency: string;
  priorityStatus: string;
  buyerNotes: string;
};

type SupplierFormData = {
  userId: string;
  companyName: string;
  businessRegistrationNumber: string;
  taxVatNumber: string;
  countryIso2: string;
  countryName: string;
  legalAddress: string;
  officeAddress: string;
  website: string;
  companyPhone: string;
  companyEmail: string;
  mainContactName: string;
  mainContactPosition: string;
  mainContactEmail: string;
  mainContactPhone: string;
  companyDescription: string;
  productCategoriesText: string;
  yearsInBusiness: string;
  bankAccountHolderName: string;
  bankName: string;
  bankCountryIso2: string;
  bankCountryName: string;
  bankAddress: string;
  accountNumber: string;
  iban: string;
  swiftBic: string;
  paymentCurrency: string;
  paymentNotes: string;
};

type CustomerFormData = {
  userId: string;
  selectedUserEmail: string;
  selectedUserCurrentRole: string;
  companyName: string;
  businessRegistrationNumber: string;
  countryIso2: string;
  countryName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  website: string;
  companyAddress: string;
  customerNotes: string;
  customerStatus: string;
};

type AdminHeaderProfile = {
  email: string;
  name: string;
  companyName: string;
  avatarUrl: string;
};

type AiChatSessionRow = {
  id: string;
  chat_number: number | null;
  user_id: string | null;
  guest_session_id: string | null;
  title: string | null;
  chat_type: string | null;
  status: string | null;
  first_response_id: string | null;
  latest_response_id: string | null;
  message_count: number | null;
  last_message_at: string | null;
  created_at: string | null;
};

type AiChatMessageRow = {
  id: string;
  chat_session_id: string;
  message_order: number | null;
  role: string | null;
  content: string | null;
  openai_response_id: string | null;
  created_at: string | null;
  status: string | null;
  error_message: string | null;
};

const ASSIGNMENTS_TABLE = 'rfq_supplier_assignments';

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

const stageMeta: Record<StageKey, { label: string; bgClass: string; textClass: string }> = {
  bom_received: { label: 'BOM received', bgClass: 'bg-blue-500', textClass: 'text-white' },
  rfq: { label: 'RFQ', bgClass: 'bg-cyan-500', textClass: 'text-white' },
  quote_received: { label: 'Quote received', bgClass: 'bg-emerald-500', textClass: 'text-white' },
  approved: { label: 'Approved', bgClass: 'bg-orange-500', textClass: 'text-white' },
  payment: { label: 'Payment', bgClass: 'bg-violet-500', textClass: 'text-white' },
  goods_shipped: { label: 'Goods Shipped', bgClass: 'bg-teal-500', textClass: 'text-white' },
  goods_received: { label: 'Goods received', bgClass: 'bg-amber-400', textClass: 'text-slate-900' },
  order_completed: { label: 'Order completed', bgClass: 'bg-emerald-700', textClass: 'text-white' },
};

const tableHeaderCellClass = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white';
const emptyCellClass = 'px-4 py-8 text-center text-sm text-slate-600';

const formatDate = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(date);
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

const formatMoney = (amount: number | null | undefined, currency: string | null | undefined) => {
  if (!amount) return '-';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency || 'USD'} ${amount.toLocaleString('en-US')}`;
  }
};

const humanize = (value: string | null | undefined) =>
  value ? value.split('_').filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ') : '-';

const getInitials = (nameOrEmail: string) => {
  const source = nameOrEmail.trim() || 'Admin User';
  const parts = source.includes('@') ? source.split('@')[0].split(/[._-]+/) : source.split(/\s+/);
  return parts.filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || 'AU';
};

const getCategoryFromItems = (rfqId: string, itemRows: RfqItemRow[]) => {
  const categories = Array.from(new Set(itemRows.filter((item) => item.rfq_id === rfqId).map((item) => item.category_name).filter(Boolean)));
  if (categories.length > 1) return 'Multiple categories';
  return categories[0] || '-';
};

const normalizeStage = (value: string | null | undefined): StageKey => {
  if (value && stageOrder.includes(value as StageKey)) return value as StageKey;
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

const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const createEmptyRfqItem = (): RfqItemFormRow => ({
  categoryName: '',
  partNumber: '',
  manufacturer: '',
  description: '',
  requestedQuantity: '',
  quantityUnit: 'pcs',
  targetUnitPrice: '',
  requiredDate: '',
  customerLineNotes: '',
});

const generateOrderNumber = () => {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const timePart = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RFQ-${datePart}-${timePart}-${suffix}`;
};

const nullableText = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

function RequiredMark() {
  return <span className="text-red-500">*</span>;
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <span className="text-sm font-semibold text-slate-700">
      {label} {required && <RequiredMark />}
    </span>
  );
}

function TextInput({
  label,
  value,
  onChange,
  required,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <FieldLabel label={label} required={required} />
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className={inputClass} />
    </label>
  );
}

function TextAreaInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <FieldLabel label={label} />
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} className={inputClass} />
    </label>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  required,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <FieldLabel label={label} required={required} />
      <select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>
        {children}
      </select>
    </label>
  );
}

function StageProgress({ currentStage }: { currentStage: StageKey }) {
  const currentIndex = stageOrder.indexOf(currentStage);
  return (
    <div className="flex flex-wrap gap-2">
      {stageOrder.map((stage, index) => {
        const meta = stageMeta[stage];
        const filled = index <= currentIndex;
        return (
          <span
            key={stage}
            title={meta.label}
            className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold ${filled ? `${meta.bgClass} ${meta.textClass}` : 'border-slate-300 bg-slate-200 text-slate-500'}`}
          >
            {index + 1}
          </span>
        );
      })}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-blue-100 bg-white text-slate-900 shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <h2 className="text-2xl font-bold text-slate-950">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Close
          </button>
        </div>
        <div className="max-h-[calc(90vh-74px)] overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function AiConversationsModal({ supabase, onClose }: { supabase: ReturnType<typeof createClient>; onClose: () => void }) {
  const [sessions, setSessions] = useState<AiChatSessionRow[]>([]);
  const [selectedSession, setSelectedSession] = useState<AiChatSessionRow | null>(null);
  const [messages, setMessages] = useState<AiChatMessageRow[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [messageError, setMessageError] = useState('');

  useEffect(() => {
    let active = true;

    const loadSessions = async () => {
      setLoadingSessions(true);
      setSessionError('');

      const { data, error } = await supabase
        .from('ai_chat_sessions')
        .select('id, chat_number, user_id, guest_session_id, title, chat_type, status, first_response_id, latest_response_id, message_count, last_message_at, created_at')
        .order('chat_number', { ascending: false });

      if (!active) return;

      if (error) {
        setSessions([]);
        setSessionError(error.message);
      } else {
        setSessions((data ?? []) as AiChatSessionRow[]);
      }

      setLoadingSessions(false);
    };

    loadSessions();

    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    let active = true;

    const loadMessages = async () => {
      if (!selectedSession) {
        setMessages([]);
        setMessageError('');
        setLoadingMessages(false);
        return;
      }

      setLoadingMessages(true);
      setMessageError('');

      const { data, error } = await supabase
        .from('ai_chat_messages')
        .select('id, chat_session_id, message_order, role, content, openai_response_id, created_at, status, error_message')
        .eq('chat_session_id', selectedSession.id)
        .order('message_order', { ascending: false });

      if (!active) return;

      if (error) {
        setMessages([]);
        setMessageError(error.message);
      } else {
        setMessages((data ?? []) as AiChatMessageRow[]);
      }

      setLoadingMessages(false);
    };

    loadMessages();

    return () => {
      active = false;
    };
  }, [selectedSession, supabase]);

  if (selectedSession) {
    return (
      <Modal title={`AI Conversation #${selectedSession.chat_number ?? '-'}`} onClose={onClose}>
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={() => setSelectedSession(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Back to conversations
            </button>
          </div>

          <SectionCard title="Conversation Detail" tone="blue">
            <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
              <p><span className="font-semibold text-slate-950">Chat number:</span> {selectedSession.chat_number ?? '-'}</p>
              <p><span className="font-semibold text-slate-950">Conversation id:</span> {selectedSession.id}</p>
              <p><span className="font-semibold text-slate-950">Type:</span> {selectedSession.chat_type || '-'}</p>
              <p><span className="font-semibold text-slate-950">Status:</span> {humanize(selectedSession.status)}</p>
              <p><span className="font-semibold text-slate-950">Latest response id:</span> {selectedSession.latest_response_id || '-'}</p>
              <p><span className="font-semibold text-slate-950">Messages:</span> {selectedSession.message_count ?? 0}</p>
            </div>
          </SectionCard>

          {messageError && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">AI messages: {messageError}</div>}
          {loadingMessages && <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">Loading conversation messages...</div>}
          {!loadingMessages && !messageError && messages.length === 0 && <div className="rounded-xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-600">No messages found for this conversation.</div>}

          <div className="space-y-3">
            {messages.map((item) => {
              const isUser = item.role === 'user';
              const isError = item.status === 'error';
              return (
                <div key={item.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <article
                    className={`w-fit max-w-[85%] rounded-2xl p-4 text-sm leading-6 sm:max-w-[60%] ${isError ? 'border border-red-200 bg-red-50 text-red-700' : isUser ? 'border border-blue-100 bg-blue-50 text-slate-900' : 'border border-purple-700 bg-purple-800 text-white'}`}
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
                      <span className={isError ? 'text-red-700' : isUser ? 'text-blue-700' : 'text-purple-100'}>{isUser ? 'Client / User' : 'AI Assistant'}</span>
                      <span className={isError ? 'text-red-600' : isUser ? 'text-slate-500' : 'text-purple-100'}>order {item.message_order ?? '-'}</span>
                    </div>
                    <div className="whitespace-pre-wrap">{isError ? item.error_message || item.content : item.content}</div>
                    <p className={`mt-2 text-xs ${isError ? 'text-red-600' : isUser ? 'text-slate-500' : 'text-purple-100'}`}>{formatDateTime(item.created_at)}</p>
                    {item.openai_response_id && <p className={`mt-2 break-all text-xs ${isUser ? 'text-slate-500' : 'text-purple-100'}`}>openai_response_id: {item.openai_response_id}</p>}
                  </article>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="AI Conversations List" onClose={onClose}>
      <div className="space-y-4">
        {sessionError && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">AI conversations: {sessionError}</div>}
        {loadingSessions && <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">Loading AI conversations...</div>}
        {!loadingSessions && !sessionError && sessions.length === 0 && <div className="rounded-xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-600">No AI conversations found.</div>}

        {sessions.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-[1360px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-20" />
                <col className="w-52" />
                <col className="w-36" />
                <col className="w-36" />
                <col className="w-64" />
                <col className="w-72" />
                <col className="w-24" />
                <col className="w-36" />
                <col className="w-36" />
                <col className="w-44" />
              </colgroup>
              <thead className="bg-blue-600 text-white">
                <tr>
                  {['Chat', 'Title', 'Type', 'Status', 'User / Customer', 'Response ID', 'Messages', 'Last Message', 'Created', 'Action'].map((heading) => (
                    <th key={heading} className={`${tableHeaderCellClass} overflow-hidden text-ellipsis whitespace-nowrap`}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {sessions.map((session) => (
                  <tr key={session.id} onClick={() => setSelectedSession(session)} className="h-12 cursor-pointer hover:bg-blue-50">
                    <td className="overflow-hidden text-ellipsis whitespace-nowrap px-4 py-3 font-semibold text-slate-950" title={`#${session.chat_number ?? '-'}`}>#{session.chat_number ?? '-'}</td>
                    <td className="overflow-hidden text-ellipsis whitespace-nowrap px-4 py-3" title={session.title || ''}>{session.title || '-'}</td>
                    <td className="overflow-hidden text-ellipsis whitespace-nowrap px-4 py-3" title={session.chat_type || ''}>{session.chat_type || '-'}</td>
                    <td className="overflow-hidden text-ellipsis whitespace-nowrap px-4 py-3" title={humanize(session.status)}>{humanize(session.status)}</td>
                    <td className="overflow-hidden text-ellipsis whitespace-nowrap px-4 py-3" title={session.user_id || session.guest_session_id || ''}>{session.user_id || session.guest_session_id || '-'}</td>
                    <td className="overflow-hidden text-ellipsis whitespace-nowrap px-4 py-3" title={session.latest_response_id || session.first_response_id || ''}>{session.latest_response_id || session.first_response_id || '-'}</td>
                    <td className="overflow-hidden text-ellipsis whitespace-nowrap px-4 py-3" title={`${session.message_count ?? 0}`}>{session.message_count ?? 0}</td>
                    <td className="overflow-hidden text-ellipsis whitespace-nowrap px-4 py-3" title={session.last_message_at || ''}>{formatDate(session.last_message_at)}</td>
                    <td className="overflow-hidden text-ellipsis whitespace-nowrap px-4 py-3" title={session.created_at || ''}>{formatDate(session.created_at)}</td>
                    <td className="overflow-hidden text-ellipsis whitespace-nowrap px-4 py-3">
                      <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedSession(session); }} className="font-semibold text-blue-700 hover:text-blue-800">
                        View conversation
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

function SectionCard({ title, children, action, tone = 'default' }: { title: string; children: ReactNode; action?: ReactNode; tone?: 'default' | 'blue' }) {
  return (
    <section className={`rounded-2xl border p-5 shadow-sm ${tone === 'blue' ? 'border-blue-100 bg-blue-50' : 'border-slate-200 bg-white'}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-blue-700">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function DetailErrorList({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      {errors.map((error) => <p key={error}>{error}</p>)}
      {errors.some((error) => error.toLowerCase().includes('relation') || error.toLowerCase().includes('could not find')) && (
        <p>Required table is not available yet. Please run the Supabase SQL setup file.</p>
      )}
    </div>
  );
}

function StageLegend() {
  return (
    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
      {stageOrder.map((stage, index) => {
        const meta = stageMeta[stage];
        return (
          <span key={stage} className="inline-flex items-center gap-1">
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${meta.bgClass} ${meta.textClass}`}>{index + 1}</span>
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}

function CreateRfqModal({
  countries,
  customerProfiles,
  customerAccounts,
  customerProfileLoadError,
  supabase,
  onClose,
  onSaved,
}: {
  countries: CountryRow[];
  customerProfiles: CustomerCompanyProfileRow[];
  customerAccounts: UserProfileRow[];
  customerProfileLoadError: string;
  supabase: ReturnType<typeof createClient>;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [formData, setFormData] = useState<RfqFormData>({
    selectedCustomerId: '',
    selectedCustomerUserId: '',
    selectedCustomerCompanyName: '',
    buyerCompanyName: '',
    buyerContactName: '',
    buyerEmail: '',
    buyerCountryIso2: '',
    buyerCountryName: '',
    deliveryCountryIso2: '',
    deliveryCountryName: '',
    deadline: '',
    currency: 'USD',
    priorityStatus: 'open',
    buyerNotes: '',
  });
  const [itemRows, setItemRows] = useState<RfqItemFormRow[]>([createEmptyRfqItem()]);
  const [formMessage, setFormMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const activeCustomerProfiles = customerProfiles.filter((profile) => (profile.customer_status || 'active') === 'active');
  const useCustomerProfileSource = activeCustomerProfiles.length > 0;
  const customerListAvailable = useCustomerProfileSource || customerAccounts.length > 0;
  const customerDropdownSource = useCustomerProfileSource ? 'customer_company_profiles' : 'user_profiles';

  const updateForm = (field: keyof RfqFormData, value: string) => setFormData((current) => ({ ...current, [field]: value }));
  const selectCountry = (iso2: string, field: 'buyer' | 'delivery') => {
    const country = countries.find((row) => row.iso2 === iso2);
    setFormData((current) => ({
      ...current,
      [`${field}CountryIso2`]: country?.iso2 || '',
      [`${field}CountryName`]: country?.name || '',
    }));
  };
  const updateItem = (index: number, field: keyof RfqItemFormRow, value: string) => {
    setItemRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)));
  };
  const selectCustomer = (customerKey: string) => {
    if (!customerKey) {
      setFormData((current) => ({
        ...current,
        selectedCustomerId: '',
        selectedCustomerUserId: '',
        selectedCustomerCompanyName: '',
      }));
      return;
    }

    if (customerKey.startsWith('profile:')) {
      const profileId = customerKey.replace('profile:', '');
      const profile = activeCustomerProfiles.find((row) => row.customer_profile_id === profileId);
      setFormData((current) => ({
        ...current,
        selectedCustomerId: customerKey,
        selectedCustomerUserId: profile?.user_id || '',
        selectedCustomerCompanyName: profile?.company_name || '',
        buyerCompanyName: profile?.company_name || '',
        buyerContactName: profile?.contact_name || '',
        buyerEmail: profile?.contact_email || '',
        buyerCountryIso2: profile?.country_iso2 || '',
        buyerCountryName: profile?.country_name || '',
        deliveryCountryIso2: current.deliveryCountryIso2 || profile?.country_iso2 || '',
        deliveryCountryName: current.deliveryCountryName || profile?.country_name || '',
        buyerNotes: profile?.customer_notes || current.buyerNotes,
      }));
      return;
    }

    const userId = customerKey.replace('user:', '');
    const account = customerAccounts.find((row) => row.id === userId);
    setFormData((current) => ({
      ...current,
      selectedCustomerId: customerKey,
      selectedCustomerUserId: account?.id || '',
      selectedCustomerCompanyName: account?.company_name || '',
      buyerCompanyName: account?.company_name || '',
      buyerContactName: account?.full_name || '',
      buyerEmail: account?.email || '',
    }));
  };

  const saveRfq = async () => {
    setFormMessage('');
    const missing: string[] = [];
    if (!formData.selectedCustomerId) missing.push('Customer company is required.');
    if (!formData.buyerCompanyName.trim()) missing.push('Buyer company name is required.');
    if (!formData.buyerContactName.trim()) missing.push('Buyer contact name is required.');
    if (!formData.buyerEmail.trim()) missing.push('Buyer email is required.');
    if (!formData.deliveryCountryIso2) missing.push('Delivery country is required.');
    if (!formData.deadline) missing.push('Deadline is required.');
    if (!formData.currency.trim()) missing.push('Currency is required.');
    if (itemRows.length === 0) missing.push('At least one item row is required.');
    itemRows.forEach((item, index) => {
      if (!item.partNumber.trim()) missing.push(`Item ${index + 1}: part number is required.`);
      if (Number(item.requestedQuantity) <= 0) missing.push(`Item ${index + 1}: quantity must be greater than 0.`);
    });
    if (missing.length > 0) {
      setFormMessage(missing.join(' '));
      return;
    }

    setSaving(true);
    const orderNumber = generateOrderNumber();
    const totalRequestedQuantity = itemRows.reduce((sum, item) => sum + Number(item.requestedQuantity || 0), 0);
    const { data: rfqData, error: rfqError } = await supabase
      .from('rfq_orders0')
      .insert({
        order_number: orderNumber,
        customer_id: formData.selectedCustomerUserId || null,
        customer_company_name: formData.buyerCompanyName.trim(),
        customer_contact_name: formData.buyerContactName.trim(),
        customer_email: formData.buyerEmail.trim(),
        customer_country_iso2: formData.buyerCountryIso2 || null,
        customer_country_name: formData.buyerCountryName || null,
        delivery_country_iso2: formData.deliveryCountryIso2,
        delivery_country_name: formData.deliveryCountryName,
        rfq_status: 'open',
        priority_status: formData.priorityStatus,
        deadline_at: formData.deadline,
        total_items_count: itemRows.length,
        total_requested_quantity: totalRequestedQuantity,
        currency: formData.currency.trim().toUpperCase(),
        buyer_notes: nullableText(formData.buyerNotes),
      })
      .select('rfq_id')
      .single();

    if (rfqError || !rfqData) {
      setFormMessage(rfqError?.message || 'RFQ insert failed.');
      setSaving(false);
      return;
    }

    const itemPayload = itemRows.map((item, index) => {
      const quantity = Number(item.requestedQuantity);
      const unitPrice = item.targetUnitPrice ? Number(item.targetUnitPrice) : null;
      return {
        rfq_id: rfqData.rfq_id,
        order_number: orderNumber,
        line_number: index + 1,
        category_name: nullableText(item.categoryName),
        part_number: item.partNumber.trim(),
        manufacturer: nullableText(item.manufacturer),
        description: nullableText(item.description),
        requested_quantity: quantity,
        quantity_unit: nullableText(item.quantityUnit),
        target_unit_price: unitPrice,
        target_total_price: unitPrice ? unitPrice * quantity : null,
        currency: formData.currency.trim().toUpperCase(),
        required_date: item.requiredDate || null,
        customer_line_notes: nullableText(item.customerLineNotes),
      };
    });

    const { error: itemError } = await supabase.from('rfq_order_items0').insert(itemPayload);
    if (itemError) {
      setFormMessage(itemError.message);
      setSaving(false);
      return;
    }

    const procurementCase = await createProcurementCaseFromRfq(supabase, {
      rfq_id: rfqData.rfq_id,
      order_number: orderNumber,
      customer_id: formData.selectedCustomerUserId,
      customer_company_name: formData.buyerCompanyName.trim(),
    });

    const now = new Date().toISOString();
    const progressPayload: Record<string, any> = {
      customer_user_id: formData.selectedCustomerUserId,
      admin_user_id: null,
      rfq_id: rfqData.rfq_id,
      procurement_chain_id: procurementCase.data?.procurement_chain_id || procurementCase.data?.id || null,
      procurement_case_id: procurementCase.data?.id || null,
      procurement_number: procurementCase.data?.procurement_number || null,
      customer_reference: orderNumber,
      document_name: orderNumber,
      customer_company_name: formData.buyerCompanyName.trim(),
      current_stage: 'rfq',
      current_stage_label: 'RFQ',
      status_note: 'RFQ created / sent',
      rfq_sent_at: now,
      metadata: { source: 'admin_create_rfq' },
    };
    let progressResult = await supabase
      .from('procurement_progress')
      .insert(progressPayload)
      .select('id')
      .single();
    if (progressResult.error && String(progressResult.error.message || '').toLowerCase().includes('procurement_')) {
      delete progressPayload.procurement_chain_id;
      delete progressPayload.procurement_case_id;
      delete progressPayload.procurement_number;
      delete progressPayload.customer_reference;
      progressResult = await supabase
        .from('procurement_progress')
        .insert(progressPayload)
        .select('id')
        .single();
    }
    if (progressResult.data?.id) {
      await supabase.from('procurement_progress_events').insert({
        progress_id: progressResult.data.id,
        actor_user_id: null,
        actor_role: 'admin',
        stage_code: 'rfq',
        stage_label: 'RFQ',
        event_note: 'RFQ created / sent',
        event_data: { rfq_id: rfqData.rfq_id, order_number: orderNumber },
      });
    }

    await onSaved();
    setSaving(false);
    onClose();
  };

  return (
    <Modal title="Create New RFQ" onClose={onClose}>
      <div className="space-y-5">
        {formMessage && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{formMessage}</div>}
        {!customerListAvailable && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Customer company list is not available yet. Please run the customer profile SQL setup or create customer records first.
            {customerProfileLoadError && <span className="mt-1 block">Supabase error: {customerProfileLoadError}</span>}
          </div>
        )}
        <SectionCard title="Buyer / Customer Information" tone="blue">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <SelectInput label="Customer company" required value={formData.selectedCustomerId} onChange={selectCustomer}>
                <option value="">Select customer company</option>
                {useCustomerProfileSource
                  ? activeCustomerProfiles.map((profile) => (
                      <option key={profile.customer_profile_id} value={`profile:${profile.customer_profile_id}`}>
                        {profile.company_name || 'Unnamed customer'} - {profile.contact_email || 'No email'}
                      </option>
                    ))
                  : customerAccounts.map((account) => (
                      <option key={account.id} value={`user:${account.id}`}>
                        {account.company_name || account.email || account.id} - {account.email || 'No email'}
                      </option>
                    ))}
              </SelectInput>
              <p className="mt-1 text-xs text-slate-600">Select an existing customer company to autofill buyer details. Source: {customerDropdownSource}.</p>
              {customerProfileLoadError && !useCustomerProfileSource && <p className="mt-1 text-xs text-amber-700">Customer profile query error: {customerProfileLoadError}</p>}
            </div>
            <TextInput label="Buyer company name" required value={formData.buyerCompanyName} onChange={(value) => updateForm('buyerCompanyName', value)} />
            <TextInput label="Buyer contact name" required value={formData.buyerContactName} onChange={(value) => updateForm('buyerContactName', value)} />
            <TextInput label="Buyer email" required type="email" value={formData.buyerEmail} onChange={(value) => updateForm('buyerEmail', value)} />
            <SelectInput label="Buyer country" value={formData.buyerCountryIso2} onChange={(value) => selectCountry(value, 'buyer')}>
              <option value="">Select country</option>
              {countries.map((country) => <option key={country.country_id} value={country.iso2}>{country.name}</option>)}
            </SelectInput>
            <SelectInput label="Delivery country" required value={formData.deliveryCountryIso2} onChange={(value) => selectCountry(value, 'delivery')}>
              <option value="">Select country</option>
              {countries.map((country) => <option key={country.country_id} value={country.iso2}>{country.name}</option>)}
            </SelectInput>
            <TextInput label="Deadline" required type="date" value={formData.deadline} onChange={(value) => updateForm('deadline', value)} />
            <TextInput label="Currency" required value={formData.currency} onChange={(value) => updateForm('currency', value)} />
            <SelectInput label="Priority status" value={formData.priorityStatus} onChange={(value) => updateForm('priorityStatus', value)}>
              <option value="open">Open</option>
              <option value="urgent">Urgent</option>
            </SelectInput>
          </div>
          <div className="mt-4">
            <TextAreaInput label="Buyer notes" value={formData.buyerNotes} onChange={(value) => updateForm('buyerNotes', value)} />
          </div>
        </SectionCard>
        <SectionCard
          title="Item Rows"
          tone="blue"
          action={<button type="button" onClick={() => setItemRows((current) => [...current, createEmptyRfqItem()])} className="admin-primary-button admin-primary-button-compact">Add item row</button>}
        >
          <div className="space-y-4">
            {itemRows.map((item, index) => (
              <div key={`rfq-item-${index}`} className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-semibold text-slate-800">Line {index + 1}</p>
                  <button type="button" onClick={() => setItemRows((current) => current.filter((_, rowIndex) => rowIndex !== index))} className="text-sm font-semibold text-red-600 hover:text-red-700">Remove</button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <TextInput label="Category name" value={item.categoryName} onChange={(value) => updateItem(index, 'categoryName', value)} />
                  <TextInput label="Part number" required value={item.partNumber} onChange={(value) => updateItem(index, 'partNumber', value)} />
                  <TextInput label="Manufacturer" value={item.manufacturer} onChange={(value) => updateItem(index, 'manufacturer', value)} />
                  <TextInput label="Description" value={item.description} onChange={(value) => updateItem(index, 'description', value)} />
                  <TextInput label="Requested quantity" required type="number" value={item.requestedQuantity} onChange={(value) => updateItem(index, 'requestedQuantity', value)} />
                  <TextInput label="Quantity unit" value={item.quantityUnit} onChange={(value) => updateItem(index, 'quantityUnit', value)} />
                  <TextInput label="Target unit price" type="number" value={item.targetUnitPrice} onChange={(value) => updateItem(index, 'targetUnitPrice', value)} />
                  <TextInput label="Required date" type="date" value={item.requiredDate} onChange={(value) => updateItem(index, 'requiredDate', value)} />
                </div>
                <div className="mt-4">
                  <TextAreaInput label="Customer line notes" value={item.customerLineNotes} onChange={(value) => updateItem(index, 'customerLineNotes', value)} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          <HubButton onClick={saveRfq} loading={saving} loadingText="Saving...">Save RFQ</HubButton>
        </div>
      </div>
    </Modal>
  );
}

function CreateSupplierModal({
  countries,
  supplierAccounts,
  existingSuppliers,
  supabase,
  onClose,
  onSaved,
}: {
  countries: CountryRow[];
  supplierAccounts: UserProfileRow[];
  existingSuppliers: SupplierProfileRow[];
  supabase: ReturnType<typeof createClient>;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [formData, setFormData] = useState<SupplierFormData>({
    userId: '',
    companyName: '',
    businessRegistrationNumber: '',
    taxVatNumber: '',
    countryIso2: '',
    countryName: '',
    legalAddress: '',
    officeAddress: '',
    website: '',
    companyPhone: '',
    companyEmail: '',
    mainContactName: '',
    mainContactPosition: '',
    mainContactEmail: '',
    mainContactPhone: '',
    companyDescription: '',
    productCategoriesText: '',
    yearsInBusiness: '',
    bankAccountHolderName: '',
    bankName: '',
    bankCountryIso2: '',
    bankCountryName: '',
    bankAddress: '',
    accountNumber: '',
    iban: '',
    swiftBic: '',
    paymentCurrency: 'USD',
    paymentNotes: '',
  });
  const [formMessage, setFormMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const selectedExistingSupplier = existingSuppliers.find((supplier) => supplier.user_id === formData.userId);

  const updateForm = (field: keyof SupplierFormData, value: string) => setFormData((current) => ({ ...current, [field]: value }));
  const selectCountry = (iso2: string, field: 'country' | 'bankCountry') => {
    const country = countries.find((row) => row.iso2 === iso2);
    setFormData((current) => ({
      ...current,
      [`${field}Iso2`]: country?.iso2 || '',
      [`${field}Name`]: country?.name || '',
    }));
  };
  const selectAccount = (userId: string) => {
    const account = supplierAccounts.find((row) => row.id === userId);
    const existing = existingSuppliers.find((row) => row.user_id === userId);
    setFormData((current) => ({
      ...current,
      userId,
      companyName: existing?.company_name || account?.company_name || '',
      businessRegistrationNumber: existing?.business_registration_number || '',
      taxVatNumber: existing?.tax_vat_number || '',
      countryIso2: '',
      countryName: existing?.country_name || '',
      companyEmail: existing?.company_email || account?.email || '',
      mainContactName: existing?.main_contact_name || account?.full_name || '',
      mainContactEmail: existing?.main_contact_email || account?.email || '',
      productCategoriesText: existing?.product_categories_text || '',
      bankName: existing?.bank_name || '',
      iban: existing?.iban || '',
    }));
  };

  const saveSupplier = async () => {
    setFormMessage('');
    const missing: string[] = [];
    if (!formData.userId) missing.push('Existing supplier account is required.');
    if (!formData.companyName.trim()) missing.push('Company name is required.');
    if (!formData.businessRegistrationNumber.trim()) missing.push('Business registration number is required.');
    if (!formData.countryName.trim()) missing.push('Company country is required.');
    if (!formData.mainContactName.trim()) missing.push('Main contact name is required.');
    if (!formData.mainContactEmail.trim()) missing.push('Main contact email is required.');
    if (missing.length > 0) {
      setFormMessage(missing.join(' '));
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('supplier_company_profiles').upsert(
      {
        user_id: formData.userId,
        company_name: formData.companyName.trim(),
        business_registration_number: formData.businessRegistrationNumber.trim(),
        tax_vat_number: nullableText(formData.taxVatNumber),
        country_iso2: formData.countryIso2 || null,
        country_name: formData.countryName.trim(),
        legal_address: nullableText(formData.legalAddress),
        office_address: nullableText(formData.officeAddress),
        website: nullableText(formData.website),
        company_phone: nullableText(formData.companyPhone),
        company_email: nullableText(formData.companyEmail),
        main_contact_name: formData.mainContactName.trim(),
        main_contact_position: nullableText(formData.mainContactPosition),
        main_contact_email: formData.mainContactEmail.trim(),
        main_contact_phone: nullableText(formData.mainContactPhone),
        company_description: nullableText(formData.companyDescription),
        product_categories_text: nullableText(formData.productCategoriesText),
        years_in_business: formData.yearsInBusiness ? Number(formData.yearsInBusiness) : null,
        bank_account_holder_name: nullableText(formData.bankAccountHolderName),
        bank_name: nullableText(formData.bankName),
        bank_country_iso2: formData.bankCountryIso2 || null,
        bank_country_name: formData.bankCountryName || null,
        bank_address: nullableText(formData.bankAddress),
        account_number: nullableText(formData.accountNumber),
        iban: nullableText(formData.iban),
        swift_bic: nullableText(formData.swiftBic),
        payment_currency: formData.paymentCurrency.trim() || 'USD',
        payment_notes: nullableText(formData.paymentNotes),
        verification_status: selectedExistingSupplier?.verification_status || 'pending',
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      setFormMessage(error.message);
      setSaving(false);
      return;
    }

    await onSaved();
    setSaving(false);
    onClose();
  };

  return (
    <Modal title="Create / Update Supplier Profile" onClose={onClose}>
      <div className="space-y-5">
        {formMessage && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{formMessage}</div>}
        {supplierAccounts.length === 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">No supplier user accounts found. Create a supplier account through /register/supplier first.</div>}
        <SectionCard title="Company Information" tone="blue">
          <div className="grid gap-4 md:grid-cols-2">
            <SelectInput label="Existing supplier account" required value={formData.userId} onChange={selectAccount}>
              <option value="">Select supplier account</option>
              {supplierAccounts.map((account) => <option key={account.id} value={account.id}>{account.company_name || account.email || account.id} - {account.id}</option>)}
            </SelectInput>
            <TextInput label="Company name" required value={formData.companyName} onChange={(value) => updateForm('companyName', value)} />
            <TextInput label="Business registration number" required value={formData.businessRegistrationNumber} onChange={(value) => updateForm('businessRegistrationNumber', value)} />
            <TextInput label="Tax / VAT number" value={formData.taxVatNumber} onChange={(value) => updateForm('taxVatNumber', value)} />
            <SelectInput label="Company country" required value={formData.countryIso2} onChange={(value) => selectCountry(value, 'country')}>
              <option value="">{formData.countryName || 'Select country'}</option>
              {countries.map((country) => <option key={country.country_id} value={country.iso2}>{country.name}</option>)}
            </SelectInput>
            <TextInput label="Website" value={formData.website} onChange={(value) => updateForm('website', value)} />
            <TextInput label="Company phone" value={formData.companyPhone} onChange={(value) => updateForm('companyPhone', value)} />
            <TextInput label="Company email" value={formData.companyEmail} onChange={(value) => updateForm('companyEmail', value)} />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <TextAreaInput label="Legal address" value={formData.legalAddress} onChange={(value) => updateForm('legalAddress', value)} />
            <TextAreaInput label="Office address" value={formData.officeAddress} onChange={(value) => updateForm('officeAddress', value)} />
            <TextAreaInput label="Company description" value={formData.companyDescription} onChange={(value) => updateForm('companyDescription', value)} />
            <TextAreaInput label="Product categories / supplied product groups" value={formData.productCategoriesText} onChange={(value) => updateForm('productCategoriesText', value)} />
          </div>
          <div className="mt-4">
            <TextInput label="Years in business" type="number" value={formData.yearsInBusiness} onChange={(value) => updateForm('yearsInBusiness', value)} />
          </div>
        </SectionCard>
        <SectionCard title="Main Contact" tone="blue">
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Main contact name" required value={formData.mainContactName} onChange={(value) => updateForm('mainContactName', value)} />
            <TextInput label="Main contact position" value={formData.mainContactPosition} onChange={(value) => updateForm('mainContactPosition', value)} />
            <TextInput label="Main contact email" required type="email" value={formData.mainContactEmail} onChange={(value) => updateForm('mainContactEmail', value)} />
            <TextInput label="Main contact phone" value={formData.mainContactPhone} onChange={(value) => updateForm('mainContactPhone', value)} />
          </div>
        </SectionCard>
        <SectionCard title="Bank Account / Payout Details" tone="blue">
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Bank account holder name" value={formData.bankAccountHolderName} onChange={(value) => updateForm('bankAccountHolderName', value)} />
            <TextInput label="Bank name" value={formData.bankName} onChange={(value) => updateForm('bankName', value)} />
            <SelectInput label="Bank country" value={formData.bankCountryIso2} onChange={(value) => selectCountry(value, 'bankCountry')}>
              <option value="">{formData.bankCountryName || 'Select country'}</option>
              {countries.map((country) => <option key={country.country_id} value={country.iso2}>{country.name}</option>)}
            </SelectInput>
            <TextInput label="Bank address" value={formData.bankAddress} onChange={(value) => updateForm('bankAddress', value)} />
            <TextInput label="Account number" value={formData.accountNumber} onChange={(value) => updateForm('accountNumber', value)} />
            <TextInput label="IBAN" value={formData.iban} onChange={(value) => updateForm('iban', value)} />
            <TextInput label="SWIFT / BIC" value={formData.swiftBic} onChange={(value) => updateForm('swiftBic', value)} />
            <TextInput label="Payment currency" value={formData.paymentCurrency} onChange={(value) => updateForm('paymentCurrency', value)} />
          </div>
          <div className="mt-4">
            <TextAreaInput label="Payment notes" value={formData.paymentNotes} onChange={(value) => updateForm('paymentNotes', value)} />
          </div>
        </SectionCard>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          <HubButton onClick={saveSupplier} loading={saving} loadingText="Saving...">Save Supplier</HubButton>
        </div>
      </div>
    </Modal>
  );
}

function CreateCustomerModal({
  countries,
  customerProfiles,
  supabase,
  onClose,
  onSaved,
}: {
  countries: CountryRow[];
  customerProfiles: CustomerCompanyProfileRow[];
  supabase: ReturnType<typeof createClient>;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [formData, setFormData] = useState<CustomerFormData>({
    userId: '',
    selectedUserEmail: '',
    selectedUserCurrentRole: '',
    companyName: '',
    businessRegistrationNumber: '',
    countryIso2: '',
    countryName: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    website: '',
    companyAddress: '',
    customerNotes: '',
    customerStatus: 'active',
  });
  const [formMessage, setFormMessage] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<UserProfileRow[]>([]);
  const [userSearchMessage, setUserSearchMessage] = useState('Type at least 2 characters to search.');
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [saving, setSaving] = useState(false);

  const updateForm = (field: keyof CustomerFormData, value: string) => setFormData((current) => ({ ...current, [field]: value }));
  const selectCountry = (iso2: string) => {
    const country = countries.find((row) => row.iso2 === iso2);
    setFormData((current) => ({ ...current, countryIso2: country?.iso2 || '', countryName: country?.name || '' }));
  };
  const selectAccount = (account: UserProfileRow) => {
    const existing = customerProfiles.find((row) => row.user_id === account.id);
    setFormData((current) => ({
      ...current,
      userId: account.id,
      selectedUserEmail: account?.email || '',
      selectedUserCurrentRole: account?.role || '',
      companyName: current.companyName || existing?.company_name || account?.company_name || '',
      businessRegistrationNumber: current.businessRegistrationNumber || existing?.business_registration_number || '',
      countryIso2: current.countryIso2 || existing?.country_iso2 || '',
      countryName: current.countryName || existing?.country_name || '',
      contactName: current.contactName || existing?.contact_name || account?.full_name || '',
      contactEmail: current.contactEmail || existing?.contact_email || account?.email || '',
      contactPhone: current.contactPhone || existing?.contact_phone || '',
      website: current.website || existing?.website || '',
      companyAddress: current.companyAddress || existing?.company_address || '',
      customerNotes: current.customerNotes || existing?.customer_notes || '',
      customerStatus: current.customerStatus || existing?.customer_status || 'active',
    }));
    setUserSearch(account.email || '');
    setUserSearchResults([]);
    setUserSearchMessage('');
  };
  const clearSelectedUser = (resetSearch = true) => {
    setFormData((current) => ({
      ...current,
      userId: '',
      selectedUserEmail: '',
      selectedUserCurrentRole: '',
    }));
    if (resetSearch) setUserSearch('');
    setUserSearchResults([]);
    setUserSearchMessage('Type at least 2 characters to search.');
  };

  useEffect(() => {
    const searchTerm = userSearch.trim();
    if (formData.userId && searchTerm === formData.selectedUserEmail) return;
    if (searchTerm.length < 2) {
      setUserSearchResults([]);
      setUserSearchMessage('Type at least 2 characters to search.');
      setSearchingUsers(false);
      return;
    }

    setSearchingUsers(true);
    const timeoutId = window.setTimeout(async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, role, full_name, company_name, created_at')
        .or('role.is.null,role.eq.customer,role.eq.supplier')
        .ilike('email', `%${searchTerm}%`)
        .order('email', { ascending: true })
        .limit(20);

      if (error) {
        setUserSearchResults([]);
        setUserSearchMessage(error.message);
        setSearchingUsers(false);
        return;
      }

      const results = (data ?? []) as UserProfileRow[];
      setUserSearchResults(results);
      setUserSearchMessage(results.length === 0 ? 'No matching registered users found.' : '');
      setSearchingUsers(false);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [formData.selectedUserEmail, formData.userId, supabase, userSearch]);

  const saveCustomer = async () => {
    setFormMessage('');
    const missing: string[] = [];
    if (!formData.userId) missing.push('Please select an existing registered user email.');
    if (!formData.companyName.trim()) missing.push('Company name is required.');
    if (!formData.contactName.trim()) missing.push('Contact name is required.');
    if (!formData.contactEmail.trim()) missing.push('Contact email is required.');
    if (!formData.countryName.trim()) missing.push('Customer country is required.');
    if (missing.length > 0) {
      setFormMessage(missing.join(' '));
      return;
    }

    setSaving(true);
    const { error: roleError } = await supabase
      .from('user_profiles')
      .update({ role: 'customer' })
      .eq('id', formData.userId);

    if (roleError) {
      setFormMessage(roleError.message);
      setSaving(false);
      return;
    }

    const { error } = await supabase.from('customer_company_profiles').upsert(
      {
        user_id: formData.userId,
        company_name: formData.companyName.trim(),
        business_registration_number: nullableText(formData.businessRegistrationNumber),
        country_iso2: formData.countryIso2 || null,
        country_name: formData.countryName.trim(),
        contact_name: formData.contactName.trim(),
        contact_email: formData.contactEmail.trim(),
        contact_phone: nullableText(formData.contactPhone),
        website: nullableText(formData.website),
        company_address: nullableText(formData.companyAddress),
        customer_notes: nullableText(formData.customerNotes),
        customer_status: formData.customerStatus || 'active',
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      setFormMessage(error.message);
      setSaving(false);
      return;
    }

    await onSaved();
    setSaving(false);
    onClose();
  };

  return (
    <Modal title="Create / Update Customer Record" onClose={onClose}>
      <div className="space-y-5">
        {formMessage && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{formMessage}</div>}
        <SectionCard title="Customer Company Profile" tone="blue">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block">
                <FieldLabel label="Existing registered user email" required />
                <input
                  type="search"
                  value={userSearch}
                  onChange={(event) => {
                    setUserSearch(event.target.value);
                    if (formData.userId) clearSelectedUser(false);
                  }}
                  placeholder="Type email to search..."
                  className={inputClass}
                />
              </label>
              <p className="mt-1 text-xs text-slate-600">Start typing an existing registered user email. The selected user will be assigned the customer role and linked to this customer company profile.</p>
              {formData.userId && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <span><span className="font-semibold">Selected user:</span> {formData.selectedUserEmail || formData.userId} - {formData.selectedUserCurrentRole || 'no role'}</span>
                  <button type="button" onClick={() => clearSelectedUser()} className="text-sm font-semibold text-blue-700 hover:text-blue-800">Clear</button>
                </div>
              )}
              {!formData.userId && (
                <div className="relative mt-2">
                  {(searchingUsers || userSearchMessage) && <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">{searchingUsers ? 'Searching...' : userSearchMessage}</div>}
                  {userSearchResults.length > 0 && (
                    <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                      {userSearchResults.map((account) => (
                        <button
                          key={account.id}
                          type="button"
                          onClick={() => selectAccount(account)}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
                        >
                          <span className="block font-semibold text-slate-900">{account.email || account.id}</span>
                          <span className="block text-xs text-slate-600">current role: {account.role || 'no role'}{account.full_name ? ` - ${account.full_name}` : ''}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <TextInput label="Company name" required value={formData.companyName} onChange={(value) => updateForm('companyName', value)} />
            <TextInput label="Business registration number" value={formData.businessRegistrationNumber} onChange={(value) => updateForm('businessRegistrationNumber', value)} />
            <SelectInput label="Customer country" required value={formData.countryIso2} onChange={selectCountry}>
              <option value="">{formData.countryName || 'Select country'}</option>
              {countries.map((country) => <option key={country.country_id} value={country.iso2}>{country.name}</option>)}
            </SelectInput>
            <TextInput label="Contact name" required value={formData.contactName} onChange={(value) => updateForm('contactName', value)} />
            <TextInput label="Contact email" required type="email" value={formData.contactEmail} onChange={(value) => updateForm('contactEmail', value)} />
            <TextInput label="Contact phone" value={formData.contactPhone} onChange={(value) => updateForm('contactPhone', value)} />
            <TextInput label="Website" value={formData.website} onChange={(value) => updateForm('website', value)} />
            <SelectInput label="Status" value={formData.customerStatus} onChange={(value) => updateForm('customerStatus', value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </SelectInput>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <TextAreaInput label="Company address" value={formData.companyAddress} onChange={(value) => updateForm('companyAddress', value)} />
            <TextAreaInput label="Notes" value={formData.customerNotes} onChange={(value) => updateForm('customerNotes', value)} />
          </div>
        </SectionCard>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          <HubButton onClick={saveCustomer} loading={saving} loadingText="Saving...">Save Customer</HubButton>
        </div>
      </div>
    </Modal>
  );
}

export default function AdminControlCenterPage() {
  const supabase = useMemo(() => createClient(), []);
  const [adminId, setAdminId] = useState('');
  const [adminHeaderProfile, setAdminHeaderProfile] = useState<AdminHeaderProfile>({
    email: '',
    name: 'Admin User',
    companyName: 'Electron Market Admin',
    avatarUrl: '',
  });
  const [headerError, setHeaderError] = useState('');
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [rfqs, setRfqs] = useState<RfqRow[]>([]);
  const [items, setItems] = useState<RfqItemRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierProfileRow[]>([]);
  const [customers, setCustomers] = useState<CustomerCompanyProfileRow[]>([]);
  const [customerAccounts, setCustomerAccounts] = useState<UserProfileRow[]>([]);
  const [supplierAccounts, setSupplierAccounts] = useState<UserProfileRow[]>([]);
  const [customerProfiles, setCustomerProfiles] = useState<CustomerCompanyProfileRow[]>([]);
  const [customerProfileLoadError, setCustomerProfileLoadError] = useState('');
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [activeOrders, setActiveOrders] = useState<ActiveOrderRow[]>([]);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [progressRows, setProgressRows] = useState<ProcurementProgressRow[]>([]);
  const [selectedRfq, setSelectedRfq] = useState<RfqRow | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierProfileRow | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<UserProfileRow | null>(null);
  const [supplierDetailLoading, setSupplierDetailLoading] = useState(false);
  const [supplierDetailErrors, setSupplierDetailErrors] = useState<string[]>([]);
  const [supplierDetailAssignments, setSupplierDetailAssignments] = useState<AssignmentRow[]>([]);
  const [supplierDetailRfqs, setSupplierDetailRfqs] = useState<RfqRow[]>([]);
  const [supplierDetailItems, setSupplierDetailItems] = useState<RfqItemRow[]>([]);
  const [supplierDetailOrders, setSupplierDetailOrders] = useState<ActiveOrderRow[]>([]);
  const [customerDetailLoading, setCustomerDetailLoading] = useState(false);
  const [customerDetailErrors, setCustomerDetailErrors] = useState<string[]>([]);
  const [customerDetailRfqs, setCustomerDetailRfqs] = useState<RfqRow[]>([]);
  const [customerDetailItems, setCustomerDetailItems] = useState<RfqItemRow[]>([]);
  const [customerDetailAssignments, setCustomerDetailAssignments] = useState<AssignmentRow[]>([]);
  const [customerDetailOrders, setCustomerDetailOrders] = useState<ActiveOrderRow[]>([]);
  const [showCreateRfq, setShowCreateRfq] = useState(false);
  const [showCreateSupplier, setShowCreateSupplier] = useState(false);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [showAiConversations, setShowAiConversations] = useState(false);
  const [assigningRfq, setAssigningRfq] = useState<RfqRow | null>(null);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [allowAllSuppliers,setAllowAllSuppliers]=useState(true);
  const [adminNotes, setAdminNotes] = useState('');
  const [savingAssignment, setSavingAssignment] = useState(false);

  const addError = (label: string, errorMessage?: string) => {
    if (!errorMessage) return;
    setErrors((current) => [...current, `${label}: ${errorMessage}`]);
  };

  const loadDashboard = async () => {
    setLoading(true);
    setErrors([]);
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData.user;
    setAdminId(authUser?.id || '');
    if (authUser) {
      const metadata = authUser.user_metadata || {};
      const fallbackEmail = authUser.email || '';
      const fallbackName = (metadata.full_name as string | undefined) || fallbackEmail || 'Admin User';
      const fallbackCompany = (metadata.company_name as string | undefined) || 'Electron Market Admin';
      const avatarUrl = ((metadata.avatar_url as string | undefined) || (metadata.picture as string | undefined) || '').trim();
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('email, full_name, company_name')
        .eq('id', authUser.id)
        .maybeSingle();

      setAdminHeaderProfile({
        email: profileData?.email || fallbackEmail,
        name: profileData?.full_name || fallbackName,
        companyName: profileData?.company_name || fallbackCompany,
        avatarUrl,
      });
      setHeaderError(profileError?.message || '');
    }

    const canonicalRfqResponse = await fetch('/api/admin/dashboard/rfqs', { cache: 'no-store' });
    const canonicalRfqPayload = await canonicalRfqResponse.json().catch(() => ({}));
    const canonicalRfqError = canonicalRfqResponse.ok ? null : { message: canonicalRfqPayload.error || 'Canonical RFQs could not be loaded.' };
    const [
      rfqResult,
      itemsResult,
      assignmentsResult,
      suppliersResult,
      customersResult,
      customerAccountsResult,
      supplierAccountsResult,
      customerProfilesResult,
      countriesResult,
      activeOrdersResult,
      quotesResult,
      contactsResult,
      documentsResult,
    ] = await Promise.all([
      Promise.resolve({ data: canonicalRfqPayload.rfqs ?? [], error: canonicalRfqError }),
      Promise.resolve({ data: canonicalRfqPayload.items ?? [], error: canonicalRfqError }),
      Promise.resolve({ data: canonicalRfqPayload.assignments ?? [], error: canonicalRfqError }),
      supabase.from('supplier_company_profiles').select('*').order('created_at', { ascending: false }).limit(30),
      supabase.from('customer_company_profiles').select('customer_profile_id, user_id, company_name, business_registration_number, country_iso2, country_name, contact_name, contact_email, contact_phone, website, company_address, customer_notes, customer_status, created_at, updated_at').order('created_at', { ascending: false }).limit(30),
      supabase.from('user_profiles').select('id, email, role, full_name, company_name, created_at').eq('role', 'customer').order('created_at', { ascending: false }).limit(100),
      supabase.from('user_profiles').select('id, email, role, full_name, company_name, created_at').eq('role', 'supplier').order('created_at', { ascending: false }).limit(100),
      supabase.from('customer_company_profiles').select('customer_profile_id, user_id, company_name, business_registration_number, country_iso2, country_name, contact_name, contact_email, contact_phone, website, company_address, customer_notes, customer_status, created_at, updated_at').eq('customer_status', 'active').order('company_name', { ascending: true }).limit(100),
      supabase.from('countries').select('country_id, iso2, iso3, name').eq('is_active', true).order('name', { ascending: true }),
      supabase.from('active_orders').select('order_number, customer_id, customer_company_name, current_stage, order_status'),
      supabase.from('supplier_quotes0').select('quote_id, order_number, supplier_company_name, quote_status, quote_total, currency'),
      supabase.from('supplier_company_contacts').select('profile_id, contact_index, contact_name, contact_position, contact_email, contact_phone').order('contact_index', { ascending: true }),
      supabase.from('supplier_company_documents').select('profile_id, document_title, file_name, document_status'),
    ]);

    if (rfqResult.error) addError('Latest RFQs', rfqResult.error.message);
    if (itemsResult.error) addError('RFQ items', itemsResult.error.message);
    if (assignmentsResult.error) addError('RFQ assignments', assignmentsResult.error.message);
    if (suppliersResult.error) addError('Latest Suppliers', suppliersResult.error.message);
    if (customersResult.error) addError('Latest Customers', customersResult.error.message);
    if (customerAccountsResult.error) addError('Customer Accounts', customerAccountsResult.error.message);
    if (supplierAccountsResult.error) addError('Supplier Accounts', supplierAccountsResult.error.message);
    if (customerProfilesResult.error) addError('Customer Company Profiles', customerProfilesResult.error.message);
    if (countriesResult.error) addError('Countries', countriesResult.error.message);
    if (activeOrdersResult.error) addError('Active Orders', activeOrdersResult.error.message);
    if (quotesResult.error) addError('Supplier Quotes', quotesResult.error.message);
    if (contactsResult.error) addError('Supplier Contacts', contactsResult.error.message);
    if (documentsResult.error) addError('Supplier Documents', documentsResult.error.message);

    for (const warning of canonicalRfqPayload.warnings ?? []) addError('RFQ data integrity', warning.message);
    const loadedRfqs=(rfqResult.data ?? []) as RfqRow[];
    setRfqs(loadedRfqs);
    setItems((itemsResult.data ?? []) as RfqItemRow[]);
    setAssignments((assignmentsResult.data ?? []) as AssignmentRow[]);
    const supplierProfiles = (suppliersResult.data ?? []) as SupplierProfileRow[];
    const profileIds = supplierProfiles.map((row) => row.profile_id);
    const canonicalLinks = profileIds.length ? await supabase.from('suppliers').select('supplier_id,source_profile_id').in('source_profile_id', profileIds) : {data:[],error:null};
    if (canonicalLinks.error) addError('Canonical supplier links', canonicalLinks.error.message);
    const canonicalByProfile = new Map((canonicalLinks.data ?? []).map((row:any) => [row.source_profile_id,row.supplier_id]));
    setSuppliers(supplierProfiles.filter((row) => canonicalByProfile.has(row.profile_id)).map((row) => ({...row,canonical_supplier_id:canonicalByProfile.get(row.profile_id)!})));
    setCustomers((customersResult.data ?? []) as CustomerCompanyProfileRow[]);
    setCustomerAccounts((customerAccountsResult.data ?? []) as UserProfileRow[]);
    setSupplierAccounts((supplierAccountsResult.data ?? []) as UserProfileRow[]);
    setCustomerProfiles((customerProfilesResult.data ?? []) as CustomerCompanyProfileRow[]);
    setCustomerProfileLoadError(customerProfilesResult.error?.message || '');
    setCountries((countriesResult.data ?? []) as CountryRow[]);
    setActiveOrders((activeOrdersResult.data ?? []) as ActiveOrderRow[]);
    setQuotes((quotesResult.data ?? []) as QuoteRow[]);
    setContacts((contactsResult.data ?? []) as ContactRow[]);
    setDocuments((documentsResult.data ?? []) as DocumentRow[]);
    const progressResponse = await fetch('/api/progress/admin');
    const progressResult = await progressResponse.json().catch(() => ({}));
    if (progressResponse.ok) {
      setProgressRows((progressResult.progress ?? []) as ProcurementProgressRow[]);
    } else {
      setProgressRows([]);
      addError('Procurement Progress', progressResult.error || 'Unable to load procurement progress.');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const itemsByRfq = useMemo(() => {
    const map = new Map<string, RfqItemRow[]>();
    items.forEach((item) => map.set(item.rfq_id, [...(map.get(item.rfq_id) ?? []), item]));
    return map;
  }, [items]);

  const assignmentsByRfq = useMemo(() => {
    const map = new Map<string, AssignmentRow[]>();
    assignments.forEach((assignment) => map.set(assignment.rfq_id, [...(map.get(assignment.rfq_id) ?? []), assignment]));
    return map;
  }, [assignments]);

  const activeOrdersByOrder = useMemo(() => new Map(activeOrders.map((order) => [order.order_number, order])), [activeOrders]);
  const quotesByOrder = useMemo(() => {
    const map = new Map<string, QuoteRow[]>();
    quotes.forEach((quote) => map.set(quote.order_number, [...(map.get(quote.order_number) ?? []), quote]));
    return map;
  }, [quotes]);
  const customerProfilesByUser = useMemo(() => new Map(customerProfiles.map((profile) => [profile.user_id, profile])), [customerProfiles]);

  const kpis = [
    { label: 'New RFQs', value: rfqs.filter((rfq) => ['draft','open'].includes(String(rfq.rfq_status||'').toLowerCase())).length },
    { label: 'Active Orders', value: activeOrders.filter((order) => order.order_status === 'active').length },
    { label: 'Pending Supplier Review', value: suppliers.filter((supplier) => ['pending', 'in_review', 'needs_update'].includes(supplier.verification_status || '')).length },
    { label: 'New Suppliers', value: suppliers.length },
    { label: 'New Customers', value: customers.length },
  ];

  const getRfqCategory = (rfq: RfqRow) => {
    const categories = Array.from(new Set((itemsByRfq.get(rfq.rfq_id) ?? []).map((item) => item.category_name).filter(Boolean)));
    if (categories.length > 1) return 'Multiple categories';
    return categories[0] || '-';
  };

  const getRfqValue = (rfq: RfqRow) => {
    const relatedItems = itemsByRfq.get(rfq.rfq_id) ?? [];
    const total = relatedItems.reduce((sum, item) => sum + Number(item.target_total_price ?? 0), 0);
    return total ? formatMoney(total, relatedItems[0]?.currency || 'USD') : '-';
  };

  const getRfqStage = (rfq: RfqRow): StageKey => {
    const activeOrder = activeOrdersByOrder.get(rfq.order_number);
    if (activeOrder?.current_stage) return normalizeStage(activeOrder.current_stage);
    const relatedQuotes = quotesByOrder.get(rfq.order_number) ?? [];
    if (relatedQuotes.some((quote) => ['approved', 'rejected'].includes(quote.quote_status || ''))) return 'approved';
    if (relatedQuotes.some((quote) => ['sent', 'viewed'].includes(quote.quote_status || ''))) return 'quote_received';
    return 'rfq';
  };

  const openAssignModal = async (event: MouseEvent<HTMLButtonElement>, rfq: RfqRow) => {
    event.stopPropagation();
    setAssigningRfq(rfq);
    setSelectedSupplierIds([]);
    setAdminNotes('');
    setMessage('');
    const response=await fetch(`/api/admin/rfqs/${rfq.rfq_id}/supplier-access`,{cache:'no-store'}),result=await response.json().catch(()=>({}));if(response.ok){setAllowAllSuppliers(result.allowAllSuppliers!==false);setSelectedSupplierIds(result.selectedSupplierIds??[])}
  };

  const signOutAdmin = async () => {
    setHeaderError('');
    const { error } = await supabase.auth.signOut();
    if (error) {
      setHeaderError(error.message);
      return;
    }
    window.location.assign('/login');
  };

  const advanceAdminProgress = async (progress: ProcurementProgressRow, nextStage: StageKey) => {
    const body: Record<string, unknown> = { next_stage: nextStage };
    if (nextStage === 'payment') {
      body.payment_amount = window.prompt('Payment amount', String(progress.payment_amount || '')) || '';
      body.payment_currency = window.prompt('Payment currency', progress.payment_currency || 'USD') || 'USD';
      body.payment_reference = window.prompt('Payment reference', progress.payment_reference || '') || '';
      body.note = 'Payment information entered by admin';
    } else if (nextStage === 'goods_shipped') {
      body.shipment_carrier = window.prompt('Shipment carrier', progress.shipment_carrier || '') || '';
      body.shipment_tracking_number = window.prompt('Tracking number', progress.shipment_tracking_number || '') || '';
      body.shipment_tracking_url = window.prompt('Tracking URL', '') || '';
      body.note = 'Goods shipped information entered by admin';
    } else if (nextStage === 'order_completed') {
      body.note = 'Order completed by admin';
    }

    const response = await fetch(`/api/progress/${progress.id}/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setErrors((current) => [...current, `Procurement Progress: ${result.error || 'Unable to update progress.'}`]);
      return;
    }
    setMessage(`Progress updated to ${stageMeta[nextStage].label}.`);
    await loadDashboard();
  };

  const assignSelectedSuppliers = async () => {
    if (!assigningRfq || (!allowAllSuppliers&&selectedSupplierIds.length === 0)) return;
    setSavingAssignment(true);
    setMessage('');
    setErrors([]);
    const response=await fetch(`/api/admin/rfqs/${assigningRfq.rfq_id}/supplier-access`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({allowAllSuppliers,selectedSupplierIds})});const saved=await response.json().catch(()=>({}));if(!response.ok){setErrors([saved.error||'Supplier access could not be saved.']);setSavingAssignment(false);return}
    /* const payload = selectedSupplierIds.map((supplierId) => {
      const supplier = suppliers.find((row) => row.user_id === supplierId);
      return {
        rfq_id: assigningRfq.rfq_id,
        order_number: assigningRfq.order_number,
        supplier_id: supplierId,
        supplier_company_name: supplier?.company_name || null,
        assigned_by_admin_id: adminId || null,
        assignment_status: 'assigned',
        admin_notes: adminNotes.trim() || null,
        assigned_at: new Date().toISOString(),
      };
    });

    const { error } = await supabase.from(ASSIGNMENTS_TABLE).insert(payload);
    if (error) {
      setErrors([error.code === '23505' ? 'RFQ is already assigned to this supplier.' : error.message]);
      setSavingAssignment(false);
      return;
    }

    const firstSupplier = suppliers.find((row) => row.user_id === selectedSupplierIds[0]);
    await supabase
      .from('procurement_progress')
      .update({
        supplier_user_id: selectedSupplierIds[0] || null,
        supplier_company_name: firstSupplier?.company_name || null,
        current_stage: 'rfq',
        current_stage_label: 'RFQ',
        rfq_sent_at: new Date().toISOString(),
        status_note: 'RFQ assigned to supplier',
      })
      .eq('rfq_id', assigningRfq.rfq_id);

    */
    setMessage(allowAllSuppliers?'All eligible suppliers can submit offers.':'RFQ restricted to selected suppliers.');
    setAssigningRfq(null);
    setSavingAssignment(false);
    await loadDashboard();
  };

  const updateSupplierStatus = async (supplier: SupplierProfileRow, status: 'approved' | 'needs_update') => {
    const { error } = await supabase
      .from('supplier_company_profiles')
      .update({ verification_status: status })
      .eq('profile_id', supplier.profile_id);

    if (error) {
      setErrors([error.message]);
      return;
    }

    setSelectedSupplier({ ...supplier, verification_status: status });
    setSuppliers((current) => current.map((row) => (row.profile_id === supplier.profile_id ? { ...row, verification_status: status } : row)));
  };

  const selectedCustomerProfile = selectedCustomer ? customerProfilesByUser.get(selectedCustomer.id) : null;

  useEffect(() => {
    let active = true;

    const loadSupplierDetail = async () => {
      if (!selectedSupplier) {
        setSupplierDetailLoading(false);
        setSupplierDetailAssignments([]);
        setSupplierDetailRfqs([]);
        setSupplierDetailItems([]);
        setSupplierDetailOrders([]);
        setSupplierDetailErrors([]);
        return;
      }

      if (!selectedSupplier.user_id) {
        setSupplierDetailLoading(false);
        setSupplierDetailErrors(['This record is not linked to a registered user account yet.']);
        setSupplierDetailAssignments([]);
        setSupplierDetailRfqs([]);
        setSupplierDetailItems([]);
        setSupplierDetailOrders([]);
        return;
      }

      setSupplierDetailLoading(true);
      setSupplierDetailErrors([]);

      const [assignmentResult, orderResult] = await Promise.all([
        supabase.from(ASSIGNMENTS_TABLE).select('*').eq('supplier_id', selectedSupplier.user_id).order('assigned_at', { ascending: false }),
        supabase
          .from('active_orders')
          .select('order_number, customer_id, customer_company_name, supplier_id, supplier_company_name, current_stage, order_status, payment_status, expected_delivery_at, order_total, currency')
          .eq('supplier_id', selectedSupplier.user_id)
          .order('created_at', { ascending: false }),
      ]);

      const detailErrors: string[] = [];
      if (assignmentResult.error) detailErrors.push(`Supplier RFQ assignments: ${assignmentResult.error.message}`);
      if (orderResult.error) detailErrors.push(`Supplier active orders: ${orderResult.error.message}`);

      const assignmentRows = (assignmentResult.data ?? []) as AssignmentRow[];
      const rfqIds = Array.from(new Set(assignmentRows.map((assignment) => assignment.rfq_id).filter(Boolean)));
      let rfqRows: RfqRow[] = [];
      let itemRows: RfqItemRow[] = [];

      if (rfqIds.length > 0) {
        const [rfqResult, itemResult] = await Promise.all([
          supabase.from('rfq_orders0').select('*').in('rfq_id', rfqIds).order('created_at', { ascending: false }),
          supabase.from('rfq_order_items0').select('*').in('rfq_id', rfqIds).order('line_number', { ascending: true }),
        ]);
        if (rfqResult.error) detailErrors.push(`Supplier assigned RFQs: ${rfqResult.error.message}`);
        if (itemResult.error) detailErrors.push(`Supplier RFQ items: ${itemResult.error.message}`);
        rfqRows = (rfqResult.data ?? []) as RfqRow[];
        itemRows = (itemResult.data ?? []) as RfqItemRow[];
      }

      if (!active) return;
      setSupplierDetailAssignments(assignmentRows);
      setSupplierDetailRfqs(rfqRows);
      setSupplierDetailItems(itemRows);
      setSupplierDetailOrders((orderResult.data ?? []) as ActiveOrderRow[]);
      setSupplierDetailErrors(detailErrors);
      setSupplierDetailLoading(false);
    };

    loadSupplierDetail();
    return () => {
      active = false;
    };
  }, [selectedSupplier, supabase]);

  useEffect(() => {
    let active = true;

    const loadCustomerDetail = async () => {
      if (!selectedCustomer) {
        setCustomerDetailLoading(false);
        setCustomerDetailRfqs([]);
        setCustomerDetailItems([]);
        setCustomerDetailAssignments([]);
        setCustomerDetailOrders([]);
        setCustomerDetailErrors([]);
        return;
      }

      if (!selectedCustomer.id) {
        setCustomerDetailLoading(false);
        setCustomerDetailErrors(['This record is not linked to a registered user account yet.']);
        setCustomerDetailRfqs([]);
        setCustomerDetailItems([]);
        setCustomerDetailAssignments([]);
        setCustomerDetailOrders([]);
        return;
      }

      setCustomerDetailLoading(true);
      setCustomerDetailErrors([]);

      const [rfqResult, orderResult] = await Promise.all([
        supabase.from('rfq_orders0').select('*').eq('customer_id', selectedCustomer.id).order('created_at', { ascending: false }),
        supabase
          .from('active_orders')
          .select('order_number, customer_id, customer_company_name, supplier_id, supplier_company_name, current_stage, order_status, payment_status, expected_delivery_at, order_total, currency')
          .eq('customer_id', selectedCustomer.id)
          .order('created_at', { ascending: false }),
      ]);

      const detailErrors: string[] = [];
      if (rfqResult.error) detailErrors.push(`Customer RFQs: ${rfqResult.error.message}`);
      if (orderResult.error) detailErrors.push(`Customer active orders: ${orderResult.error.message}`);

      const rfqRows = (rfqResult.data ?? []) as RfqRow[];
      const rfqIds = Array.from(new Set(rfqRows.map((rfq) => rfq.rfq_id).filter(Boolean)));
      let itemRows: RfqItemRow[] = [];
      let assignmentRows: AssignmentRow[] = [];

      if (rfqIds.length > 0) {
        const [itemResult, assignmentResult] = await Promise.all([
          supabase.from('rfq_order_items0').select('*').in('rfq_id', rfqIds).order('line_number', { ascending: true }),
          supabase.from(ASSIGNMENTS_TABLE).select('*').in('rfq_id', rfqIds).order('assigned_at', { ascending: false }),
        ]);
        if (itemResult.error) detailErrors.push(`Customer RFQ items: ${itemResult.error.message}`);
        if (assignmentResult.error) detailErrors.push(`Customer RFQ assignments: ${assignmentResult.error.message}`);
        itemRows = (itemResult.data ?? []) as RfqItemRow[];
        assignmentRows = (assignmentResult.data ?? []) as AssignmentRow[];
      }

      if (!active) return;
      setCustomerDetailRfqs(rfqRows);
      setCustomerDetailItems(itemRows);
      setCustomerDetailAssignments(assignmentRows);
      setCustomerDetailOrders((orderResult.data ?? []) as ActiveOrderRow[]);
      setCustomerDetailErrors(detailErrors);
      setCustomerDetailLoading(false);
    };

    loadCustomerDetail();
    return () => {
      active = false;
    };
  }, [selectedCustomer, supabase]);

  const avatarInitials = getInitials(adminHeaderProfile.name || adminHeaderProfile.email);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-slate-900">
      <header className="bg-[#071b3a] px-4 py-4 text-white shadow-md sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">Electron Market</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Admin HUB</h1>
            <p className="mt-1 max-w-2xl text-sm text-blue-100">Review RFQs, suppliers, customers, and manually assign buyer RFQs to suppliers.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {adminHeaderProfile.email && (
              <p className="max-w-[220px] truncate text-sm font-medium text-white" title={adminHeaderProfile.email}>
                {adminHeaderProfile.email}
              </p>
            )}
            {adminHeaderProfile.avatarUrl ? (
              <img src={adminHeaderProfile.avatarUrl} alt="" className="h-12 w-12 rounded-full border border-white/30 object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-blue-600 text-sm font-bold text-white">{avatarInitials}</div>
            )}
            <div className="min-w-0">
              <p className="max-w-48 truncate text-sm font-semibold">{adminHeaderProfile.name}</p>
              <p className="max-w-48 truncate text-xs text-blue-100">{adminHeaderProfile.companyName}</p>
              {headerError && <p className="max-w-64 text-xs text-amber-200">{headerError}</p>}
            </div>
            <Link href="/" className="admin-primary-button admin-primary-button-compact">Home</Link>
            <button type="button" onClick={signOutAdmin} className="admin-primary-button admin-primary-button-compact">Sign out</button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">

        {errors.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {errors.map((error) => <p key={error}>{error}</p>)}
          </div>
        )}
        {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {kpis.map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-500">{item.label}</p>
              <p className="mt-3 text-4xl font-bold text-slate-950">{loading ? '-' : item.value}</p>
            </div>
          ))}
        </section>

        <SectionCard title="Procurement Progress">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-blue-600 text-white">
                <tr>
                  {['Progress No', 'Customer', 'Supplier', 'System Procurement Number', 'Customer Reference', 'Current Stage', 'Progress', 'Updated', 'Action'].map((heading) => (
                    <th key={heading} className={tableHeaderCellClass}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {progressRows.length === 0 ? (
                  <tr><td colSpan={9} className={emptyCellClass}>No procurement progress records yet.</td></tr>
                ) : (
                  progressRows.map((progress) => {
                    const stage = normalizeStage(progress.current_stage);
                    const chainId = String(progress.procurement_chain_id ?? '').trim();
                    const procurementNumber = String(progress.procurement_number ?? '').trim();
                    const customerReference = String(progress.customer_reference ?? progress.document_name ?? '').trim();
                    const detailsHref = chainId ? `/admin/procurement-progress/${encodeURIComponent(chainId)}` : null;
                    return (
                      <tr key={progress.id} className="hover:bg-blue-50">
                        <td className="px-4 py-3 font-semibold text-slate-950">#{progress.progress_number ?? '-'}</td>
                        <td className="px-4 py-3">{progress.customer_company_name || '-'}</td>
                        <td className="px-4 py-3">{progress.supplier_company_name || '-'}</td>
                        <td className="px-4 py-3 font-semibold text-slate-950">{procurementNumber || '-'}</td>
                        <td className="px-4 py-3">{customerReference || '-'}</td>
                        <td className="px-4 py-3">{stageMeta[stage].label}</td>
                        <td className="px-4 py-3"><StageProgress currentStage={stage} /></td>
                        <td className="px-4 py-3">{formatDateTime(progress.updated_at || progress.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {progress.current_stage === 'approved' && (
                              <button type="button" onClick={() => advanceAdminProgress(progress, 'payment')} className="admin-primary-button admin-primary-button-compact">Create Invoice / Mark Payment</button>
                            )}
                            {progress.current_stage === 'payment' && (
                              <button type="button" onClick={() => advanceAdminProgress(progress, 'goods_shipped')} className="admin-primary-button admin-primary-button-compact">Create Waybill / Mark Goods Shipped</button>
                            )}
                            {progress.current_stage === 'goods_received' && (
                              <button type="button" onClick={() => advanceAdminProgress(progress, 'order_completed')} className="admin-primary-button admin-primary-button-compact">Complete Order</button>
                            )}
                            {detailsHref ? (
                              <Link
                                href={detailsHref}
                                data-procurement-chain-id={chainId}
                                data-procurement-number={procurementNumber}
                                data-details-href={detailsHref}
                                className="inline-flex cursor-pointer items-center justify-center rounded-md bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700 hover:text-white"
                              >
                                View Progress Details
                              </Link>
                            ) : (
                              <span className="inline-flex cursor-not-allowed items-center justify-center rounded-md bg-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-600">
                                Chain id unavailable
                              </span>
                            )}
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
          title="Latest RFQs"
          action={<button type="button" onClick={() => setShowCreateRfq(true)} className="admin-primary-button admin-primary-button-compact">Add RFQ</button>}
        >
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-[1260px] table-fixed text-left text-sm">
              <colgroup>
                {[90,110,150,115,155,145,65,105,190,135].map((width,index)=><col key={index} style={{width}} />)}
              </colgroup>
              <thead className="bg-slate-900 text-white">
                <tr>
                  {['Action 1','Action 2'].map((heading)=><th key={heading} className={`${tableHeaderCellClass} bg-slate-900 text-center`}>{heading}</th>)}
                  {['Procurement No','Date','Buyer','Source BOM','Items','Current Stage','Progress'].map((heading)=><th key={heading} className={tableHeaderCellClass}>{heading}</th>)}
                  <th className={`${tableHeaderCellClass} bg-slate-900 text-center`}>Delete RFQ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rfqs.length === 0 ? (
                  <tr><td colSpan={10} className={emptyCellClass}>No RFQs yet.</td></tr>
                ) : (
                  rfqs.map((rfq) => {
                    const progress=progressRows.find(row=>row.procurement_chain_id&&row.procurement_chain_id===rfq.procurement_chain_id);const stage = progress?.current_stage?normalizeStage(progress.current_stage):getRfqStage(rfq);
                    return (
                      <tr key={rfq.rfq_id} onClick={() => {window.location.href=`/admin/rfqs/${rfq.rfq_id}`}} className="group cursor-pointer hover:bg-slate-50">
                        <td className="px-2 py-3 align-top"><Link href={`/admin/rfqs/${rfq.rfq_id}`} onClick={(event)=>event.stopPropagation()} aria-label="View RFQ" title="View RFQ" className="rfq-action-button mx-auto flex h-9 w-[76px] items-center justify-center px-2 text-xs">View</Link></td>
                        <td className="px-2 py-3 align-top"><button type="button" aria-label="Supplier Access" title="Supplier Access" onClick={(event)=>openAssignModal(event,rfq)} className="rfq-action-button mx-auto block h-9 w-[96px] px-2 text-xs">Suppliers</button></td>
                        <td className="px-3 py-3 align-top font-semibold text-blue-800">{rfq.procurement_number||rfq.order_number}</td>
                        <td className="whitespace-nowrap px-3 py-3 align-top">{formatDate(rfq.created_at)}</td>
                        <td className="px-3 py-3 align-top">{rfq.customer_company_name || '—'}</td>
                        <td className="px-3 py-3 align-top"><span className="block truncate" title={rfq.source_bom_file||undefined}>{rfq.source_bom_file||'—'}</span></td>
                        <td className="px-2 py-3 text-center align-top">{rfq.total_items_count ?? itemsByRfq.get(rfq.rfq_id)?.length ?? 0}</td>
                        <td className="px-3 py-3 align-top">{progress?.current_stage_label||stageMeta[stage].label}</td>
                        <td className="px-3 py-3 align-top">{progress?.status_note||progress?.current_stage_label||'—'}</td>
                        <td className="px-2 py-3 align-top"><span onClick={(event)=>event.stopPropagation()} className="rfq-delete-action mx-auto block w-[112px]"><DeleteRfqButton rfqId={rfq.rfq_id} compact onDeleted={()=>{setMessage('RFQ deleted successfully.');loadDashboard()}}/></span></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <InvoiceHubTable role="admin" title="Latest Invoices" />

        <div className="grid gap-6 xl:grid-cols-2">
          <SectionCard
            title="Latest Suppliers"
            action={<button type="button" onClick={() => setShowCreateSupplier(true)} className="admin-primary-button admin-primary-button-compact">Add Supplier</button>}
          >
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-blue-600 text-white">
                  <tr>{['Registered', 'Company', 'Country', 'Registration Email', 'Profile', 'Documents', 'Verification', 'Action'].map((heading) => <th key={heading} className={tableHeaderCellClass}>{heading}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {suppliers.length === 0 ? (
                    <tr><td colSpan={8} className={emptyCellClass}>No suppliers yet.</td></tr>
                  ) : suppliers.map((supplier) => (
                    <tr key={supplier.profile_id} className="hover:bg-blue-50">
                      <td className="px-4 py-3">{formatDate(supplier.created_at)}</td>
                      <td className="px-4 py-3 font-semibold">
                        <Link href={`/admin/suppliers/${supplier.canonical_supplier_id || supplier.profile_id}`} className="text-blue-700 hover:text-blue-800">
                          {supplier.company_name || 'Unnamed supplier'}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{supplier.country_name || '-'}</td>
                      <td className="px-4 py-3">{supplier.company_email || supplier.main_contact_email || '-'}</td>
                      <td className="px-4 py-3">{supplier.company_name&&supplier.country_name&&supplier.company_email?'Complete':'Incomplete'}</td>
                      <td className="px-4 py-3">{documents.filter((doc) => doc.profile_id === supplier.profile_id).length}</td>
                      <td className="px-4 py-3">{humanize(supplier.verification_status)}</td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/suppliers/${supplier.canonical_supplier_id || supplier.profile_id}`} className="font-semibold text-blue-700 hover:text-blue-800">Review / Edit</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard
            title="Latest Customers"
            action={<button type="button" onClick={() => setShowCreateCustomer(true)} className="admin-primary-button admin-primary-button-compact">Add Customer</button>}
          >
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-blue-600 text-white">
                  <tr>{['Company', 'Country', 'Contact', 'Recent RFQs', 'Status', 'Action'].map((heading) => <th key={heading} className={tableHeaderCellClass}>{heading}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {customers.length === 0 ? (
                    <tr><td colSpan={6} className={emptyCellClass}>No customers yet.</td></tr>
                  ) : customers.map((customer) => (
                      <tr key={customer.customer_profile_id} className="hover:bg-blue-50">
                        <td className="px-4 py-3 font-semibold">
                          <Link href={`/admin/customers/${customer.user_id}`} className="text-blue-700 hover:text-blue-800">
                            {customer.company_name || 'Unnamed customer'}
                          </Link>
                        </td>
                        <td className="px-4 py-3">{customer.country_name || '-'}</td>
                        <td className="px-4 py-3">{customer.contact_name || customer.contact_email || '-'}</td>
                        <td className="px-4 py-3">{rfqs.filter((rfq) => rfq.customer_id === customer.user_id).length}</td>
                        <td className="px-4 py-3">{humanize(customer.customer_status)}</td>
                        <td className="px-4 py-3">
                          <Link href={`/admin/customers/${customer.user_id}`} className="font-semibold text-blue-700 hover:text-blue-800">View</Link>
                        </td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          <SectionCard title="Pending Verification Queue">
            <p className="text-sm text-slate-600">Supplier registrations: {suppliers.filter((supplier) => supplier.verification_status === 'pending').length}</p>
            <p className="mt-2 text-sm text-slate-600">Company documents: {documents.filter((doc) => doc.document_status === 'uploaded' || doc.document_status === 'in_review').length}</p>
            <p className="mt-2 text-sm text-slate-600">Tax/company documents pending review: {documents.filter((doc) => doc.document_status === 'in_review').length}</p>
          </SectionCard>
          <SectionCard title="Request to vendors">
            {rfqs[0] || assignments[0] || quotes[0] ? (
              <div className="space-y-2 text-sm text-slate-600">
                {rfqs[0] && <p>New RFQ created: {rfqs[0].order_number}</p>}
                {assignments[0] && <p>Supplier assigned: {assignments[0].supplier_company_name || assignments[0].supplier_id}</p>}
                {quotes[0] && <p>Quote activity: {quotes[0].order_number}</p>}
              </div>
            ) : <p className="text-sm text-slate-600">No recent activity yet.</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/admin/octopart-requests" className="admin-primary-button">
                Octopart
              </Link>
              <Link href="/admin/external-vendors" className="admin-primary-button">
                External Vendors
              </Link>
            </div>
          </SectionCard>
          <SectionCard title="Quick Actions">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                { label: 'Main Table', href: '/admin/homepage-content' },
                { label: 'How It Works', href: '/admin/how-it-works' },
                { label: 'Categories', href: '/admin/categories' },
                { label: 'Supplier Inbox', href: '/admin/supplier-inbox' },
                { label: 'Discount Prices', href: '/admin/discount-prices' },
                { label: 'AI config', href: '/admin/ai-config' },
                { label: 'Octopart request', href: '/admin/octopart-requests' },
                { label: 'Verified Suppliers', href: '/admin/verified-suppliers' },
                { label: 'Industry Solutions', href: '/admin/industry-solutions' },
              ].map((action) => (
                <Link key={action.href} href={action.href} className="admin-primary-button admin-primary-button-compact text-center">
                  {action.label}
                </Link>
              ))}
              <button type="button" onClick={() => setShowAiConversations(true)} className="admin-primary-button admin-primary-button-compact text-center">
                AI meets
              </button>
            </div>
          </SectionCard>
          <SectionCard title="Alerts / Attention Needed">
            <p className="text-sm text-slate-600">Overdue RFQs: {rfqs.filter((rfq) => rfq.deadline_at && new Date(rfq.deadline_at).getTime() < Date.now()).length}</p>
            <p className="mt-2 text-sm text-slate-600">Pending supplier documents: {documents.filter((doc) => doc.document_status === 'uploaded').length}</p>
            <p className="mt-2 text-sm text-slate-600">Payment holds: 0</p>
          </SectionCard>
        </div>
      </div>

      {showCreateRfq && (
        <CreateRfqModal
          countries={countries}
          customerProfiles={customerProfiles}
          customerAccounts={customerAccounts}
          customerProfileLoadError={customerProfileLoadError}
          supabase={supabase}
          onClose={() => setShowCreateRfq(false)}
          onSaved={loadDashboard}
        />
      )}

      {showCreateSupplier && (
        <CreateSupplierModal
          countries={countries}
          supplierAccounts={supplierAccounts}
          existingSuppliers={suppliers}
          supabase={supabase}
          onClose={() => setShowCreateSupplier(false)}
          onSaved={loadDashboard}
        />
      )}

      {showCreateCustomer && (
        <CreateCustomerModal
          countries={countries}
          customerProfiles={customerProfiles}
          supabase={supabase}
          onClose={() => setShowCreateCustomer(false)}
          onSaved={loadDashboard}
        />
      )}

      {showAiConversations && (
        <AiConversationsModal
          supabase={supabase}
          onClose={() => setShowAiConversations(false)}
        />
      )}

      {selectedRfq && (
        <Modal title={`RFQ ${selectedRfq.order_number}`} onClose={() => setSelectedRfq(null)}>
          <div className="grid gap-5 lg:grid-cols-2">
            <SectionCard title="RFQ Summary">
              <p>Buyer: {selectedRfq.customer_company_name || '-'}</p>
              <p>Delivery country: {selectedRfq.delivery_country_name || '-'}</p>
              <p>Status: {humanize(selectedRfq.rfq_status)}</p>
              <p>Priority: {humanize(selectedRfq.priority_status)}</p>
              <p>Deadline: {formatDate(selectedRfq.deadline_at)}</p>
              <p>Buyer notes: {selectedRfq.buyer_notes || '-'}</p>
              <div className="mt-3"><StageProgress currentStage={getRfqStage(selectedRfq)} /></div>
            </SectionCard>
            <SectionCard title="Assigned Suppliers">
              {(assignmentsByRfq.get(selectedRfq.rfq_id) ?? []).length === 0 ? <p>No suppliers assigned.</p> : (assignmentsByRfq.get(selectedRfq.rfq_id) ?? []).map((assignment) => (
                <p key={assignment.assignment_id}>{assignment.supplier_company_name || assignment.supplier_id} - {humanize(assignment.assignment_status)}</p>
              ))}
            </SectionCard>
            <SectionCard title="Item List">
              {(itemsByRfq.get(selectedRfq.rfq_id) ?? []).map((item) => (
                <div key={`${item.rfq_id}-${item.line_number}`} className="border-b border-slate-200 py-2 text-sm">
                  <p className="font-semibold">{item.part_number || item.description || item.category_name || 'Item'}</p>
                  <p>{item.manufacturer || '-'} · Qty {item.requested_quantity ?? 0}</p>
                </div>
              ))}
            </SectionCard>
            <SectionCard title="Supplier Quotes">
              {(quotesByOrder.get(selectedRfq.order_number) ?? []).length === 0 ? <p>No quotes yet.</p> : (quotesByOrder.get(selectedRfq.order_number) ?? []).map((quote) => (
                <p key={quote.quote_id}>{quote.supplier_company_name || '-'} - {humanize(quote.quote_status)} - {formatMoney(quote.quote_total, quote.currency)}</p>
              ))}
            </SectionCard>
          </div>
        </Modal>
      )}

      {selectedSupplier && (
        <Modal title={selectedSupplier.company_name || 'Supplier Detail'} onClose={() => setSelectedSupplier(null)}>
          <div className="space-y-5">
            <DetailErrorList errors={supplierDetailErrors} />
            {supplierDetailLoading && <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">Loading supplier detail...</div>}
            <SectionCard title="Supplier Profile" tone="blue">
              <div className="grid gap-2 text-sm md:grid-cols-2">
                <p>Company: {selectedSupplier.company_name || '-'}</p>
                <p>Country: {selectedSupplier.country_name || '-'}</p>
                <p>Registration: {selectedSupplier.business_registration_number || '-'}</p>
                <p>Tax/VAT: {selectedSupplier.tax_vat_number || '-'}</p>
                <p>Main contact: {selectedSupplier.main_contact_name || '-'}</p>
                <p>Main contact email: {selectedSupplier.main_contact_email || '-'}</p>
                <p>Main contact phone: {selectedSupplier.company_phone || '-'}</p>
                <p>Categories: {selectedSupplier.product_categories_text || '-'}</p>
                <p>Verification: {humanize(selectedSupplier.verification_status)}</p>
                <p>Documents: {documents.filter((doc) => doc.profile_id === selectedSupplier.profile_id).length}</p>
              </div>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => updateSupplierStatus(selectedSupplier, 'approved')} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white">Approve Supplier</button>
                <button type="button" onClick={() => updateSupplierStatus(selectedSupplier, 'needs_update')} className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white">Mark Needs Update</button>
              </div>
            </SectionCard>
            <SectionCard title="Bank / Payout Details">
              <p>Bank: {selectedSupplier.bank_name || '-'}</p>
              <p>IBAN: {selectedSupplier.iban || '-'}</p>
            </SectionCard>
            <SectionCard title="Contacts">
              {contacts.filter((contact) => contact.profile_id === selectedSupplier.profile_id).map((contact) => (
                <p key={`${contact.profile_id}-${contact.contact_index}`}>{contact.contact_name || '-'} · {contact.contact_position || '-'} · {contact.contact_email || '-'}</p>
              ))}
            </SectionCard>
            <SectionCard title="Documents">
              {documents.filter((doc) => doc.profile_id === selectedSupplier.profile_id).map((doc) => (
                <p key={`${doc.profile_id}-${doc.file_name}`}>{doc.document_title || 'Document'} - {doc.file_name || '-'} - {humanize(doc.document_status)}</p>
              ))}
            </SectionCard>
            <SectionCard title="Assigned RFQs / RFQs in Work" tone="blue">
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-blue-600 text-white">
                    <tr>{['RFQ ID', 'Buyer', 'Category', 'Items', 'Quantity', 'Deadline', 'Assignment Status', 'RFQ Status', 'Action'].map((heading) => <th key={heading} className={tableHeaderCellClass}>{heading}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {supplierDetailAssignments.length === 0 ? (
                      <tr><td colSpan={9} className={emptyCellClass}>No RFQs assigned to this supplier yet.</td></tr>
                    ) : supplierDetailAssignments.map((assignment) => {
                      const rfq = supplierDetailRfqs.find((row) => row.rfq_id === assignment.rfq_id || row.order_number === assignment.order_number);
                      const rfqItems = supplierDetailItems.filter((item) => item.rfq_id === assignment.rfq_id);
                      return (
                        <tr key={assignment.assignment_id}>
                          <td className="px-4 py-3 font-semibold">{rfq?.order_number || assignment.order_number}</td>
                          <td className="px-4 py-3">{rfq?.customer_company_name || '-'}</td>
                          <td className="px-4 py-3">{rfq ? getCategoryFromItems(rfq.rfq_id, supplierDetailItems) : '-'}</td>
                          <td className="px-4 py-3">{rfq?.total_items_count ?? rfqItems.length}</td>
                          <td className="px-4 py-3">{rfq?.total_requested_quantity ?? rfqItems.reduce((sum, item) => sum + Number(item.requested_quantity ?? 0), 0)}</td>
                          <td className="px-4 py-3">{formatDate(rfq?.deadline_at)}</td>
                          <td className="px-4 py-3">{humanize(assignment.assignment_status)}</td>
                          <td className="px-4 py-3">{humanize(rfq?.rfq_status)}</td>
                          <td className="px-4 py-3">{rfq ? <button type="button" onClick={() => { setSelectedSupplier(null); setSelectedRfq(rfq); }} className="font-semibold text-blue-700 hover:text-blue-800">View RFQ</button> : '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
            <SectionCard title="Active Orders" tone="blue">
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-blue-600 text-white">
                    <tr>{['Order ID', 'Buyer', 'Total Value', 'Current Stage', 'Progress', 'Payment Status', 'Expected Delivery'].map((heading) => <th key={heading} className={tableHeaderCellClass}>{heading}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {supplierDetailOrders.length === 0 ? (
                      <tr><td colSpan={7} className={emptyCellClass}>No active orders for this supplier yet.</td></tr>
                    ) : supplierDetailOrders.map((order) => {
                      const stage = normalizeStage(order.current_stage);
                      return (
                        <tr key={order.order_number}>
                          <td className="px-4 py-3 font-semibold">{order.order_number}</td>
                          <td className="px-4 py-3">{order.customer_company_name || '-'}</td>
                          <td className="px-4 py-3">{formatMoney(order.order_total, order.currency)}</td>
                          <td className="px-4 py-3">{humanize(order.current_stage)}</td>
                          <td className="px-4 py-3"><StageProgress currentStage={stage} /></td>
                          <td className="px-4 py-3">{humanize(order.payment_status)}</td>
                          <td className="px-4 py-3">{formatDate(order.expected_delivery_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <StageLegend />
            </SectionCard>
          </div>
        </Modal>
      )}

      {selectedCustomer && (
        <Modal title={selectedCustomerProfile?.company_name || selectedCustomer.company_name || selectedCustomer.email || 'Customer Detail'} onClose={() => setSelectedCustomer(null)}>
          <div className="space-y-5">
            <DetailErrorList errors={customerDetailErrors} />
            {customerDetailLoading && <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">Loading customer detail...</div>}
            <SectionCard title="Customer Profile" tone="blue">
              <div className="grid gap-2 text-sm md:grid-cols-2">
                <p>Linked user email: {selectedCustomer.email || '-'}</p>
                <p>Company: {selectedCustomerProfile?.company_name || selectedCustomer.company_name || '-'}</p>
                <p>Registration: {selectedCustomerProfile?.business_registration_number || '-'}</p>
                <p>Country: {selectedCustomerProfile?.country_name || '-'}</p>
                <p>Contact: {selectedCustomerProfile?.contact_name || selectedCustomer.full_name || '-'}</p>
                <p>Contact email: {selectedCustomerProfile?.contact_email || selectedCustomer.email || '-'}</p>
                <p>Contact phone: {selectedCustomerProfile?.contact_phone || '-'}</p>
                <p>Website: {selectedCustomerProfile?.website || '-'}</p>
                <p>Status: {humanize(selectedCustomerProfile?.customer_status || selectedCustomer.role)}</p>
                <p>RFQ count: {customerDetailRfqs.length}</p>
              </div>
              <p className="mt-3 text-sm text-slate-700">Address: {selectedCustomerProfile?.company_address || '-'}</p>
              <p className="mt-1 text-sm text-slate-700">Notes: {selectedCustomerProfile?.customer_notes || '-'}</p>
            </SectionCard>
            <SectionCard title="Customer RFQs" tone="blue">
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-blue-600 text-white">
                    <tr>{['RFQ ID', 'Category', 'Items', 'Quantity', 'Delivery Country', 'Deadline', 'Assigned Suppliers', 'Status', 'Action'].map((heading) => <th key={heading} className={tableHeaderCellClass}>{heading}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {customerDetailRfqs.length === 0 ? (
                      <tr><td colSpan={9} className={emptyCellClass}>No RFQs submitted by this customer yet.</td></tr>
                    ) : customerDetailRfqs.map((rfq) => {
                      const rfqItems = customerDetailItems.filter((item) => item.rfq_id === rfq.rfq_id);
                      const assignmentCount = customerDetailAssignments.filter((assignment) => assignment.rfq_id === rfq.rfq_id).length;
                      return (
                        <tr key={rfq.rfq_id}>
                          <td className="px-4 py-3 font-semibold">{rfq.order_number}</td>
                          <td className="px-4 py-3">{getCategoryFromItems(rfq.rfq_id, customerDetailItems)}</td>
                          <td className="px-4 py-3">{rfq.total_items_count ?? rfqItems.length}</td>
                          <td className="px-4 py-3">{rfq.total_requested_quantity ?? rfqItems.reduce((sum, item) => sum + Number(item.requested_quantity ?? 0), 0)}</td>
                          <td className="px-4 py-3">{rfq.delivery_country_name || '-'}</td>
                          <td className="px-4 py-3">{formatDate(rfq.deadline_at)}</td>
                          <td className="px-4 py-3">{assignmentCount}</td>
                          <td className="px-4 py-3">{humanize(rfq.rfq_status)}</td>
                          <td className="px-4 py-3"><button type="button" onClick={() => { setSelectedCustomer(null); setSelectedRfq(rfq); }} className="font-semibold text-blue-700 hover:text-blue-800">View RFQ</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
            <SectionCard title="Active Orders" tone="blue">
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-blue-600 text-white">
                    <tr>{['Order ID', 'Supplier', 'Total Value', 'Current Stage', 'Progress', 'Payment Status', 'Expected Delivery'].map((heading) => <th key={heading} className={tableHeaderCellClass}>{heading}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {customerDetailOrders.length === 0 ? (
                      <tr><td colSpan={7} className={emptyCellClass}>No active orders for this customer yet.</td></tr>
                    ) : customerDetailOrders.map((order) => {
                      const stage = normalizeStage(order.current_stage);
                      return (
                        <tr key={order.order_number}>
                          <td className="px-4 py-3 font-semibold">{order.order_number}</td>
                          <td className="px-4 py-3">{order.supplier_company_name || '-'}</td>
                          <td className="px-4 py-3">{formatMoney(order.order_total, order.currency)}</td>
                          <td className="px-4 py-3">{humanize(order.current_stage)}</td>
                          <td className="px-4 py-3"><StageProgress currentStage={stage} /></td>
                          <td className="px-4 py-3">{humanize(order.payment_status)}</td>
                          <td className="px-4 py-3">{formatDate(order.expected_delivery_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <StageLegend />
            </SectionCard>
          </div>
        </Modal>
      )}

      {assigningRfq && (
        <Modal title="Assign RFQ to Supplier" onClose={() => setAssigningRfq(null)}>
          <div className="space-y-5">
            <SectionCard title="RFQ Summary">
              <p>RFQ: {assigningRfq.order_number}</p>
              <p>Buyer: {assigningRfq.customer_company_name || '-'}</p>
              <p>Delivery country: {assigningRfq.delivery_country_name || '-'}</p>
              <p>Status: {humanize(assigningRfq.rfq_status)}</p>
              <p>Items: {assigningRfq.total_items_count ?? itemsByRfq.get(assigningRfq.rfq_id)?.length ?? 0}</p>
              <p>Deadline: {formatDate(assigningRfq.deadline_at)}</p>
            </SectionCard>
            <SectionCard title="Supplier Access"><label className="block rounded-xl border border-blue-200 bg-blue-50 p-4"><input type="checkbox" checked={allowAllSuppliers} onChange={e=>setAllowAllSuppliers(e.target.checked)} className="mr-2"/><span className="font-bold">Allow all eligible suppliers to submit offers</span><p className="mt-1 text-sm text-slate-600">This RFQ is available to all active and verified suppliers by default. Uncheck only to restrict it.</p></label>
              {!allowAllSuppliers&&<div className="mt-4 grid gap-3 md:grid-cols-2">
                {suppliers.map((supplier) => {
                  const alreadyAssigned = (assignmentsByRfq.get(assigningRfq.rfq_id) ?? []).some((assignment) => assignment.supplier_id === supplier.user_id);
                  return (
                    <label key={supplier.profile_id} className={`rounded-xl border p-4 ${alreadyAssigned ? 'border-slate-200 bg-slate-100 text-slate-400' : 'border-slate-200 bg-white'}`}>
                      <input
                        type="checkbox"
                        disabled={alreadyAssigned}
                        checked={selectedSupplierIds.includes(supplier.user_id)}
                        onChange={(event) => {
                          setSelectedSupplierIds((current) => event.target.checked ? [...current, supplier.user_id] : current.filter((id) => id !== supplier.user_id));
                        }}
                        className="mr-2"
                      />
                      <span className="font-semibold">{supplier.company_name || 'Unnamed supplier'}</span>
                      <p className="mt-1 text-xs">{supplier.country_name || '-'} · {humanize(supplier.verification_status)}</p>
                      <p className="mt-1 text-xs">{supplier.product_categories_text || '-'}</p>
                      <p className="mt-1 text-xs">{supplier.main_contact_email || '-'}</p>
                      {alreadyAssigned && <p className="mt-1 text-xs font-semibold">Already assigned</p>}
                    </label>
                  );
                })}
              </div>}
              <label className="mt-4 block">
                <span className="text-sm font-semibold text-slate-700">Admin notes</span>
                <textarea value={adminNotes} onChange={(event) => setAdminNotes(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <HubButton onClick={assignSelectedSuppliers} disabled={!allowAllSuppliers&&selectedSupplierIds.length === 0} loading={savingAssignment} loadingText="Saving..." className="mt-4">Save Supplier Access</HubButton>
            </SectionCard>
          </div>
        </Modal>
      )}
    </main>
  );
}
