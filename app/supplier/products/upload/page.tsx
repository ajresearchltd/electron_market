'use client';

import Link from 'next/link';
import { ChangeEvent, DragEvent, FormEvent, useMemo, useState } from 'react';
import { createClient } from '../../../../lib/supabase/client';
import HubButton from '../../../components/ui/HubButton';

type UploadForm = {
  documentName: string;
  supplierCompanyName: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  supplierCountry: string;
  shippingFromCountry: string;
  defaultCurrency: string;
  defaultIncoterms: string;
  nktrsClassification: string;
  defaultLeadTime: string;
  additionalNotes: string;
};

type PreviewRow = {
  row_number: number;
  part_number: string | null;
  product_name: string | null;
  available_quantity: number | null;
  unit_price: number | null;
  currency: string | null;
  validation_status: string;
  validation_errors: string[];
};

type MappingWarning = {
  type?: string;
  message?: string;
  severity?: string;
};

type SupplierProfileRow = {
  company_name: string | null;
  company_email: string | null;
  company_phone: string | null;
  main_contact_name: string | null;
  country_name: string | null;
};

const initialForm: UploadForm = {
  documentName: '',
  supplierCompanyName: '',
  contactPerson: '',
  contactEmail: '',
  contactPhone: '',
  supplierCountry: '',
  shippingFromCountry: '',
  defaultCurrency: 'USD',
  defaultIncoterms: '',
  nktrsClassification: '',
  defaultLeadTime: '',
  additionalNotes: '',
};

const requiredFields: Array<keyof UploadForm> = [
  'documentName',
  'supplierCompanyName',
  'contactPerson',
  'contactEmail',
  'defaultLeadTime',
];

const labels: Record<keyof UploadForm, string> = {
  documentName: 'Document Name',
  supplierCompanyName: 'Supplier Company',
  contactPerson: 'Contact Person',
  contactEmail: 'Contact Email',
  contactPhone: 'Contact Phone',
  supplierCountry: 'Supplier Country',
  shippingFromCountry: 'Shipping From Country',
  defaultCurrency: 'Default Currency',
  defaultIncoterms: 'Default Incoterms',
  nktrsClassification: 'NKTRs / Classification',
  defaultLeadTime: 'Default Lead Time',
  additionalNotes: 'Additional Notes',
};

const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const labelClass = 'text-sm font-semibold text-slate-700';
const requiredStar = <span className="text-red-500">*</span>;

const normalize = (value: string) => value.trim();
const parseNumber = (value: unknown) => {
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};
const parseInteger = (value: unknown) => {
  const parsed = parseNumber(value);
  return parsed === null ? null : Math.round(parsed);
};

const parseCsv = (text: string) => {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && next === '"' && inQuotes) {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(current.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      current = '';
    } else {
      current += char;
    }
  }
  row.push(current.trim());
  if (row.some(Boolean)) rows.push(row);
  const headers = rows[0] ?? [];
  const dataRows = rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
  return { headers, dataRows };
};

const normalizeWorkbookRows = (rows: Record<string, unknown>[]) => {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const dataRows = rows.map((row) => Object.fromEntries(headers.map((header) => [header, String(row[header] ?? '').trim()])));
  return { headers, dataRows };
};

const sanitizeFileName = (value: string) => value.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '') || 'stock-list';

