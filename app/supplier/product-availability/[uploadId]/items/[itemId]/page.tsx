'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '../../../../../../lib/supabase/client';

type ItemRow = {
  id: string;
  row_number: number | null;
  part_number: string | null;
  manufacturer: string | null;
  supplier_sku: string | null;
  product_name: string | null;
  description: string | null;
  package_case: string | null;
  condition: string | null;
  available_quantity: number | null;
  moq: number | null;
  unit: string | null;
  unit_price: number | null;
  currency: string | null;
  lead_time: string | null;
  country_of_origin: string | null;
  datasheet_url: string | null;
  product_video_url: string | null;
  product_video_description: string | null;
  warranty: string | null;
  notes: string | null;
  validation_status: string | null;
  validation_errors: string[] | null;
  raw_row_json: Record<string, unknown> | null;
};

const humanize = (value: string | null | undefined) => value ? value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) : '-';
const displayValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};
const statusBadgeClass = (value: string | null | undefined) => {
  const normalized = (value ?? '').toLowerCase();
  if (normalized.includes('error') || normalized.includes('failed')) return 'bg-red-100 text-red-700';
  if (normalized.includes('warning')) return 'bg-amber-100 text-amber-700';
  if (normalized.includes('valid') || normalized.includes('complete') || normalized.includes('processed')) return 'bg-emerald-100 text-emerald-700';
  return 'bg-blue-100 text-blue-700';
};

export default function SupplierProductAvailabilityItemPage() {
  const params = useParams<{ uploadId: string; itemId: string }>();
  const { uploadId, itemId } = params;
  const supabase = useMemo(() => createClient(), []);
  const [item, setItem] = useState<ItemRow | null>(null);
  const [sourceColumns, setSourceColumns] = useState<Record<string, string | null>>({});
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

    const loadItem = async () => {
      setLoading(true);
      setError('');
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !authData.user) {
        setError('Upload item not found or access denied.');
        setLoading(false);
        return;
      }

      const supplierId = await resolveSupplierId(authData.user.id, authData.user.email);
      if (!active) return;
      if (!supplierId) {
        setError('Upload item not found or access denied.');
        setLoading(false);
        return;
      }

      const { data: uploadData, error: uploadError } = await supabase
        .from('supplier_stock_uploads')
        .select('id, main_column_mapping, secondary_column_mapping')
        .eq('id', uploadId)
        .eq('supplier_id', supplierId)
        .maybeSingle();
      if (!active) return;
      if (uploadError || !uploadData) {
        setError('Upload item not found or access denied.');
        setLoading(false);
        return;
      }
      setSourceColumns({
        ...((uploadData.main_column_mapping as Record<string, string | null> | null) ?? {}),
        ...((uploadData.secondary_column_mapping as Record<string, string | null> | null) ?? {}),
      });

      const { data: itemData, error: itemError } = await supabase
        .from('supplier_stock_upload_items')
        .select('id, row_number, part_number, manufacturer, supplier_sku, product_name, description, package_case, condition, available_quantity, moq, unit, unit_price, currency, lead_time, country_of_origin, datasheet_url, product_video_url, product_video_description, warranty, notes, validation_status, validation_errors, raw_row_json')
        .eq('id', itemId)
        .eq('upload_id', uploadId)
        .maybeSingle();
      if (!active) return;
      if (itemError || !itemData) {
        setError('Upload item not found or access denied.');
      } else {
        setItem(itemData as ItemRow);
      }
      setLoading(false);
    };

    loadItem();
    return () => {
      active = false;
    };
  }, [supabase, uploadId, itemId]);

  const normalizedFields = item
    ? [
        ['Row Number', item.row_number],
        ['Part Number', item.part_number],
        ['Product Name', item.product_name],
        ['Manufacturer', item.manufacturer],
        ['Supplier SKU', item.supplier_sku],
        ['Quantity', item.available_quantity],
        ['MOQ', item.moq],
        ['Unit Price', item.unit_price !== null && item.unit_price !== undefined ? `${item.unit_price} ${item.currency || ''}`.trim() : null],
        ['Currency', item.currency],
        ['Condition', item.condition],
        ['Package / Case', item.package_case],
        ['Lead Time', item.lead_time],
        ['Country of Origin', item.country_of_origin],
        ['Datasheet URL', item.datasheet_url],
        ['Product Video URL', item.product_video_url],
        ['Product Video Description', item.product_video_description],
        ['Warranty', item.warranty],
        ['Notes', item.notes],
        ['Validation Status', humanize(item.validation_status)],
        ['Validation Errors', item.validation_errors?.join(', ')],
      ]
    : [];
  const rawEntries = item?.raw_row_json ? Object.entries(item.raw_row_json) : [];

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 text-white lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">Electron Market Supplier</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">Uploaded Product Details</h1>
            <p className="mt-2 text-sm leading-6 text-blue-100">Normalized fields and original Excel row data.</p>
          </div>
          <Link href={`/supplier/product-availability/${uploadId}`} className="site-button rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Back to Upload List</Link>
        </div>

        <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-2xl">
          {loading && <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">Loading product row...</div>}
          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {!loading && item && (
            <>
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-bold text-blue-900">Main Extracted Information</h2>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(item.validation_status)}`}>{humanize(item.validation_status)}</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {normalizedFields.map(([label, value]) => (
                    <div key={String(label)} className="rounded-xl bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                      <p className="mt-2 break-words text-sm font-semibold text-slate-900">{displayValue(value)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <h2 className="text-xl font-bold text-blue-900">Source Columns</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {[
                    ['Part Number', sourceColumns.part_number],
                    ['Product Name', sourceColumns.product_name],
                    ['Quantity', sourceColumns.available_quantity],
                    ['Price', sourceColumns.unit_price],
                    ['Currency', sourceColumns.currency],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-xl bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                      <p className="mt-2 break-words text-sm font-semibold text-slate-900">{displayValue(value)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 p-5">
                  <h2 className="text-xl font-bold text-blue-900">Original Excel Row Data</h2>
                </div>
                {rawEntries.length === 0 ? (
                  <div className="p-5 text-sm text-slate-600">No additional original row data saved.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-blue-600 text-white">
                        <tr>
                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">Column Name</th>
                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">Original Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rawEntries.map(([key, value]) => (
                          <tr key={key}>
                            <td className="px-4 py-3 font-semibold text-slate-900">{key}</td>
                            <td className="px-4 py-3 text-slate-700">{displayValue(value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
