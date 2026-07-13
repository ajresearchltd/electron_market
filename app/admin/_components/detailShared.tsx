'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { adminButtonClassName } from '../../components/admin/adminButtonStyles';
import { createClient } from '../../../lib/supabase/client';

export type GenericRow = Record<string, unknown>;

const technicalFieldNames = new Set([
  'id',
  'uuid',
  'profile_id',
  'supplier_profile_id',
  'customer_profile_id',
  'user_id',
  'supplier_id',
  'customer_id',
  'auth_user_id',
  'created_by',
  'updated_by',
  'internal_id',
  'assignment_id',
  'document_id',
  'contact_id',
]);

const isTechnicalField = (key: string) => {
  const normalized = key.toLowerCase();
  return technicalFieldNames.has(normalized) || normalized.endsWith('_id');
};

export const formatValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(date);
    }
    return value;
  }
  return JSON.stringify(value);
};

export const humanize = (value: unknown) => formatValue(value).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

export const formatMoney = (amount: unknown, currency: unknown) => {
  const numeric = Number(amount ?? 0);
  if (!numeric) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: String(currency || 'USD') }).format(numeric);
};

export function AdminShell({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-slate-950">{children}</main>;
}

export function AdminHeader({
  eyebrow,
  title,
  subtitle,
  status,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  status?: string | null;
  action?: ReactNode;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    let active = true;

    const loadUserEmail = async () => {
      const { data } = await supabase.auth.getUser();
      if (active) setUserEmail(data.user?.email || '');
    };

    loadUserEmail();

    return () => {
      active = false;
    };
  }, [supabase]);

  return (
    <section className="bg-[#07152f] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-200">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-bold">{title}</h1>
          {subtitle && <p className="mt-2 text-blue-100">{subtitle}</p>}
          {status && <p className="mt-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white">{humanize(status)}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-start gap-3 md:justify-end">
          {userEmail && (
            <p className="max-w-[220px] truncate text-sm font-medium text-white" title={userEmail}>
              {userEmail}
            </p>
          )}
          {action ?? (
            <Link href="/admin" className={adminButtonClassName('md', 'h-10')}>
              Back to Admin
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

export function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-blue-100 bg-blue-50 p-5 shadow-sm">
      <h2 className="text-lg font-bold text-blue-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ErrorList({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {errors.map((error) => <p key={error}>{error}</p>)}
    </div>
  );
}

export function KeyValueGrid({ row }: { row: GenericRow | null }) {
  if (!row) return <p className="text-sm text-slate-500">No profile record found.</p>;
  const visibleEntries = Object.entries(row).filter(([key]) => !isTechnicalField(key));

  return (
    <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {visibleEntries.map(([key, value]) => (
        <div key={key} className="rounded-lg border border-blue-100 bg-white p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{key}</dt>
          <dd className="mt-1 break-words text-sm font-medium text-slate-900">{formatValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SimpleTable({
  columns,
  rows,
  emptyText,
}: {
  columns: Array<{ key: string; label: string; render?: (row: GenericRow) => React.ReactNode }>;
  rows: GenericRow[];
  emptyText: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-blue-600 text-white">
          <tr>{columns.map((column) => <th key={column.key} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">{column.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-slate-500">{emptyText}</td></tr>
          ) : rows.map((row, index) => (
            <tr key={String(row.id ?? row.profile_id ?? row.rfq_id ?? row.order_number ?? row.document_id ?? index)}>
              {columns.map((column) => (
                <td key={column.key} className="px-4 py-3 text-slate-700">
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

export function FileLink({ row }: { row: GenericRow }) {
  const bucket = String(row.storage_bucket || '');
  const path = String(row.signed_url || row.storage_path || row.file_url || row.bom_file_url || '');
  const href = path.startsWith('http://') || path.startsWith('https://') ? path : '';
  const label = String(row.file_name || row.bom_file_name || row.document_title || 'Open file');
  const mimeType = String(row.file_mime_type || row.bom_file_type || '');
  const actionText = mimeType === 'application/pdf' || label.toLowerCase().endsWith('.pdf') ? 'Open PDF' : 'Open file';

  if (href) {
    return (
      <div className="flex flex-col items-start gap-1">
        <a href={href} target="_blank" rel="noreferrer" className={adminButtonClassName('sm')}>
          {actionText}
        </a>
        <span className="max-w-48 truncate text-xs text-slate-500">{label}</span>
      </div>
    );
  }

  if (bucket && path) return <span className="text-xs text-slate-500">Private storage file: {label}</span>;
  return <span className="text-slate-500">No public file URL</span>;
}
