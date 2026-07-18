'use client';

import Link from 'next/link';
import HubButton from '../../../components/ui/HubButton';
import OrderPreferencesForm, { CountryOption } from '../../../components/customer/OrderPreferencesForm';
import { defaultProcurementPreferences, ProcurementPreferences } from '../../../../lib/procurement-preferences';
import { useRouter } from 'next/navigation';
import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { createClient } from '../../../../lib/supabase/client';

type UploadForm = {
  documentName: string;
  customerCompanyName: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  customerCountry: string;
  projectName: string;
  projectDescription: string;
  destinationCountry: string;
  requiredDeliveryDate: string;
  defaultLeadTime: string;
  targetBudget: string;
  budgetCurrency: string;
  preferredIncoterms: string;
  preferredOriginCountry: string;
  additionalNotes: string;
};

type PreviewRow = {
  id: string | null;
  row_number: number;
  part_number: string | null;
  manufacturer: string | null;
  quantity: number | null;
  description: string | null;
  validation_status: string;
};
type GenericRow = Record<string, any>;

const initialForm: UploadForm = {
  documentName: '',
  customerCompanyName: '',
  contactPerson: '',
  contactEmail: '',
  contactPhone: '',
  customerCountry: '',
  projectName: '',
  projectDescription: '',
  destinationCountry: '',
  requiredDeliveryDate: '',
  defaultLeadTime: '',
  targetBudget: '',
  budgetCurrency: 'USD',
  preferredIncoterms: '',
  preferredOriginCountry: '',
  additionalNotes: '',
};

const requiredFields: Array<keyof UploadForm> = [];
const labels: Record<keyof UploadForm, string> = {
  documentName: 'Document Name',
  customerCompanyName: 'Customer Company',
  contactPerson: 'Contact Person',
  contactEmail: 'Contact Email',
  contactPhone: 'Contact Phone',
  customerCountry: 'Customer Country',
  projectName: 'Project Name',
  projectDescription: 'Project Description',
  destinationCountry: 'Destination Country',
  requiredDeliveryDate: 'Required Delivery Date',
  defaultLeadTime: 'Default Lead Time',
  targetBudget: 'Target Budget',
  budgetCurrency: 'Budget Currency',
  preferredIncoterms: 'Preferred Incoterms',
  preferredOriginCountry: 'Preferred Origin Country',
  additionalNotes: 'Additional Notes',
};

const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const readOnlyInputClass = 'mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-700 outline-none';
const labelClass = 'text-sm font-semibold text-slate-700';
const blueButtonClass = 'rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 hover:text-white active:bg-blue-900';
const blueButtonLargeClass = 'rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-800 hover:text-white active:bg-blue-900 disabled:cursor-not-allowed disabled:bg-blue-300';
const requiredStar = <span className="text-red-500">*</span>;

const statusBadgeClass = (value: string | null | undefined) => {
  const normalized = (value ?? '').toLowerCase();
  if (normalized.includes('error') || normalized.includes('failed')) return 'bg-red-100 text-red-700';
  if (normalized.includes('warning')) return 'bg-amber-100 text-amber-700';
  if (normalized.includes('valid') || normalized.includes('complete') || normalized.includes('ready')) return 'bg-emerald-100 text-emerald-700';
  return 'bg-blue-100 text-blue-700';
};

const humanize = (value: string | null | undefined) => value ? value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) : '-';
const isMeaningfulMapping = ([, column]: [string, string | null]) => {
  const value = String(column ?? '').trim();
  return Boolean(value) && !/^__EMPTY/i.test(value) && !['null', 'undefined'].includes(value.toLowerCase());
};

