'use client';

import Link from 'next/link';
import HubButton from '../../../../../components/ui/HubButton';
import { useParams } from 'next/navigation';
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';

type ItemRow = Record<string, any>;
type UploadRow = Record<string, any>;
type FormState = {
  line_number: string;
  part_number: string;
  normalized_part_number: string;
  manufacturer: string;
  manufacturer_part_number: string;
  product_name: string;
  description: string;
  specification: string;
  package_case: string;
  quantity: string;
  unit: string;
  target_unit_price: string;
  target_currency: string;
  acceptable_alternatives: string;
  allow_substitute: boolean;
  authorized_suppliers_only: boolean;
  preferred_origin_country: string;
  date_code_requirement: string;
  rohs_required: boolean;
  reach_required: boolean;
  datasheet_url: string;
  notes: string;
  customer_comment: string;
};

const emptyForm: FormState = {
  line_number: '',
  part_number: '',
  normalized_part_number: '',
  manufacturer: '',
  manufacturer_part_number: '',
  product_name: '',
  description: '',
  specification: '',
  package_case: '',
  quantity: '',
  unit: 'pcs',
  target_unit_price: '',
  target_currency: 'USD',
  acceptable_alternatives: '',
  allow_substitute: false,
  authorized_suppliers_only: false,
  preferred_origin_country: '',
  date_code_requirement: '',
  rohs_required: false,
  reach_required: false,
  datasheet_url: '',
  notes: '',
  customer_comment: '',
};

const blueButtonClass = 'rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 hover:text-white active:bg-blue-900 disabled:cursor-not-allowed disabled:bg-blue-300';
const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const labelClass = 'text-sm font-semibold text-slate-700';

const humanize = (value: string | null | undefined) => value ? value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) : '-';
const displayValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};
const isHttpUrl = (value: unknown) => /^https?:\/\/\S+$/i.test(String(value ?? '').trim());
const statusBadgeClass = (value: string | null | undefined) => {
  const normalized = (value ?? '').toLowerCase();
  if (normalized.includes('error') || normalized.includes('failed')) return 'bg-red-100 text-red-700';
  if (normalized.includes('warning')) return 'bg-amber-100 text-amber-700';
  if (normalized.includes('valid') || normalized.includes('complete')) return 'bg-emerald-100 text-emerald-700';
  return 'bg-blue-100 text-blue-700';
};
const partNumberCheckMeta = (status: string | null | undefined) => {
  if (['found_internal', 'found_octopart_exact', 'found_exact'].includes(String(status))) return { label: 'Found', dot: 'bg-green-500', text: 'text-green-700' };
  if (['found_octopart_possible', 'manufacturer_mismatch', 'ambiguous', 'needs_review', 'suspicious_format'].includes(String(status))) return { label: 'Review', dot: 'bg-yellow-400', text: 'text-yellow-700' };
  if (['not_found', 'invalid_format', 'error'].includes(String(status))) return { label: 'Not found', dot: 'bg-red-500', text: 'text-red-700' };
  return { label: 'Not checked', dot: 'bg-gray-300', text: 'text-slate-600' };
};
const toFormState = (item: ItemRow | null): FormState => ({
  line_number: String(item?.line_number ?? ''),
  part_number: String(item?.part_number ?? ''),
  normalized_part_number: String(item?.normalized_part_number ?? ''),
  manufacturer: String(item?.manufacturer ?? ''),
  manufacturer_part_number: String(item?.manufacturer_part_number ?? ''),
  product_name: String(item?.product_name ?? ''),
  description: String(item?.description ?? ''),
  specification: String(item?.specification ?? ''),
  package_case: String(item?.package_case ?? ''),
  quantity: item?.quantity === null || item?.quantity === undefined ? '' : String(item.quantity),
  unit: String(item?.unit ?? 'pcs'),
  target_unit_price: item?.target_unit_price === null || item?.target_unit_price === undefined ? '' : String(item.target_unit_price),
  target_currency: String(item?.target_currency ?? 'USD'),
  acceptable_alternatives: String(item?.acceptable_alternatives ?? ''),
  allow_substitute: Boolean(item?.allow_substitute),
  authorized_suppliers_only: Boolean(item?.authorized_suppliers_only),
  preferred_origin_country: String(item?.preferred_origin_country ?? ''),
  date_code_requirement: String(item?.date_code_requirement ?? ''),
  rohs_required: Boolean(item?.rohs_required),
  reach_required: Boolean(item?.reach_required),
  datasheet_url: String(item?.datasheet_url ?? ''),
  notes: String(item?.notes ?? ''),
  customer_comment: String(item?.customer_comment ?? ''),
});

