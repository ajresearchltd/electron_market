'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '../../../../lib/supabase/client';

type UploadRow = {
  id: string;
  upload_number: number | null;
  document_name: string | null;
  original_file_name: string | null;
  supplier_company_name: string | null;
  contact_person: string | null;
  contact_email: string | null;
  created_at: string | null;
  total_rows: number | null;
  valid_rows: number | null;
  error_rows: number | null;
  status: string | null;
  ai_processing_status: string | null;
  default_lead_time: string | null;
  additional_notes: string | null;
};

type ItemRow = {
  id: string;
  row_number: number | null;
  part_number: string | null;
  product_name: string | null;
  available_quantity: number | null;
  unit_price: number | null;
  currency: string | null;
  validation_status: string | null;
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
  if (normalized.includes('valid') || normalized.includes('complete') || normalized.includes('processed')) return 'bg-emerald-100 text-emerald-700';
  return 'bg-blue-100 text-blue-700';
};

export default function SupplierProductAvailabilityUploadPage() {
  const params = useParams<{ uploadId: string }>();
  const uploadId = params.uploadId;
  const supabase = useMemo(() => createClient(), []);
  const [upload, setUpload] = useState<UploadRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const resolveSupplierId = async (userId: string, email?: string) => {
      const { data: profile } = await supabase
        .from('supplier_company_profiles')
        .select('company_name, company_email')
        .eq('user_id', userId)
        .maybeSingle();
      const supplierEmail = profile?.company_email || email || '';
      if (supplierEmail) {
        const { data: byContact } = await supabase.from('suppliers').select('supplier_id').eq('contact_email', supplierEmail).maybeSingle();
        if (byContact?.supplier_id) return byContact.supplier_id as string;
        const { data: byEmail } = await supabase.from('suppliers').select('supplier_id').eq('email', supplierEmail).maybeSingle();
        if (byEmail?.supplier_id) return byEmail.supplier_id as string;
      }
      if (profile?.company_name) {
        const { data: byCompany } = await supabase.from('suppliers').select('supplier_id').eq('company_name', profile.company_name).maybeSingle();
        if (byCompany?.supplier_id) return byCompany.supplier_id as string;
      }
      return '';
    };

    const loadUpload = async () => {
      setLoading(true);
      setError('');
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !authData.user) {
        setError('Upload not found or access denied.');
        setLoading(false);
        return;
      }

      const supplierId = await resolveSupplierId(authData.user.id, authData.user.email);
      if (!active) return;
      if (!supplierId) {
        setError('Upload not found or access denied.');
        setLoading(false);
        return;
      }

      const { data: uploadData, error: uploadError } = await supabase
        .from('supplier_stock_uploads')
        .select('id, upload_number, document_name, original_file_name, supplier_company_name, contact_person, contact_email, created_at, total_rows, valid_rows, error_rows, status, ai_processing_status, default_lead_time, additional_notes')
        .eq('id', uploadId)
        .eq('supplier_id', supplierId)
        .maybeSingle();
      if (!active) return;
      if (uploadError || !uploadData) {
        setError('Upload not found or access denied.');
        setLoading(false);
        return;
      }

      const { data: itemData, error: itemError } = await supabase
        .from('supplier_stock_upload_items')
        .select('id, row_number, part_number, product_name, available_quantity, unit_price, currency, validation_status')
        .eq('upload_id', uploadId)
        .order('row_number', { ascending: true });
      if (!active) return;
      if (itemError) setError(itemError.message);
      setUpload(uploadData as UploadRow);
      setItems((itemData ?? []) as ItemRow[]);
      setLoading(false);
    };

    loadUpload();
    return () => {
      active = false;
    };
  }, [supabase, uploadId]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 text-white lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">Electron Market Supplier</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">Product Availability Upload</h1>
            <p className="mt-2 text-sm leading-6 text-blue-100">Uploaded product list details and processed items.</p>
          </div>
          <Link href="/supplier/dashboard" className="site-button rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Back to Supply Hub</Link>
        </div>

        <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-2xl">
          {loading && <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">Loading upload...</div>}
          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {!loading && upload && (
            <>
              <div className="grid gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-5 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ['Upload Number', `#${upload.upload_number ?? '-'}`],
                  ['Document Name', upload.document_name || '-'],
                  ['Original File', upload.original_file_name || '-'],
                  ['Supplier Company', upload.supplier_company_name || '-'],
                  ['Contact Person', upload.contact_person || '-'],
                  ['Contact Email', upload.contact_email || '-'],
                  ['Created At', formatDate(upload.created_at)],
                  ['Total Rows', upload.total_rows ?? 0],
                  ['Valid Rows', upload.valid_rows ?? 0],
                  ['Error Rows', upload.error_rows ?? 0],
                  ['Status', humanize(upload.status)],
                  ['AI Status', humanize(upload.ai_processing_status)],
                  ['Default Lead Time', upload.default_lead_time || '-'],
                  ['Additional Notes', upload.additional_notes || '-'],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{String(value)}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-blue-600 text-white">
                    <tr>
                      {['Row', 'Part Number', 'Product Name', 'Quantity', 'Price', 'Status', 'Action'].map((heading) => (
                        <th key={heading} className="px-4 py-3 text-xs font-bold uppercase tracking-wide">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                    {items.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-600">No processed items found.</td></tr>
                    ) : (
                      items.map((item) => (
                        <tr
                          key={item.id}
                          className="cursor-pointer hover:bg-blue-50"
                          onClick={() => { window.location.href = `/supplier/product-availability/${uploadId}/items/${item.id}`; }}
                        >
                          <td className="px-4 py-3">{item.row_number ?? '-'}</td>
                          <td className="px-4 py-3 font-semibold text-slate-950">{item.part_number || '-'}</td>
                          <td className="px-4 py-3">{item.product_name || '-'}</td>
                          <td className="px-4 py-3">{item.available_quantity ?? '-'}</td>
                          <td className="px-4 py-3">{item.unit_price !== null && item.unit_price !== undefined ? `${item.unit_price} ${item.currency || ''}`.trim() : '-'}</td>
                          <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(item.validation_status)}`}>{humanize(item.validation_status)}</span></td>
                          <td className="px-4 py-3">
                            <Link href={`/supplier/product-availability/${uploadId}/items/${item.id}`} className="font-semibold text-blue-700 hover:text-blue-800">View Details</Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
