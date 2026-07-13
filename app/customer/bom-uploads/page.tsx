'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type UploadRow = {
  id: string;
  upload_number: number | null;
  document_name: string | null;
  original_file_name: string | null;
  created_at: string | null;
  total_rows: number | null;
  valid_rows: number | null;
  warning_rows: number | null;
  error_rows: number | null;
  ai_processing_status: string | null;
  status: string | null;
};

const formatDate = (value: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
};
const humanize = (value: string | null | undefined) => value ? value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) : '-';
const statusBadgeClass = (value: string | null | undefined) => {
  const normalized = (value ?? '').toLowerCase();
  if (normalized.includes('error') || normalized.includes('failed')) return 'bg-red-100 text-red-700';
  if (normalized.includes('warning')) return 'bg-amber-100 text-amber-700';
  if (normalized.includes('complete') || normalized.includes('ready') || normalized.includes('normalized')) return 'bg-emerald-100 text-emerald-700';
  return 'bg-blue-100 text-blue-700';
};
const blueButtonClass = 'rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 hover:text-white active:bg-blue-900';
const smallBlueButtonClass = 'rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-800 hover:text-white active:bg-blue-900';

export default function CustomerBomUploadsPage() {
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const loadUploads = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/customer/bom/uploads');
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to load BOM uploads.');
        if (active) setUploads((result.uploads ?? []) as UploadRow[]);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load BOM uploads.');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadUploads();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 text-white lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">Electron Market Customer</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">Uploaded BOM Lists</h1>
            <p className="mt-2 text-sm leading-6 text-blue-100">Review uploaded BOM documents and normalized item rows.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/customer/dashboard" className={blueButtonClass}>Back to Customer HUB</Link>
            <Link href="/customer/bom/upload" className={blueButtonClass}>Upload New BOM</Link>
          </div>
        </div>

        <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-2xl">
          {loading && <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">Loading BOM lists...</div>}
          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {!loading && !error && uploads.length === 0 && <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">No BOM lists uploaded yet.</div>}
          {uploads.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-blue-600 text-white">
                  <tr>
                    {['Upload No', 'Document Name', 'File Name', 'Uploaded Date', 'Total Rows', 'Valid', 'Warnings', 'Errors', 'AI Status', 'Status', 'Action'].map((heading) => (
                      <th key={heading} className="px-4 py-3 text-xs font-bold uppercase tracking-wide">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                  {uploads.map((upload) => (
                    <tr key={upload.id} className="hover:bg-blue-50">
                      <td className="px-4 py-3 font-semibold text-slate-950">#{upload.upload_number ?? '-'}</td>
                      <td className="px-4 py-3 font-semibold text-slate-950">{upload.document_name || '-'}</td>
                      <td className="px-4 py-3">{upload.original_file_name || '-'}</td>
                      <td className="px-4 py-3">{formatDate(upload.created_at)}</td>
                      <td className="px-4 py-3">{upload.total_rows ?? 0}</td>
                      <td className="px-4 py-3">{upload.valid_rows ?? 0}</td>
                      <td className="px-4 py-3">{upload.warning_rows ?? 0}</td>
                      <td className="px-4 py-3">{upload.error_rows ?? 0}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(upload.ai_processing_status)}`}>{humanize(upload.ai_processing_status)}</span></td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(upload.status)}`}>{humanize(upload.status)}</span></td>
                      <td className="px-4 py-3">
                        <Link href={`/customer/bom-uploads/${upload.id}`} className={smallBlueButtonClass}>View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
