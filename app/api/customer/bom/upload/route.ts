import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createOpenAIClient, extractResponseText, loadAiConfig, resolveOpenAIKey } from '../../../../../lib/ai/config';
import { createProgressFromBomUpload, isMissingProgressTableError } from '../../../../../lib/procurement-progress/progress';
import { normalizeProcurementPreferences } from '../../../../../lib/procurement-preferences';
import { createClient } from '../../../../../lib/supabase/server';

const requiredFields = ['documentName'];

const mainFields = ['part_number', 'manufacturer', 'quantity', 'description'];
const secondaryFields = [
  'line_number',
  'manufacturer_part_number',
  'product_name',
  'specification',
  'package_case',
  'unit',
  'target_unit_price',
  'target_currency',
  'acceptable_alternatives',
  'date_code_requirement',
  'rohs_required',
  'reach_required',
  'datasheet_url',
  'notes',
];

const synonyms: Record<string, string[]> = {
  part_number: ['part number', 'mpn', 'manufacturer part number', 'mfr part number', 'pn', 'p/n', 'item code', 'code', 'model', 'component', 'detali nomer', 'nomer detali'],
  manufacturer: ['manufacturer', 'mfr', 'brand', 'maker', 'proizvoditel'],
  quantity: ['qty', 'quantity', 'amount', 'required qty', 'zakaz', 'kolichestvo'],
  description: ['description', 'product name', 'item', 'detail', 'specification', 'opisanie', 'naimenovanie'],
  target_unit_price: ['price', 'target price', 'unit price', 'budget price'],
  line_number: ['line', 'line number', 'item no', 'no'],
  manufacturer_part_number: ['manufacturer part number', 'mfr part number', 'mpn'],
  product_name: ['product name', 'name', 'item name'],
  specification: ['specification', 'spec', 'technical requirements'],
  package_case: ['package', 'case', 'package case'],
  unit: ['unit', 'uom'],
  target_currency: ['currency', 'curr'],
  acceptable_alternatives: ['alternatives', 'acceptable alternatives', 'substitute'],
  date_code_requirement: ['date code', 'date code requirement'],
  rohs_required: ['rohs', 'rohs required'],
  reach_required: ['reach', 'reach required'],
  datasheet_url: ['datasheet', 'datasheet url', 'datasheet link'],
  notes: ['notes', 'remark', 'remarks', 'comment'],
};

const normalizeHeader = (value: string) => value.toLowerCase().replace(/[\s_\-().:/\\]+/g, '');
const sanitizeFileName = (value: string) => value.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '') || 'bom-list';
const normalizePartNumber = (value: string) => value.trim().replace(/\s+/g, '').toUpperCase();
const headerKeywords = [
  'partnumber',
  'mpn',
  'manufacturer',
  'mfr',
  'quantity',
  'qty',
  'description',
  'productname',
  'linenumber',
  'package',
  'unit',
  'specification',
];
const isFakeColumnName = (value: unknown) => {
  const text = String(value ?? '').trim();
  return !text || /^__EMPTY/i.test(text) || text.toLowerCase() === 'null' || text.toLowerCase() === 'undefined';
};
const isLikelyTitleColumn = (value: unknown) => {
  const text = String(value ?? '').trim();
  const normalized = normalizeHeader(text);
  return text.length > 28 && !headerKeywords.some((keyword) => normalized.includes(keyword));
};
const isMeaningfulColumnName = (value: unknown) => !isFakeColumnName(value) && !isLikelyTitleColumn(value);
const parseNumber = (value: unknown) => {
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};
const parseBoolean = (value: unknown) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return null;
  if (['yes', 'true', '1', 'y', 'required'].includes(normalized)) return true;
  if (['no', 'false', '0', 'n', 'not required'].includes(normalized)) return false;
  return null;
};