function FieldCard({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0 rounded-xl bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-slate-900">{displayValue(value)}</p>
    </div>
  );
}

function DatasheetVerificationCard({ value }: { value: unknown }) {
  const url = String(value ?? '').trim();
  return (
    <div className="min-w-0 rounded-xl bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Datasheet URL</p>
      {!url ? (
        <p className="mt-2 text-sm font-semibold text-slate-900">-</p>
      ) : isHttpUrl(url) ? (
        <div className="mt-2 flex flex-col items-start gap-2">
          <a href={url} target="_blank" rel="noopener noreferrer" className={blueButtonClass}>
            Open Datasheet
          </a>
          <p className="text-xs font-medium text-slate-500">Datasheet source link available.</p>
        </div>
      ) : (
        <p className="mt-2 text-sm font-semibold text-red-700">Invalid datasheet URL</p>
      )}
    </div>
  );
}

export default function CustomerBomItemDetailPage() {
  const params = useParams<{ uploadId: string; itemId: string }>();
  const { uploadId, itemId } = params;
  const [item, setItem] = useState<ItemRow | null>(null);
  const [upload, setUpload] = useState<UploadRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifyingPartNumber, setVerifyingPartNumber] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadItem = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/customer/bom/items/${itemId}?uploadId=${encodeURIComponent(uploadId)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load BOM item.');
      setItem(result.item as ItemRow);
      setUpload(result.upload as UploadRow);
      setForm(toFormState(result.item as ItemRow));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load BOM item.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadId, itemId]);

  const updateText = (field: keyof FormState, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const updateCheckbox = (field: keyof FormState, event: ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, [field]: event.target.checked }));
  const cancelEdit = () => {
    setForm(toFormState(item));
    setEditing(false);
    setSuccess('');
    setError('');
  };
  const saveItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/customer/bom/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save BOM item.');
      setItem(result.item as ItemRow);
      setForm(toFormState(result.item as ItemRow));
      setEditing(false);
      setVerificationMessage('');
      setSuccess('BOM item saved successfully.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save BOM item.');
    } finally {
      setSaving(false);
    }
  };

  const verifyPartNumber = async () => {
    setVerifyingPartNumber(true);
    setVerificationMessage('');
    setSuccess('');
    setError('');
    try {
      const response = await fetch(`/api/customer/bom/items/${itemId}/verify-part-number`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Part number verification failed.');
      setItem(result.item as ItemRow);
      setForm(toFormState(result.item as ItemRow));
      setVerificationMessage(result.verification?.message || 'Part number verification completed.');
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Part number verification failed.');
    } finally {
      setVerifyingPartNumber(false);
    }
  };

  const normalizedFields = item
    ? [
        ['Row Number', item.row_number],
        ['Line Number', item.line_number],
        ['Part Number', item.part_number],
        ['Normalized Part Number', item.normalized_part_number],
        ['Manufacturer', item.manufacturer],
        ['Manufacturer Part Number', item.manufacturer_part_number],
        ['Product Name', item.product_name],
        ['Description', item.description],
        ['Specification', item.specification],
        ['Package / Case', item.package_case],
        ['Quantity', item.quantity],
        ['Unit', item.unit],
        ['Target Unit Price', item.target_unit_price],
        ['Target Currency', item.target_currency],
        ['Acceptable Alternatives', item.acceptable_alternatives],
        ['Allow Substitute', item.allow_substitute],
        ['Authorized Suppliers Only', item.authorized_suppliers_only],
        ['Preferred Origin Country', item.preferred_origin_country],
        ['Date Code Requirement', item.date_code_requirement],
        ['RoHS Required', item.rohs_required],
        ['REACH Required', item.reach_required],
        ['Datasheet URL', item.datasheet_url],
        ['Notes', item.notes],
        ['Customer Comment', item.customer_comment],
      ]
    : [];
  const rawEntries = item?.raw_row_json ? Object.entries(item.raw_row_json) : [];

  return (
    <main className="min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 text-white lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">Electron Market Customer</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">BOM Item Detail</h1>
            <p className="mt-2 text-sm leading-6 text-blue-100">Review and correct normalized BOM item fields.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={`/customer/bom-uploads/${uploadId}`} className={blueButtonClass}>Back</Link>
            {!editing && item && <button type="button" onClick={() => setEditing(true)} className={blueButtonClass}>Edit</button>}
            {editing && <HubButton type="submit" form="bom-item-edit-form" loading={saving} loadingText="Saving...">Save</HubButton>}
            {editing && <button type="button" onClick={cancelEdit} className={blueButtonClass}>Cancel</button>}
          </div>
        </div>

        <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-2xl">
          {loading && <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">Loading BOM item...</div>}
          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{success}</div>}
          {!loading && item && (
            <>
              <div className="grid gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-5 md:grid-cols-2 xl:grid-cols-4">
                <FieldCard label="Upload No" value={`#${upload?.upload_number ?? '-'}`} />
                <FieldCard label="Document Name" value={upload?.document_name} />
                <FieldCard label="Row Number" value={item.row_number} />
                <div className="min-w-0 rounded-xl bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current Status</p>
                  <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(item.validation_status)}`}>{humanize(item.validation_status)}</span>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-blue-900">Part Number Verification</h2>
                    <p className="mt-1 text-sm text-slate-600">Manual check against internal stock/catalog data and Nexar / Octopart.</p>
                  </div>
                  <HubButton onClick={verifyPartNumber} loading={verifyingPartNumber} loadingText="Verifying...">Verify Part Number</HubButton>
                </div>
                {verificationMessage && <div className="mt-4 rounded-xl border border-blue-100 bg-white p-4 text-sm font-semibold text-blue-800">{verificationMessage}</div>}
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="min-w-0 rounded-xl bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Part Number Check</p>
                    {(() => {
                      const meta = partNumberCheckMeta(item.part_number_check_status);
                      return (
                        <span className={`mt-2 inline-flex items-center gap-2 text-sm font-bold ${meta.text}`} title={item.part_number_check_message || meta.label}>
                          <span className={`h-3 w-3 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </span>
                      );
                    })()}
                  </div>
                  <FieldCard label="Message" value={item.part_number_check_message} />
                  <FieldCard label="Source" value={item.part_number_check_source} />
                  <FieldCard label="Confidence" value={item.part_number_check_confidence} />
                  <FieldCard label="Matched MPN" value={item.part_number_matched_mpn} />
                  <FieldCard label="Matched Manufacturer" value={item.part_number_matched_manufacturer} />
                  <FieldCard label="Matched Description" value={item.part_number_matched_description} />
                  <DatasheetVerificationCard value={item.part_number_datasheet_url} />
                  <FieldCard label="Verified At" value={item.part_number_verified_at} />
                </div>
              </div>

              <form id="bom-item-edit-form" onSubmit={saveItem} className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-bold text-blue-900">{editing ? 'Edit Normalized Fields' : 'Normalized Fields'}</h2>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(item.validation_status)}`}>{humanize(item.validation_status)}</span>
                </div>
                {editing ? (
                  <div className="grid gap-5">
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wide text-blue-900">Identification</h3>
                      <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {[
                          ['line_number', 'Line Number'],
                          ['part_number', 'Part Number'],
                          ['normalized_part_number', 'Normalized Part Number'],
                          ['manufacturer', 'Manufacturer'],
                          ['manufacturer_part_number', 'Manufacturer Part Number'],
                          ['product_name', 'Product Name'],
                        ].map(([field, label]) => (
                          <label key={field} className={labelClass}>{label}<input value={String(form[field as keyof FormState])} onChange={(event) => updateText(field as keyof FormState, event.target.value)} className={inputClass} /></label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wide text-blue-900">Technical</h3>
                      <div className="mt-3 grid gap-4 md:grid-cols-2">
                        {[
                          ['description', 'Description'],
                          ['specification', 'Specification'],
                          ['package_case', 'Package / Case'],
                          ['datasheet_url', 'Datasheet URL'],
                        ].map(([field, label]) => (
                          <label key={field} className={labelClass}>{label}<textarea value={String(form[field as keyof FormState])} onChange={(event) => updateText(field as keyof FormState, event.target.value)} className={`${inputClass} min-h-20`} /></label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wide text-blue-900">Quantity & Commercial</h3>
                      <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {[
                          ['quantity', 'Quantity'],
                          ['unit', 'Unit'],
                          ['target_unit_price', 'Target Unit Price'],
                          ['target_currency', 'Target Currency'],
                        ].map(([field, label]) => (
                          <label key={field} className={labelClass}>{label}<input value={String(form[field as keyof FormState])} onChange={(event) => updateText(field as keyof FormState, event.target.value)} className={inputClass} /></label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wide text-blue-900">Requirements</h3>
                      <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {[
                          ['preferred_origin_country', 'Preferred Origin Country'],
                          ['date_code_requirement', 'Date Code Requirement'],
                          ['acceptable_alternatives', 'Acceptable Alternatives'],
                        ].map(([field, label]) => (
                          <label key={field} className={labelClass}>{label}<input value={String(form[field as keyof FormState])} onChange={(event) => updateText(field as keyof FormState, event.target.value)} className={inputClass} /></label>
                        ))}
                        {[
                          ['allow_substitute', 'Allow Substitute'],
                          ['authorized_suppliers_only', 'Authorized Suppliers Only'],
                          ['rohs_required', 'RoHS Required'],
                          ['reach_required', 'REACH Required'],
                        ].map(([field, label]) => (
                          <label key={field} className="flex items-center gap-2 rounded-xl bg-white p-4 text-sm font-semibold text-slate-700">
                            <input type="checkbox" checked={Boolean(form[field as keyof FormState])} onChange={(event) => updateCheckbox(field as keyof FormState, event)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wide text-blue-900">Notes</h3>
                      <div className="mt-3 grid gap-4 md:grid-cols-2">
                        <label className={labelClass}>Notes<textarea value={form.notes} onChange={(event) => updateText('notes', event.target.value)} className={`${inputClass} min-h-24`} /></label>
                        <label className={labelClass}>Customer Comment<textarea value={form.customer_comment} onChange={(event) => updateText('customer_comment', event.target.value)} className={`${inputClass} min-h-24`} /></label>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {normalizedFields.map(([label, value]) => (
                      String(label) === 'Datasheet URL'
                        ? <DatasheetVerificationCard key={String(label)} value={value} />
                        : <FieldCard key={String(label)} label={String(label)} value={value} />
                    ))}
                  </div>
                )}
              </form>

              <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <h2 className="text-xl font-bold text-blue-900">Validation</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <FieldCard label="Status" value={humanize(item.validation_status)} />
                  <FieldCard label="Errors" value={item.validation_errors} />
                  <FieldCard label="Warnings" value={item.validation_warnings} />
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 p-5">
                  <h2 className="text-xl font-bold text-blue-900">Raw Original Excel Row</h2>
                </div>
                {rawEntries.length === 0 ? (
                  <div className="p-5 text-sm text-slate-600">No raw row data saved.</div>
                ) : (
                  <div className="max-h-96 overflow-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="sticky top-0 bg-blue-600 text-white">
                        <tr>
                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">Column</th>
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