export default function SupplierProductUploadPage() {
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<UploadForm>(initialForm);
  const [file, setFile] = useState<File | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [validRows, setValidRows] = useState(0);
  const [errorRows, setErrorRows] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [processingWarning, setProcessingWarning] = useState('');
  const [mainColumnMapping, setMainColumnMapping] = useState<Record<string, string | null>>({});
  const [secondaryColumnMapping, setSecondaryColumnMapping] = useState<Record<string, string | null>>({});
  const [unmappedColumns, setUnmappedColumns] = useState<string[]>([]);
  const [mappingWarnings, setMappingWarnings] = useState<MappingWarning[]>([]);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

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
      'Supplier Offer ID',
      'Manufacturer',
      'MPN / Part Number',
      'Supplier SKU',
      'Product Name',
      'Category',
      'Description',
      'Package / Case',
      'Condition',
      'Available Quantity',
      'MOQ',
      'Unit',
      'Unit Price',
      'Currency',
      'Lead Time',
      'Country of Origin',
      'Datasheet URL',
      'Product Image URL 1',
      'Product Video URL',
      'Product Video Description',
      'Notes',
      'Active',
    ];
    const blob = new Blob([`${headers.join(',')}\n`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'supplier-product-list-template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const resolveSupplierId = async (userId: string, email?: string) => {
    const { data: profile } = await supabase
      .from('supplier_company_profiles')
      .select('company_name, company_email, company_phone, main_contact_name, country_name')
      .eq('user_id', userId)
      .maybeSingle();

    const supplierProfile = profile as SupplierProfileRow | null;
    const supplierEmail = supplierProfile?.company_email || email || '';
    const companyName = supplierProfile?.company_name || form.supplierCompanyName || 'Supplier Account';
    if (!form.supplierCompanyName && supplierProfile?.company_name) updateForm('supplierCompanyName', supplierProfile.company_name);
    if (!form.contactEmail && supplierEmail) updateForm('contactEmail', supplierEmail);
    if (!form.contactPhone && supplierProfile?.company_phone) updateForm('contactPhone', supplierProfile.company_phone);
    if (!form.contactPerson && supplierProfile?.main_contact_name) updateForm('contactPerson', supplierProfile.main_contact_name);
    if (!form.supplierCountry && supplierProfile?.country_name) updateForm('supplierCountry', supplierProfile.country_name);

    if (supplierEmail) {
      const { data: byContact } = await supabase.from('suppliers').select('supplier_id').eq('contact_email', supplierEmail).maybeSingle();
      if (byContact?.supplier_id) return byContact.supplier_id as string;
    }
    const { data: byCompany } = await supabase.from('suppliers').select('supplier_id').eq('company_name', companyName).maybeSingle();
    if (byCompany?.supplier_id) return byCompany.supplier_id as string;

    const { data, error: insertError } = await supabase
      .from('suppliers')
      .insert({
        supplier_name: companyName,
        company_name: companyName,
        contact_email: supplierEmail || form.contactEmail || null,
        email: supplierEmail || form.contactEmail || null,
        contact_phone: supplierProfile?.company_phone || form.contactPhone || null,
        contact_person: supplierProfile?.main_contact_name || form.contactPerson || null,
        country: supplierProfile?.country_name || form.supplierCountry || null,
        supplier_status: 'active',
      })
      .select('supplier_id')
      .single();
    if (insertError) throw new Error(`Supplier profile: ${insertError.message}`);
    return data.supplier_id as string;
  };

  const buildItemRows = (uploadId: string, csvRows: Record<string, string>[], columnMap: Record<string, string>, confidence: Record<string, number>) => {
    return csvRows.map((row, index) => {
      const read = (field: string) => columnMap[field] ? normalize(row[columnMap[field]] ?? '') : '';
      const partNumber = read('part_number');
      const unitPrice = parseNumber(read('unit_price'));
      const quantity = parseInteger(read('available_quantity'));
      const productName = read('product_name') || read('description');
      const errors: string[] = [];
      if (!partNumber) errors.push('Missing Part Number');
      if (unitPrice === null) errors.push('Missing Price');
      if (quantity === null) errors.push('Missing Quantity');
      if (!productName) errors.push('Missing Product Name');
      const hardErrors = errors.some((item) => item !== 'Missing Product Name');

      return {
        upload_id: uploadId,
        row_number: index + 2,
        part_number: partNumber || null,
        manufacturer: read('manufacturer') || null,
        supplier_sku: read('supplier_sku') || null,
        product_name: productName || null,
        description: read('description') || null,
        package_case: read('package_case') || null,
        condition: read('condition') || null,
        available_quantity: quantity,
        moq: parseInteger(read('moq')),
        unit: read('unit') || 'pcs',
        unit_price: unitPrice,
        currency: read('currency') || form.defaultCurrency || 'USD',
        compare_at_price: parseNumber(read('compare_at_price')),
        lead_time: read('lead_time') || form.defaultLeadTime || null,
        country_of_origin: read('country_of_origin') || null,
        shipping_from: read('shipping_from') || form.shippingFromCountry || null,
        incoterms: read('incoterms') || form.defaultIncoterms || null,
        datasheet_url: read('datasheet_url') || null,
        product_image_url_1: read('product_image_url_1') || null,
        product_video_url: read('product_video_url') || null,
        product_video_description: read('product_video_description') || null,
        warranty: read('warranty') || null,
        notes: read('notes') || null,
        active: !['false', 'no', '0'].includes(read('active').toLowerCase()),
        validation_status: hardErrors ? 'error' : errors.length > 0 ? 'warning' : 'valid',
        validation_errors: errors,
        ai_confidence: confidence,
        raw_row_json: row,
        import_status: 'pending',
      };
    });
  };

  const parseSelectedFile = async (selectedFile: File) => {
    if (selectedFile.name.toLowerCase().endsWith('.csv')) {
      return parseCsv(await selectedFile.text());
    }

    const XLSX = await import('xlsx');
    const workbook = XLSX.read(await selectedFile.arrayBuffer(), { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new Error('The Excel file does not contain a worksheet.');
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    if (rows.length === 0) throw new Error('The Excel file does not contain product rows.');
    return normalizeWorkbookRows(rows);
  };

  const processFile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setStatusMessage('');
    setProcessingWarning('');
    setPreviewRows([]);
    setMainColumnMapping({});
    setSecondaryColumnMapping({});
    setUnmappedColumns([]);
    setMappingWarnings([]);
    const missing = requiredFields.filter((field) => !String(form[field]).trim());
    setMissingFields(missing);
    if (missing.length > 0) {
      setError(`Please fill in required fields: ${missing.map((field) => labels[field]).join(', ')}.`);
      return;
    }
    if (!file) {
      setError('Please choose an Excel or CSV file.');
      return;
    }
    setProcessing(true);
    try {
      const payload = new FormData();
      payload.append('file', file);
      (Object.keys(form) as Array<keyof UploadForm>).forEach((field) => payload.append(field, form[field]));
      const response = await fetch('/api/supplier-stock-upload/upload', { method: 'POST', body: payload });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to process file.');

      const resultWarnings = Array.isArray(result.warnings) ? result.warnings.filter(Boolean) : [];
      setTotalRows(Number(result.total_rows ?? 0));
      setValidRows(Number(result.valid_rows ?? 0));
      setErrorRows(Number(result.error_rows ?? 0));
      setPreviewRows((result.preview_rows ?? []) as PreviewRow[]);
      setMainColumnMapping((result.main_column_mapping ?? {}) as Record<string, string | null>);
      setSecondaryColumnMapping((result.secondary_column_mapping ?? {}) as Record<string, string | null>);
      setUnmappedColumns((result.unmapped_columns ?? []) as string[]);
      setMappingWarnings(resultWarnings.map((warning: string | MappingWarning) => typeof warning === 'string' ? { message: warning } : warning));
      setStatusMessage(result.ai_used ? 'File processed with AI column mapping.' : 'File processed with fallback column mapping.');
      setProcessingWarning(resultWarnings.map((warning: string | MappingWarning) => typeof warning === 'string' ? warning : warning.message).filter(Boolean).join(' '));
    } catch (processError) {
      setError(processError instanceof Error ? processError.message : 'Unable to process file.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 text-white lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">Electron Market Supplier</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">Upload Product List (Excel / CSV)</h1>
            <p className="mt-2 text-sm leading-6 text-blue-100">Provide document-level information below, then upload your Excel or CSV file.</p>
          </div>
          <button type="button" onClick={downloadTemplate} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Download Excel Template</button>
        </div>

        <form onSubmit={processFile} className="space-y-6 rounded-2xl border border-blue-100 bg-white p-5 shadow-2xl">
          {error && <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</div>}
          {statusMessage && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{statusMessage}</div>}
          {processingWarning && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">{processingWarning}</div>}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
              <h2 className="text-xl font-bold text-blue-900">General Information</h2>
              <p className="mt-1 text-sm text-slate-600">Document-level information applies to the entire upload. Individual product details come from the Excel file.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {(Object.keys(labels) as Array<keyof UploadForm>).map((field) => (
                  <label key={field} className={field === 'additionalNotes' ? 'md:col-span-2 xl:col-span-3' : ''}>
                    <span className={labelClass}>{labels[field]} {requiredFields.includes(field) && requiredStar}</span>
                    {field === 'additionalNotes' ? (
                      <textarea rows={3} className={fieldClass(field)} value={form[field]} onChange={(event) => updateForm(field, event.target.value)} />
                    ) : (
                      <input className={fieldClass(field)} value={form[field]} onChange={(event) => updateForm(field, event.target.value)} />
                    )}
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-bold text-blue-900">Upload Excel / CSV File</h2>
              <div onDragOver={(event) => event.preventDefault()} onDrop={handleDrop} className="mt-4 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50 p-6 text-center">
                <p className="text-sm font-semibold text-slate-800">Drag and drop your stock list here</p>
                <p className="mt-1 text-xs text-slate-500">Supported formats: .xlsx, .xls, .csv. Max file size: 20MB.</p>
                <label className="mt-4 inline-flex cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                  Choose File
                  <input type="file" accept=".csv,.xls,.xlsx" onChange={(event: ChangeEvent<HTMLInputElement>) => pickFile(event.target.files?.[0] ?? null)} className="hidden" />
                </label>
                {file && <p className="mt-3 text-sm font-semibold text-blue-800">{file.name}</p>}
              </div>
              <HubButton type="submit" loading={processing} loadingText="Processing..." fullWidth className="mt-4">Upload Excel & Process with AI</HubButton>
              <button type="button" onClick={downloadTemplate} className="mt-3 w-full rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50">Download Excel Template</button>
            </section>
          </div>

          {previewRows.length > 0 && (
            <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
              <div className="mb-5 rounded-2xl border border-blue-100 bg-white p-5">
                <h2 className="text-xl font-bold text-blue-900">Column Mapping</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {[
                    ['Part Number', mainColumnMapping.part_number],
                    ['Product Name', mainColumnMapping.product_name],
                    ['Quantity', mainColumnMapping.available_quantity],
                    ['Price', mainColumnMapping.unit_price],
                    ['Currency', mainColumnMapping.currency],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{value ? `→ "${value}"` : 'Not mapped'}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Secondary Columns Detected</p>
                    <p className="mt-2 text-sm text-slate-700">
                      {Object.entries(secondaryColumnMapping).filter(([, value]) => Boolean(value)).map(([field]) => field.replace(/_/g, ' ')).join(', ') || 'None'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unmapped Columns</p>
                    <p className="mt-2 text-sm text-slate-700">{unmappedColumns.length > 0 ? unmappedColumns.join(', ') : 'None'}</p>
                  </div>
                </div>

                {mappingWarnings.length > 0 && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                    {mappingWarnings.map((warning, index) => <p key={`${warning.type || 'warning'}-${index}`}>{warning.message || String(warning)}</p>)}
                  </div>
                )}
              </div>

              <h2 className="text-xl font-bold text-blue-900">Processed Item Preview</h2>
              <p className="mt-1 text-sm text-slate-600">Showing 1-{previewRows.length} of {totalRows} rows.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="rounded-xl bg-white p-4"><p className="text-xs font-semibold uppercase text-slate-500">Total Rows</p><p className="mt-2 text-3xl font-bold text-slate-950">{totalRows}</p></div>
                <div className="rounded-xl bg-white p-4"><p className="text-xs font-semibold uppercase text-slate-500">Valid Rows</p><p className="mt-2 text-3xl font-bold text-emerald-700">{validRows}</p></div>
                <div className="rounded-xl bg-white p-4"><p className="text-xs font-semibold uppercase text-slate-500">Errors</p><p className="mt-2 text-3xl font-bold text-red-700">{errorRows}</p></div>
              </div>
              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-blue-600 text-white">
                    <tr>
                      {['Part Number', 'Product Name', 'Quantity', 'Price', 'Status'].map((heading) => <th key={heading} className="px-4 py-3 text-xs font-bold uppercase tracking-wide">{heading}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {previewRows.map((row) => (
                      <tr key={row.row_number}>
                        <td className="px-4 py-3 font-semibold">{row.part_number || '-'}</td>
                        <td className="px-4 py-3">{row.product_name || '-'}</td>
                        <td className="px-4 py-3">{row.available_quantity ?? '-'}</td>
                        <td className="px-4 py-3">{row.unit_price !== null && row.unit_price !== undefined ? `${row.unit_price} ${row.currency || ''}`.trim() : '-'}</td>
                        <td className="px-4 py-3"><span title={row.validation_errors.join(', ')} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.validation_status === 'valid' ? 'bg-emerald-100 text-emerald-700' : row.validation_status === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{row.validation_status.replace(/\b\w/g, (char) => char.toUpperCase())}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <div className="flex flex-wrap justify-end gap-3">
            <Link href="/supplier/dashboard" className="site-button rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</Link>
            <Link href="/supplier/products" className="site-button rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50">Save & Continue</Link>
            <button type="button" disabled className="rounded-lg bg-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600">Import Valid Items</button>
          </div>
        </form>
      </div>
    </main>
  );
}