const detectHeaderRowIndex = (rows: string[][]) => {
  let bestIndex = -1;
  let bestScore = 0;
  rows.forEach((row, index) => {
    const cells = row.map((cell) => String(cell ?? '').trim()).filter(Boolean);
    if (cells.length === 0) return;
    const score = cells.reduce((total, cell) => {
      const normalized = normalizeHeader(cell);
      const keywordHits = headerKeywords.filter((keyword) => normalized === keyword || normalized.includes(keyword)).length;
      return total + keywordHits;
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  if (bestIndex !== -1 && bestScore > 0) return bestIndex;
  return rows.findIndex((row) => row.some((cell) => String(cell ?? '').trim()));
};

const makeUniqueHeaders = (headerRow: string[]) => {
  const seen = new Map<string, number>();
  return headerRow.map((rawHeader, index) => {
    const header = String(rawHeader ?? '').trim();
    const base = isMeaningfulColumnName(header) ? header : `column_${index + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
};

const rowsToObjects = (rows: string[][]) => {
  const nonEmptyRows = rows.filter((row) => row.some((cell) => String(cell ?? '').trim()));
  const headerIndex = detectHeaderRowIndex(nonEmptyRows);
  if (headerIndex === -1) return { headers: [], dataRows: [], firstDataRowNumber: 1 };
  const headers = makeUniqueHeaders(nonEmptyRows[headerIndex]);
  const dataRows = nonEmptyRows.slice(headerIndex + 1)
    .filter((row) => row.some((cell) => String(cell ?? '').trim()))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, String(cells[index] ?? '').trim()])));
  return { headers, dataRows, firstDataRowNumber: headerIndex + 2 };
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
  return rowsToObjects(rows);
};

const parseFile = async (file: File) => {
  if (file.name.toLowerCase().endsWith('.csv')) return parseCsv(await file.text());
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error('The Excel file does not contain a worksheet.');
  const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[firstSheetName], { header: 1, defval: '', blankrows: false });
  return rowsToObjects(rows);
};

const sanitizeMappingObject = (mapping: Record<string, unknown>, headers: string[]) => {
  const headerSet = new Set(headers.filter(isMeaningfulColumnName));
  return Object.fromEntries(Object.entries(mapping).map(([field, column]) => {
    const value = String(column ?? '').trim();
    return [field, value && headerSet.has(value) && isMeaningfulColumnName(value) ? value : null];
  })) as Record<string, string | null>;
};

const sanitizeUnmappedColumns = (columns: unknown[], headers: string[]) => {
  const headerSet = new Set(headers.filter(isMeaningfulColumnName));
  return columns.map((column) => String(column ?? '').trim()).filter((column) => headerSet.has(column) && isMeaningfulColumnName(column));
};

const columnPatternSummary = (headers: string[], sampleRows: Record<string, string>[]) => Object.fromEntries(
  headers.map((header) => {
    const values = sampleRows.map((row) => String(row[header] ?? '').trim()).filter(Boolean);
    const numericCount = values.filter((value) => parseNumber(value) !== null).length;
    const urlCount = values.filter((value) => /^https?:\/\//i.test(value)).length;
    const mostly = values.length === 0 ? 'empty' : urlCount >= values.length / 2 ? 'mostly URLs' : numericCount >= values.length / 2 ? 'mostly numbers' : 'mostly text or mixed alphanumeric';
    return [header, { mostly, samples: values.slice(0, 3) }];
  })
);

const fallbackMap = (headers: string[]) => {
  const mainColumnMapping: Record<string, string | null> = {};
  const secondaryColumnMapping: Record<string, string | null> = {};
  const confidence: Record<string, number> = {};
  const usedColumns = new Set<string>();

  for (const [field, candidates] of Object.entries(synonyms)) {
    const match = headers.find((header) => {
      const normalized = normalizeHeader(header);
      return candidates.some((candidate) => normalized === normalizeHeader(candidate) || normalized.includes(normalizeHeader(candidate)));
    });
    if (!match) continue;
    if (mainFields.includes(field)) mainColumnMapping[field] = match;
    if (secondaryFields.includes(field)) secondaryColumnMapping[field] = match;
    confidence[field] = 0.72;
    usedColumns.add(match);
  }

  mainFields.forEach((field) => { if (!(field in mainColumnMapping)) mainColumnMapping[field] = null; });
  secondaryFields.forEach((field) => { if (!(field in secondaryColumnMapping)) secondaryColumnMapping[field] = null; });

  return {
    main_column_mapping: mainColumnMapping,
    secondary_column_mapping: secondaryColumnMapping,
    unmapped_columns: headers.filter((header) => !usedColumns.has(header) && isMeaningfulColumnName(header)),
    confidence,
    warnings: [{ type: 'fallback_parser', message: 'Fallback parser was used.', severity: 'warning' }],
  };
};

const parseJsonObject = (text: string) => {
  const trimmed = text.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('AI response was not JSON.');
  return JSON.parse(trimmed.slice(start, end + 1));
};

const mapColumns = async (headers: string[], sampleRows: Record<string, string>[]) => {
  const fallback = fallbackMap(headers);
  const { config, error: configError } = await loadAiConfig();
  let apiKey = '';
  try {
    apiKey = resolveOpenAIKey(config);
  } catch {
    apiKey = '';
  }

  if (!config.is_enabled || !apiKey) {
    return {
      ...fallback,
      ai_used: false,
      column_mapping_status: 'fallback_used',
      warnings: [
        { type: 'fallback_parser', message: !apiKey ? 'OpenAI API key is not configured. Fallback parser was used.' : 'AI mapping is disabled. Fallback parser was used.', severity: 'warning' },
        ...(configError ? [{ type: 'ai_config', message: configError, severity: 'warning' }] : []),
      ],
    };
  }

  try {
    const openai = createOpenAIClient(apiKey);
    const response = await openai.responses.create({
      model: config.default_model,
      instructions: 'You return strict JSON only. Never include markdown.',
      input: `You are an AI data extraction assistant for customer BOM uploads in an electronics marketplace.
This is Stage 1 document-level column mapping only. Do not decide mappings per row. Do not invent prices, suppliers, stock, or lead times.
Return strict JSON only with main_column_mapping, secondary_column_mapping, unmapped_columns, confidence, warnings.
Main fields: part_number, manufacturer, quantity, description.
Secondary fields: line_number, manufacturer_part_number, product_name, specification, package_case, unit, target_unit_price, target_currency, acceptable_alternatives, date_code_requirement, rohs_required, reach_required, datasheet_url, notes.
Headers: ${JSON.stringify(headers)}
Sample rows: ${JSON.stringify(sampleRows)}
Column pattern summary: ${JSON.stringify(columnPatternSummary(headers, sampleRows))}`,
    } as any);
    const parsed = parseJsonObject(extractResponseText(response));
    const mainColumnMapping = sanitizeMappingObject({ ...fallback.main_column_mapping, ...(parsed.main_column_mapping ?? parsed.column_map ?? {}) }, headers);
    const secondaryColumnMapping = sanitizeMappingObject({ ...fallback.secondary_column_mapping, ...(parsed.secondary_column_mapping ?? {}) }, headers);
    const usedColumns = new Set([
      ...Object.values(mainColumnMapping).filter(Boolean),
      ...Object.values(secondaryColumnMapping).filter(Boolean),
    ] as string[]);
    return {
      main_column_mapping: mainColumnMapping,
      secondary_column_mapping: secondaryColumnMapping,
      unmapped_columns: Array.isArray(parsed.unmapped_columns) ? sanitizeUnmappedColumns(parsed.unmapped_columns, headers) : headers.filter((header) => !usedColumns.has(header) && isMeaningfulColumnName(header)),
      confidence: { ...fallback.confidence, ...(parsed.confidence ?? {}) },
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      ai_used: true,
      column_mapping_status: ['part_number', 'quantity'].every((field) => mainColumnMapping[field]) ? 'completed' : 'fallback_used',
    };
  } catch (error) {
    return {
      ...fallback,
      ai_used: false,
      column_mapping_status: 'fallback_used',
      warnings: [{ type: 'fallback_parser', message: `AI mapping failed, fallback parser was used. ${error instanceof Error ? error.message : ''}`.trim(), severity: 'warning' }],
    };
  }
};

const read = (row: Record<string, string>, columnMap: Record<string, string | null>, field: string) => {
  const column = columnMap[field];
  return column ? String(row[column] ?? '').trim() : '';
};

const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) return jsonError('Excel or CSV BOM file is required.');
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!['csv', 'xls', 'xlsx'].includes(extension || '')) return jsonError('Please choose a .csv, .xls, or .xlsx file.');
  if (file.size > 20 * 1024 * 1024) return jsonError('File size must be 20MB or smaller.');

  const form = Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, typeof value === 'string' ? value : '']));
  let orderPreferences;
  try { orderPreferences = normalizeProcurementPreferences(JSON.parse(String(form.orderPreferences || '{}'))); }
  catch (error) { return jsonError(error instanceof Error ? error.message : 'Invalid order preferences.'); }
  const hasDeliveryOrLeadTime = Boolean(String(form.requiredDeliveryDate || form.defaultLeadTime || '').trim());
  const missing = requiredFields.filter((field) => !String(form[field] ?? '').trim());
  if (!hasDeliveryOrLeadTime) missing.push('requiredDeliveryDate');
  if (missing.length > 0) return jsonError(`Required fields missing: ${missing.join(', ')}.`);

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return jsonError('You must be signed in as a customer to upload a BOM.', 401);

  const { data: profile } = await supabase
    .from('customer_company_profiles')
    .select('id, company_name, contact_person, contact_name, contact_email, phone, contact_phone, country, country_name')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('email, full_name, company_name')
    .eq('id', authData.user.id)
    .maybeSingle();
  const customerCompanyName = profile?.company_name || userProfile?.company_name || 'Not filled';
  const contactPerson = profile?.contact_person || profile?.contact_name || userProfile?.full_name || authData.user.user_metadata?.full_name || 'Not filled';
  const contactEmail = profile?.contact_email || userProfile?.email || authData.user.email || '';
  const contactPhone = profile?.phone || profile?.contact_phone || null;

  const storagePath = `${authData.user.id}/${Date.now()}-${sanitizeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage.from('customer-bom-files').upload(storagePath, file, {
    upsert: true,
    contentType: file.type || 'application/octet-stream',
  });
  if (uploadError) return jsonError(`File upload: ${uploadError.message}`, 500);

  const { headers, dataRows, firstDataRowNumber } = await parseFile(file);
  if (headers.length === 0 || dataRows.length === 0) return jsonError('The file does not contain BOM rows.');

  const { data: upload, error: uploadRowError } = await supabase
    .from('customer_bom_uploads')
    .insert({
      user_id: authData.user.id,
      customer_profile_id: profile?.id || null,
      document_name: form.documentName,
      customer_company_name: customerCompanyName,
      contact_person: contactPerson,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      project_name: form.projectName || null,
      project_description: form.projectDescription || null,
      destination_country: form.destinationCountry || null,
      required_delivery_date: form.requiredDeliveryDate || null,
      target_budget: parseNumber(form.targetBudget),
      budget_currency: form.budgetCurrency || 'USD',
      preferred_incoterms: form.preferredIncoterms || null,
      preferred_origin_country: form.preferredOriginCountry || null,
      authorized_suppliers_only: form.authorizedSuppliersOnly === 'true',
      allow_substitutes: form.allowSubstitutes === 'true',
      manufacturers_only: form.manufacturersOnly === 'true',
      original_file_name: file.name,
      file_url: storagePath,
      file_path: storagePath,
      file_type: file.type || 'application/octet-stream',
      status: 'processing',
      ai_processing_status: 'mapping',
      notes: form.additionalNotes || null,
    })
    .select('id')
    .single();
  if (uploadRowError) return jsonError(`customer_bom_uploads: ${uploadRowError.message}`, 500);

  const mapping = await mapColumns(headers, dataRows.slice(0, 20));
  const mainColumnMapping = sanitizeMappingObject(mapping.main_column_mapping ?? {}, headers);
  const secondaryColumnMapping = sanitizeMappingObject(mapping.secondary_column_mapping ?? {}, headers);
  const columnMap = { ...mainColumnMapping, ...secondaryColumnMapping };
  const combinedColumnMapping = { main: mainColumnMapping, secondary: secondaryColumnMapping };

  await supabase
    .from('customer_bom_uploads')
    .update({
      column_mapping: combinedColumnMapping,
      main_column_mapping: mainColumnMapping,
      secondary_column_mapping: secondaryColumnMapping,
      unmapped_columns: sanitizeUnmappedColumns(mapping.unmapped_columns ?? [], headers),
      column_mapping_confidence: mapping.confidence ?? {},
      column_mapping_warnings: mapping.warnings ?? [],
      ai_processing_status: 'normalizing',
    })
    .eq('id', upload.id)
    .eq('user_id', authData.user.id);

  const itemRows = dataRows.map((row, index) => {
    const partNumber = read(row, columnMap, 'part_number') || read(row, columnMap, 'manufacturer_part_number');
    const quantity = parseNumber(read(row, columnMap, 'quantity'));
    const manufacturer = read(row, columnMap, 'manufacturer');
    const description = read(row, columnMap, 'description') || read(row, columnMap, 'product_name') || read(row, columnMap, 'specification');
    const warnings: string[] = [];
    const errors: string[] = [];
    if (!partNumber) errors.push('Missing Part Number');
    if (quantity === null) errors.push('Missing Quantity');
    if (partNumber && /^[0-9.,$€£\s]+$/.test(partNumber)) warnings.push('Part number looks like a price or numeric-only value.');
    if (!manufacturer) warnings.push('Missing Manufacturer');
    if (!description) warnings.push('Missing Description');
    if (quantity !== null && (quantity <= 0 || quantity > 100000000)) warnings.push('Suspicious Quantity');
    const validationStatus = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid';
    return {
      upload_id: upload.id,
      user_id: authData.user.id,
      row_number: firstDataRowNumber + index,
      line_number: read(row, columnMap, 'line_number') || null,
      part_number: partNumber || null,
      normalized_part_number: partNumber ? normalizePartNumber(partNumber) : null,
      manufacturer: manufacturer || null,
      manufacturer_part_number: read(row, columnMap, 'manufacturer_part_number') || null,
      product_name: read(row, columnMap, 'product_name') || null,
      description: description || null,
      specification: read(row, columnMap, 'specification') || null,
      package_case: read(row, columnMap, 'package_case') || null,
      quantity,
      unit: read(row, columnMap, 'unit') || 'pcs',
      target_unit_price: parseNumber(read(row, columnMap, 'target_unit_price')),
      target_currency: read(row, columnMap, 'target_currency') || String(form.budgetCurrency || 'USD'),
      acceptable_alternatives: read(row, columnMap, 'acceptable_alternatives') || null,
      allow_substitute: form.allowSubstitutes === 'true' || Boolean(read(row, columnMap, 'acceptable_alternatives')),
      authorized_suppliers_only: form.authorizedSuppliersOnly === 'true',
      preferred_origin_country: form.preferredOriginCountry || null,
      date_code_requirement: read(row, columnMap, 'date_code_requirement') || null,
      rohs_required: parseBoolean(read(row, columnMap, 'rohs_required')),
      reach_required: parseBoolean(read(row, columnMap, 'reach_required')),
      datasheet_url: read(row, columnMap, 'datasheet_url') || null,
      notes: read(row, columnMap, 'notes') || null,
      customer_comment: null,
      ai_normalized_json: { ai_used_for_mapping: mapping.ai_used, normalized_by: 'document_mapping' },
      ai_detected_issues: [...errors, ...warnings],
      suggested_corrections: {},
      validation_status: validationStatus,
      validation_errors: errors,
      validation_warnings: warnings,
      part_number_check_status: 'not_checked',
      part_number_check_message: 'Part number has not been verified yet.',
      part_number_check_source: null,
      import_status: 'pending',
      raw_row_json: row,
    };
  });

  const { data: savedItems, error: itemError } = await supabase
    .from('customer_bom_upload_items')
    .insert(itemRows)
    .select('id, row_number');
  if (itemError) return jsonError(`customer_bom_upload_items: ${itemError.message}`, 500);
  const itemIdsByRowNumber = new Map((savedItems ?? []).map((item) => [item.row_number, item.id]));

  const validRows = itemRows.filter((row) => row.validation_status === 'valid').length;
  const warningRows = itemRows.filter((row) => row.validation_status === 'warning').length;
  const errorRows = itemRows.filter((row) => row.validation_status === 'error').length;
  await supabase
    .from('customer_bom_uploads')
    .update({
      total_rows: itemRows.length,
      valid_rows: validRows,
      warning_rows: warningRows,
      error_rows: errorRows,
      status: errorRows > 0 ? 'normalized' : 'ready_for_rfq',
      ai_processing_status: errorRows > 0 || warningRows > 0 ? 'completed_with_warnings' : 'completed',
      ai_summary: Array.isArray(mapping.warnings) ? mapping.warnings.map((warning: any) => typeof warning === 'string' ? warning : warning.message).filter(Boolean).join(' ') : null,
    })
    .eq('id', upload.id)
    .eq('user_id', authData.user.id);

  let progressWarning = '';
  let procurementNumber = '';
  let procurementChainId = '';
  try {
    const progressResult = await createProgressFromBomUpload(supabase, {
      id: upload.id,
      user_id: authData.user.id,
      document_name: form.documentName,
      original_file_name: file.name,
      customer_company_name: customerCompanyName,
    });
    if (progressResult.error && !isMissingProgressTableError(progressResult.error.message)) {
      progressWarning = progressResult.error.message;
    }
    procurementNumber = progressResult.data?.procurement_number || '';
    procurementChainId = progressResult.data?.procurement_chain_id || progressResult.data?.procurement_case_id || '';
  } catch (progressError) {
    progressWarning = progressError instanceof Error ? progressError.message : 'Progress record was not created.';
  }

  let preferenceWarning = '';
  if (!procurementChainId) preferenceWarning = 'BOM uploaded, but order preferences cannot be linked until the procurement chain is available.';
  else {
    if (orderPreferences.supplier_countries.length) {
      const { data: countries } = await supabase.from('countries').select('iso2').in('iso2', orderPreferences.supplier_countries);
      if (new Set((countries || []).map((row:any)=>String(row.iso2).toUpperCase())).size !== orderPreferences.supplier_countries.length) preferenceWarning = 'BOM uploaded, but one or more selected supplier countries are invalid.';
    }
    if (!preferenceWarning) {
      const { error: preferenceError } = await supabase.from('procurement_order_preferences').upsert({ ...orderPreferences, procurement_chain_id: procurementChainId, bom_upload_id: upload.id, customer_user_id: authData.user.id }, { onConflict: 'procurement_chain_id' });
      if (preferenceError) preferenceWarning = `BOM uploaded, but preferences were not saved: ${preferenceError.message}`;
    }
  }

  return NextResponse.json({
    upload_id: upload.id,
    total_rows: itemRows.length,
    valid_rows: validRows,
    warning_rows: warningRows,
    error_rows: errorRows,
    ai_used: mapping.ai_used,
    warnings: mapping.warnings ?? [],
    main_column_mapping: mainColumnMapping,
    secondary_column_mapping: secondaryColumnMapping,
    unmapped_columns: sanitizeUnmappedColumns(mapping.unmapped_columns ?? [], headers),
    column_mapping_confidence: mapping.confidence ?? {},
    procurement_chain_id: procurementChainId,
    procurement_number: procurementNumber,
    progress_warning: progressWarning,
    preference_warning: preferenceWarning,
    preview_rows: itemRows.slice(0, 10).map((row) => ({
      id: itemIdsByRowNumber.get(row.row_number) || null,
      row_number: row.row_number,
      part_number: row.part_number,
      manufacturer: row.manufacturer,
      quantity: row.quantity,
      description: row.description,
      validation_status: row.validation_status,
      validation_errors: row.validation_errors,
      validation_warnings: row.validation_warnings,
    })),
  });
}