export default function CustomerBomUploadPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<UploadForm>(initialForm);
  const [file, setFile] = useState<File | null>(null);
  const [authorizedSuppliersOnly, setAuthorizedSuppliersOnly] = useState(false);
  const [allowSubstitutes, setAllowSubstitutes] = useState(false);
  const [manufacturersOnly, setManufacturersOnly] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [submissionIdempotencyKey] = useState(() => crypto.randomUUID());
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [summary, setSummary] = useState({ totalRows: 0, validRows: 0, warningRows: 0, errorRows: 0 });
  const [uploadId, setUploadId] = useState('');
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [mainColumnMapping, setMainColumnMapping] = useState<Record<string, string | null>>({});
  const [secondaryColumnMapping, setSecondaryColumnMapping] = useState<Record<string, string | null>>({});
  const [unmappedColumns, setUnmappedColumns] = useState<string[]>([]);
  const [profileWarning, setProfileWarning] = useState('');
  const [preferences, setPreferences] = useState<ProcurementPreferences>(defaultProcurementPreferences);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const usefulMappings = [
    ...Object.entries(mainColumnMapping).filter(isMeaningfulMapping),
    ...Object.entries(secondaryColumnMapping).filter(isMeaningfulMapping).slice(0, 8),
  ];

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) throw new Error('Authentication required.');
        const [userProfileResult, customerProfileResult] = await Promise.all([
          supabase.from('user_profiles').select('email, full_name, company_name').eq('id', authData.user.id).maybeSingle(),
          supabase.from('customer_company_profiles').select('company_name, contact_person, contact_name, contact_email, phone, contact_phone, country, country_name').eq('user_id', authData.user.id).maybeSingle(),
        ]);
        if (!active) return;
        const profile = (customerProfileResult.data ?? {}) as GenericRow;
        const userProfile = (userProfileResult.data ?? {}) as GenericRow;
        const user = authData.user;
        const nextIdentity = {
          customerCompanyName: profile.company_name || userProfile.company_name || 'Not filled',
          contactPerson: profile.contact_person || profile.contact_name || userProfile.full_name || user.user_metadata?.full_name || 'Not filled',
          contactEmail: profile.contact_email || user.email || userProfile.email || '',
          contactPhone: profile.phone || profile.contact_phone || 'Not filled',
          customerCountry: profile.country || profile.country_name || 'Not filled',
        };
        setForm((current) => ({ ...current, ...nextIdentity }));
        const missing = Object.entries(nextIdentity).filter(([, value]) => !value || value === 'Not filled').map(([key]) => labels[key as keyof UploadForm]);
        setProfileWarning(missing.length > 0 ? 'Some customer profile fields are missing. Please complete Customer Profile for better supplier responses.' : '');
      } catch {
        if (active) setProfileWarning('Some customer profile fields are missing. Please complete Customer Profile for better supplier responses.');
      }
    };
    loadProfile();
    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(()=>{let active=true;supabase.from('countries').select('iso2,name').order('name').then(({data})=>{if(active)setCountries((data||[]).map((row:any)=>({iso2:String(row.iso2).toUpperCase(),name:String(row.name)})))});return()=>{active=false}},[supabase]);

  const updateForm = (field: keyof UploadForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setMissingFields((current) => current.filter((item) => item !== field));
  };
  const fieldClass = (field: keyof UploadForm) => `${inputClass} ${missingFields.includes(field) ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-100' : ''}`;

  const pickFile = (selected: File | null) => {
    if (!selected) return;
    const extension = selected.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xls', 'xlsx'].includes(extension || '')) {
      setError('Please choose a .csv, .xls, or .xlsx file.');
      return;
    }
    if (selected.size > 20 * 1024 * 1024) {
      setError('File size must be 20MB or smaller.');
      return;
    }
    setError('');
    setFile(selected);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    pickFile(event.dataTransfer.files?.[0] ?? null);
  };

  const downloadTemplate = () => {
    const headers = [
      'Line Number',
      'Manufacturer',
      'MPN / Part Number',
      'Product Name',
      'Description',
      'Specification',
      'Package / Case',
      'Quantity',
      'Unit',
      'Target Unit Price',
      'Currency',
      'Acceptable Alternatives',
      'Date Code Requirement',
      'RoHS Required',
      'REACH Required',
      'Datasheet URL',
      'Notes',
    ];
    const blob = new Blob([`${headers.join(',')}\n`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'customer-bom-template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setStatusMessage('');
    setMissingFields([]);
    if (!file) {
      setError('Please choose an Excel or CSV BOM file.');
      return;
    }

    setProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      Object.entries(form).forEach(([key, value]) => formData.append(key, value));
      formData.append('authorizedSuppliersOnly', String(authorizedSuppliersOnly));
      formData.append('allowSubstitutes', String(allowSubstitutes));
      formData.append('manufacturersOnly', String(manufacturersOnly));
      formData.append('orderPreferences', JSON.stringify(preferences));
      formData.append('submissionIdempotencyKey', submissionIdempotencyKey);
      const response = await fetch('/api/customer/bom/upload', { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'BOM upload failed.');
      setSummary({
        totalRows: result.total_rows ?? 0,
        validRows: result.valid_rows ?? 0,
        warningRows: result.warning_rows ?? 0,
        errorRows: result.error_rows ?? 0,
      });
      setUploadId(String(result.upload_id || ''));
      setPreviewRows((result.preview_rows ?? []) as PreviewRow[]);
      setMainColumnMapping((result.main_column_mapping ?? {}) as Record<string, string | null>);
      setSecondaryColumnMapping((result.secondary_column_mapping ?? {}) as Record<string, string | null>);
      setUnmappedColumns((result.unmapped_columns ?? []) as string[]);
      setStatusMessage(result.preference_warning || `BOM uploaded and processed. Upload ID: ${result.upload_id}`);
      router.push(`/customer/bom-uploads/${encodeURIComponent(String(result.upload_id))}${result.preference_warning?'?preferences_warning=1':''}`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'BOM upload failed.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 text-white lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">Electron Market Customer</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">Upload BOM List (Excel / CSV)</h1>
            <p className="mt-2 text-sm leading-6 text-blue-100">Upload your BOM file and let AI normalize part numbers, quantities, manufacturers and technical requirements.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/customer/dashboard" className={blueButtonClass}>Back to Customer HUB</Link>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-blue-100 bg-white p-5 shadow-2xl">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <section className="min-w-0 rounded-2xl border border-blue-100 bg-blue-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold text-blue-900">General Information</h2><HubButton type="button" size="sm" onClick={()=>window.dispatchEvent(new Event('electron-market:open-customer-profile'))}>Complete Profile</HubButton></div>
              <div className="mt-4 rounded-xl border border-blue-100 bg-white p-4 text-sm text-slate-600">
                Customer information is loaded from your profile. To change it, update Customer Profile.
                {profileWarning && <p className="mt-2 font-semibold text-amber-700">{profileWarning}</p>}
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {(['customerCompanyName', 'contactPerson', 'contactEmail', 'contactPhone', 'customerCountry'] as Array<keyof UploadForm>).map((field) => (
                  <label key={field} className={labelClass}>
                    {labels[field]}
                    <input
                      type={field === 'contactEmail' ? 'email' : 'text'}
                      value={form[field]}
                      readOnly
                      disabled
                      className={readOnlyInputClass}
                    />
                  </label>
                ))}
                {(['documentName', 'projectName', 'destinationCountry', 'requiredDeliveryDate', 'defaultLeadTime', 'targetBudget', 'budgetCurrency', 'preferredIncoterms', 'preferredOriginCountry'] as Array<keyof UploadForm>).map((field) => (
                  <label key={field} className={labelClass}>
                    {labels[field]} {requiredFields.includes(field) && requiredStar}
                    <input
                      type={field === 'requiredDeliveryDate' ? 'date' : 'text'}
                      value={form[field]}
                      onChange={(event) => updateForm(field, event.target.value)}
                      className={fieldClass(field)}
                    />
                  </label>
                ))}
                <label className={`${labelClass} md:col-span-2`}>
                  Project Description
                  <textarea value={form.projectDescription} onChange={(event) => updateForm('projectDescription', event.target.value)} className={`${inputClass} min-h-24`} />
                </label>
                <label className={`${labelClass} md:col-span-2`}>
                  Additional Notes
                  <textarea value={form.additionalNotes} onChange={(event) => updateForm('additionalNotes', event.target.value)} className={`${inputClass} min-h-24`} />
                </label>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {[
                  ['Authorized Suppliers Only', authorizedSuppliersOnly, setAuthorizedSuppliersOnly],
                  ['Allow Substitutes', allowSubstitutes, setAllowSubstitutes],
                  ['Manufacturers Only', manufacturersOnly, setManufacturersOnly],
                ].map(([label, value, setter]) => (
                  <label key={String(label)} className="flex items-center gap-2 rounded-xl bg-white p-3 text-sm font-semibold text-slate-700">
                    <input type="checkbox" checked={Boolean(value)} onChange={(event) => (setter as (checked: boolean) => void)(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                    {String(label)}
                  </label>
                ))}
              </div>
            </section>

            <aside className="min-w-0 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-bold text-blue-900">Upload Excel / CSV File</h2>
              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                className="mt-5 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50 p-6 text-center"
              >
                <p className="text-sm font-semibold text-slate-700">{file ? file.name : 'Drop your BOM file here'}</p>
                <p className="mt-2 text-xs text-slate-500">Accepted: .xlsx, .xls, .csv. Max 20 MB.</p>
                <label className={`mt-4 inline-flex cursor-pointer ${blueButtonClass}`}>
                  Choose File
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event: ChangeEvent<HTMLInputElement>) => pickFile(event.target.files?.[0] ?? null)} />
                </label>
              </div>
              <div className="mt-5 flex flex-col gap-3">
                <button type="button" onClick={downloadTemplate} className={blueButtonLargeClass}>
                  Download BOM Template
                </button>
              </div>
            </aside>
          </div>

          <section className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <h2 className="text-xl font-bold text-blue-900">Preferences of order</h2>
            <p className="mt-1 mb-5 text-sm text-slate-600">Set the sourcing rules the procurement team and AI Brief should respect.</p>
            <OrderPreferencesForm value={preferences} onChange={setPreferences} countries={countries}/>
          </section>

          <div className="mt-6 flex justify-end"><HubButton type="submit" size="lg" loading={processing} loadingText="Processing...">Upload BOM & Process with AI</HubButton></div>

          {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {statusMessage && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{statusMessage}</div>}

          {previewRows.length > 0 && (
            <section className="mt-6 rounded-2xl border border-blue-100 bg-white p-5">
              <h2 className="text-xl font-bold text-blue-900">Processed BOM Preview</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['Total Rows', summary.totalRows],
                  ['Valid Rows', summary.validRows],
                  ['Warnings', summary.warningRows],
                  ['Errors', summary.errorRows],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
                    <p className="mt-2 text-2xl font-bold text-slate-950">{String(value)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-blue-600 text-white">
                    <tr>{['Row', 'Part Number', 'Manufacturer', 'Quantity', 'Description', 'Status', 'Action'].map((heading) => <th key={heading} className="px-4 py-3 text-xs font-bold uppercase tracking-wide">{heading}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewRows.map((row) => (
                      <tr key={row.row_number}>
                        <td className="px-4 py-3">{row.row_number}</td>
                        <td className="px-4 py-3 font-semibold text-slate-950">{row.part_number || '-'}</td>
                        <td className="px-4 py-3">{row.manufacturer || '-'}</td>
                        <td className="px-4 py-3">{row.quantity ?? '-'}</td>
                        <td className="px-4 py-3">{row.description || '-'}</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(row.validation_status)}`}>{humanize(row.validation_status)}</span></td>
                        <td className="px-4 py-3">
                          {uploadId && row.id ? (
                            <Link href={`/customer/bom-uploads/${uploadId}/items/${row.id}`} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-800 hover:text-white active:bg-blue-900">View / Edit</Link>
                          ) : (
                            <span className="text-xs text-slate-500">Saved</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-slate-700">
                <h3 className="font-bold text-blue-900">Column Mapping Summary</h3>
                <p className="mt-1 text-xs text-slate-500">Detected Excel columns used for BOM normalization.</p>
                {usefulMappings.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-600">No reliable column mapping was detected.</p>
                ) : (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {usefulMappings.map(([field, column]) => <p key={field}><span className="font-semibold">{humanize(field)}</span>{' -> '}{column}</p>)}
                  </div>
                )}
                <p className="mt-3"><span className="font-semibold">Unmapped columns:</span> {unmappedColumns.filter((column) => column && !/^__EMPTY/i.test(column)).length ? unmappedColumns.filter((column) => column && !/^__EMPTY/i.test(column)).join(', ') : 'None'}</p>
              </div>
            </section>
          )}
        </form>
      </div>
    </main>
  );
}
