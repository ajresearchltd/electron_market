'use client';

import Link from 'next/link';
import HubButton from '../../../components/ui/HubButton';
import OrderPreferencesForm, { CountryOption } from '../../../components/customer/OrderPreferencesForm';
import ProcurementAiBrief from '../../../components/customer/ProcurementAiBrief';
import { defaultProcurementPreferences, normalizeProcurementPreferences, ProcurementPreferences } from '../../../../lib/procurement-preferences';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type UploadRow = Record<string, any>;
type ItemRow = {
  id: string;
  row_number: number | null;
  part_number: string | null;
  normalized_part_number: string | null;
  manufacturer: string | null;
  quantity: number | null;
  unit: string | null;
  description: string | null;
  validation_status: string | null;
  validation_errors: string[] | null;
  validation_warnings: string[] | null;
  part_number_check_status: string | null;
  part_number_check_message: string | null;
  part_number_check_source: string | null;
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
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
  if (normalized.includes('valid') || normalized.includes('complete') || normalized.includes('ready') || normalized.includes('normalized')) return 'bg-emerald-100 text-emerald-700';
  return 'bg-blue-100 text-blue-700';
};
const blueButtonClass = 'rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 hover:text-white active:bg-blue-900';
const smallBlueButtonClass = 'rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-800 hover:text-white active:bg-blue-900';
const partNumberCheckMeta = (status: string | null | undefined) => {
  if (['found_internal', 'found_octopart_exact', 'found_exact'].includes(String(status))) return { label: 'Part number confirmed', dot: 'bg-green-500' };
  if (['found_octopart_possible', 'manufacturer_mismatch', 'ambiguous', 'needs_review', 'suspicious_format'].includes(String(status))) return { label: 'Needs review', dot: 'bg-yellow-400' };
  if (['not_found', 'invalid_format', 'error'].includes(String(status))) return { label: 'Not found or invalid', dot: 'bg-red-500' };
  return { label: 'Not checked', dot: 'bg-gray-300' };
};
const isMeaningfulMapping = ([, column]: [string, string | null]) => {
  const value = String(column ?? '').trim();
  return Boolean(value) && !/^__EMPTY/i.test(value) && !['null', 'undefined'].includes(value.toLowerCase());
};

export default function CustomerBomUploadDetailPage() {
  const params = useParams<{ uploadId: string }>();
  const uploadId = params.uploadId;
  const [upload, setUpload] = useState<UploadRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verificationSummary, setVerificationSummary] = useState('');
  const [error, setError] = useState('');
  const [preferences,setPreferences]=useState<ProcurementPreferences>(defaultProcurementPreferences);
  const [savedPreferences,setSavedPreferences]=useState<ProcurementPreferences>(defaultProcurementPreferences);
  const [countries,setCountries]=useState<CountryOption[]>([]);
  const [preferenceError,setPreferenceError]=useState('');
  const [editingPreferences,setEditingPreferences]=useState(false);
  const [savingPreferences,setSavingPreferences]=useState(false);
  const [aiOpen,setAiOpen]=useState(false);

  const loadUpload = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/customer/bom/uploads/${uploadId}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load BOM upload.');
      setUpload(result.upload as UploadRow);
      setItems((result.items ?? []) as ItemRow[]);
      const preferenceResponse=await fetch(`/api/customer/bom/${uploadId}/preferences`);const preferenceResult=await preferenceResponse.json();
      if(preferenceResponse.ok){const normalized=normalizeProcurementPreferences(preferenceResult.preferences);setPreferences(normalized);setSavedPreferences(normalized);setCountries((preferenceResult.countries||[]).map((row:any)=>({iso2:String(row.iso2).toUpperCase(),name:String(row.name)})));setPreferenceError('')}
      else setPreferenceError(preferenceResult.error||'Order preferences could not be loaded.');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load BOM upload.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    if (active) loadUpload();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadId]);

  const verifyPartNumbers = async () => {
    setVerifying(true);
    setVerificationSummary('');
    setError('');
    try {
      const response = await fetch(`/api/customer/bom/uploads/${uploadId}/verify-part-numbers`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Part number verification failed.');
      setVerificationSummary(`Part Number verification completed: Green: ${result.green_found ?? 0} found, Yellow: ${result.yellow_review ?? 0} need review, Red: ${result.red_not_found ?? 0} not found.`);
      await loadUpload();
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Part number verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  const savePreferences=async(next=preferences)=>{setSavingPreferences(true);setPreferenceError('');try{const response=await fetch(`/api/customer/bom/${uploadId}/preferences`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(next)});const result=await response.json();if(!response.ok)throw new Error(result.error||'Order preferences could not be saved.');const normalized=normalizeProcurementPreferences(result.preferences);setPreferences(normalized);setSavedPreferences(normalized);setEditingPreferences(false)}catch(e){setPreferenceError(e instanceof Error?e.message:'Order preferences could not be saved.');throw e}finally{setSavingPreferences(false)}};
  const applyAiProposal=async(proposal:Record<string,unknown>)=>{const next=normalizeProcurementPreferences({...preferences,...proposal});await savePreferences(next)};

  const summaryRows=upload?[
    [['Procurement No',upload.procurement_number],['Customer Reference',upload.customer_reference],['Status',humanize(upload.status)]],
    [['File',upload.original_file_name||upload.document_name],['Items',upload.total_rows],['Uploaded',formatDate(upload.created_at)]],
    [['BOM ID',upload.id],['File type',upload.file_type],['Current stage',upload.current_stage_label||humanize(upload.current_stage)]],
  ]:[];
  const mainMapping = (upload?.main_column_mapping ?? {}) as Record<string, string | null>;
  const secondaryMapping = (upload?.secondary_column_mapping ?? {}) as Record<string, string | null>;
  const usefulMappings = Object.entries({ ...mainMapping, ...secondaryMapping }).filter(isMeaningfulMapping);

  return (
    <main className="min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 text-white lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">Electron Market Customer</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">BOM Upload Detail</h1>
            <p className="mt-2 text-sm leading-6 text-blue-100">Review normalized rows and mapping details for this BOM upload.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/customer/bom-uploads" className={blueButtonClass}>Back to BOM Lists</Link>
            <button type="button" disabled className="rounded-lg bg-blue-300 px-4 py-2 text-sm font-semibold text-white">Create RFQ from Valid Items - coming soon</button>
          </div>
        </div>

        <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-2xl">
          {loading && <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">Loading BOM upload...</div>}
          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {!loading && upload && (
            <>
              <div className="space-y-2 rounded-2xl bg-blue-700 px-5 py-4 text-white shadow-lg">
                {summaryRows.map((row,index)=><p key={index} className="flex flex-wrap gap-x-2 gap-y-1 text-sm">{row.filter(([,value])=>value!==null&&value!==undefined&&value!=='').map(([label,value],itemIndex)=><span key={String(label)}>{itemIndex>0?<span className="mr-2 text-blue-200">•</span>:null}<b>{label}:</b> {displayValue(value)}</span>)}</p>)}
              </div>

              <div className="mt-6 flex flex-col gap-3"><div className="flex flex-wrap gap-3">
                <HubButton onClick={verifyPartNumbers} disabled={items.length === 0} loading={verifying} loadingText="Verifying...">Verify Part Numbers</HubButton>
                <HubButton onClick={()=>setAiOpen(true)}>AI brief</HubButton>
              </div>
                {verificationSummary && <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-blue-800">{verificationSummary}</div>}
              </div>

              <section className="mt-6 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold text-blue-900">Preferences of order</h2>{!editingPreferences?<HubButton size="sm" onClick={()=>setEditingPreferences(true)}>Edit</HubButton>:null}</div>{preferenceError?<p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{preferenceError}</p>:null}{editingPreferences?<div className="mt-5"><OrderPreferencesForm value={preferences} onChange={setPreferences} countries={countries}/><div className="mt-4 flex justify-end gap-2"><HubButton size="sm" onClick={()=>{setPreferences(savedPreferences);setEditingPreferences(false)}}>Cancel</HubButton><HubButton size="sm" loading={savingPreferences} loadingText="Saving..." onClick={()=>savePreferences()}>Save changes</HubButton></div></div>:<dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Priority',humanize(preferences.search_priority)],['Maximum lead time',preferences.max_lead_time_days?`${preferences.max_lead_time_days} days`:'No fixed maximum'],['Allowed countries',preferences.supplier_countries.length?preferences.supplier_countries.join(', '):'Any country'],['Independent suppliers',preferences.allow_independent_suppliers?'Yes':'No'],['Alternative parts',preferences.allow_alternatives?'Yes':'No'],['Split delivery',preferences.allow_split_delivery?'Yes':'No'],['Budget',preferences.budget_amount!=null?`${preferences.budget_amount} ${preferences.budget_currency||''}`:'No maximum'],['Certificate requirements',preferences.certificate_requirements||'None specified']].map(([label,value])=><div key={String(label)} className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-bold uppercase text-slate-500">{label}</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{value}</dd></div>)}</dl>}</section>

              <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-blue-600 text-white">
                    <tr>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">Row</th>
                      <th className="w-12 px-2 py-3 text-center text-xs font-bold uppercase tracking-wide">PN</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">Part Number</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">Manufacturer</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">Quantity</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">Description</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">Issues</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                    {items.length === 0 ? (
                      <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-600">No normalized BOM items found.</td></tr>
                    ) : (
                      items.map((item) => (
                        <tr
                          key={item.id}
                          className="cursor-pointer hover:bg-blue-50"
                          onClick={() => { window.location.href = `/customer/bom-uploads/${uploadId}/items/${item.id}`; }}
                        >
                          <td className="px-4 py-3">{item.row_number ?? '-'}</td>
                          <td className="w-12 px-2 py-3 text-center">
                            {(() => {
                              const meta = partNumberCheckMeta(item.part_number_check_status);
                              return (
                                <span title={item.part_number_check_message || meta.label} className={`inline-block h-3 w-3 rounded-full ${meta.dot}`} />
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(item.validation_status)}`}>{humanize(item.validation_status)}</span></td>
                          <td className="px-4 py-3 font-semibold text-slate-950">{item.part_number || item.normalized_part_number || '-'}</td>
                          <td className="px-4 py-3">{item.manufacturer || '-'}</td>
                          <td className="px-4 py-3">{item.quantity ?? '-'} {item.unit || ''}</td>
                          <td className="max-w-xs truncate px-4 py-3" title={item.description || ''}>{item.description || '-'}</td>
                          <td className="px-4 py-3">{[...(item.validation_errors ?? []), ...(item.validation_warnings ?? [])].join(', ') || '-'}</td>
                          <td className="px-4 py-3">
                            <Link href={`/customer/bom-uploads/${uploadId}/items/${item.id}`} onClick={(event) => event.stopPropagation()} className={smallBlueButtonClass}>Review</Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Part Number Check:</span>
                <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-green-500" /> Green - confirmed</span>
                <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-yellow-400" /> Yellow - needs review</span>
                <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-red-500" /> Red - not found or invalid</span>
                <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-gray-300" /> Gray - not checked</span>
              </div>

              <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3"><h2 className="text-sm font-bold text-blue-900">Column Mapping</h2><p className="mt-0.5 text-xs text-slate-500">Detected source columns used for normalization.</p>{usefulMappings.length===0?<p className="mt-2 text-xs text-slate-600">No reliable column mapping was detected.</p>:<div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{usefulMappings.map(([field,column])=><div key={field} className="grid grid-cols-[minmax(120px,0.7fr)_32px_minmax(150px,1fr)] items-center rounded-lg bg-white px-3 py-2 text-xs"><span className="font-semibold text-slate-600">{humanize(field)}</span><span className="text-center text-blue-500">→</span><span className="truncate font-semibold text-slate-900" title={String(column)}>{column}</span></div>)}</div>}</section>
            </>
          )}
        </section>
      </div>
      <ProcurementAiBrief open={aiOpen} onClose={()=>setAiOpen(false)} uploadId={uploadId} onApplyProposal={applyAiProposal}/>
    </main>
  );
}
