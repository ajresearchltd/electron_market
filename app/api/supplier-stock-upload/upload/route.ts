import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createOpenAIClient, extractResponseText, loadAiConfig, resolveOpenAIKey } from '../../../../lib/ai/config';
import { createClient } from '../../../../lib/supabase/server';

const requiredFields = [
  'documentName',
  'supplierCompanyName',
  'contactPerson',
  'contactEmail',
  'defaultLeadTime',
];

const mainFields = ['part_number', 'unit_price', 'available_quantity', 'product_name', 'currency'];
const secondaryFields = [
  'manufacturer',
  'supplier_sku',
  'description',
  'package_case',
  'condition',
  'moq',
  'unit',
  'lead_time',
  'country_of_origin',
  'stock_location',
  'shipping_from',
  'incoterms',
  'datasheet_url',
  'product_video_url',
  'product_video_description',
  'warranty',
  'notes',
  'active',
];
const imageFields = Array.from({ length: 9 }, (_, index) => `product_image_url_${index + 1}`);

const synonyms: Record<string, string[]> = {
  part_number: ['partnumber', 'mpn', 'manufacturerpartnumber', 'pn', 'p/n', 'model', 'partno', 'itemno', '型号', '料号'],
  unit_price: ['price', 'unitprice', 'usdprice', 'eurprice', 'cnyprice', 'cost', 'quote', '单价', '价格'],
  available_quantity: ['qty', 'quantity', 'availableqty', 'availablequantity', 'stock', 'inventory', '库存', '数量'],
  product_name: ['productname', 'name', 'description', 'itemdescription', '商品名称', '品名'],
  currency: ['currency', 'curr', '币种'],
  manufacturer: ['manufacturer', 'brand', 'mfr', 'maker', '厂牌', '品牌'],
  supplier_sku: ['suppliersku', 'sku', 'offerid', 'supplierofferid'],
  description: ['description', 'itemdescription', 'desc'],
  package_case: ['packagecase', 'package', 'case'],
  condition: ['condition'],
  moq: ['moq', 'minimumorderquantity', 'minimumqty'],
  unit: ['unit', 'uom'],
  lead_time: ['leadtime', 'deliverytime'],
  country_of_origin: ['countryoforigin', 'origin'],
  stock_location: ['stocklocation', 'warehouse', 'location'],
  shipping_from: ['shippingfrom', 'shipfrom'],
  incoterms: ['incoterms', 'incoterm'],
  datasheet_url: ['datasheeturl', 'datasheet', 'datasheetlink'],
  product_image_url_1: ['productimageurl1', 'imageurl1', 'image1'],
  product_image_url_2: ['productimageurl2', 'imageurl2', 'image2'],
  product_image_url_3: ['productimageurl3', 'imageurl3', 'image3'],
  product_image_url_4: ['productimageurl4', 'imageurl4', 'image4'],
  product_image_url_5: ['productimageurl5', 'imageurl5', 'image5'],
  product_image_url_6: ['productimageurl6', 'imageurl6', 'image6'],
  product_image_url_7: ['productimageurl7', 'imageurl7', 'image7'],
  product_image_url_8: ['productimageurl8', 'imageurl8', 'image8'],
  product_image_url_9: ['productimageurl9', 'imageurl9', 'image9'],
  product_video_url: ['productvideourl', 'videourl'],
  product_video_description: ['productvideodescription', 'videodescription', 'videotitle'],
  warranty: ['warranty'],
  notes: ['notes', 'remark', 'remarks'],
  active: ['active', 'isactive'],
};

const normalizeHeader = (value: string) => value.toLowerCase().replace(/[\s_\-().:/\\]+/g, '');
const sanitizeFileName = (value: string) => value.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '') || 'stock-list';
const parseNumber = (value: unknown) => {
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};
const parseInteger = (value: unknown) => {
  const parsed = parseNumber(value);
  return parsed === null ? null : Math.round(parsed);
};

const columnPatternSummary = (headers: string[], sampleRows: Record<string, string>[]) => Object.fromEntries(
  headers.map((header) => {
    const values = sampleRows.map((row) => String(row[header] ?? '').trim()).filter(Boolean);
    const numericCount = values.filter((value) => parseNumber(value) !== null).length;
    const integerCount = values.filter((value) => /^-?\d+$/.test(value.replace(/,/g, ''))).length;
    const urlCount = values.filter((value) => /^https?:\/\//i.test(value)).length;
    const currencyCount = values.filter((value) => /^[A-Z]{3}$/.test(value)).length;
    const mostly = values.length === 0
      ? 'empty'
      : urlCount >= values.length / 2
        ? 'mostly URLs'
        : currencyCount >= values.length / 2
          ? 'mostly currency codes'
          : integerCount >= values.length / 2
            ? 'mostly integers'
            : numericCount >= values.length / 2
              ? 'mostly decimal numbers'
              : 'mostly text or mixed alphanumeric';
    return [header, { mostly, samples: values.slice(0, 3) }];
  })
);

const fallbackMap = (headers: string[]) => {
  const mainColumnMapping: Record<string, string | null> = {};
  const secondaryColumnMapping: Record<string, string | null> = {};
  const imageColumns: Array<{ field: string; column: string }> = [];
  const confidence: Record<string, number> = {};
  const usedColumns = new Set<string>();

  for (const [field, candidates] of Object.entries(synonyms)) {
    const match = headers.find((header) => {
      const normalized = normalizeHeader(header);
      return candidates.some((candidate) => normalized === normalizeHeader(candidate) || normalized.includes(normalizeHeader(candidate)));
    });
    if (match) {
      if (mainFields.includes(field)) mainColumnMapping[field] = match;
      if (secondaryFields.includes(field)) secondaryColumnMapping[field] = match;
      if (imageFields.includes(field)) imageColumns.push({ field, column: match });
      confidence[field] = 0.72;
      usedColumns.add(match);
    }
  }
  mainFields.forEach((field) => { if (!(field in mainColumnMapping)) mainColumnMapping[field] = null; });
  secondaryFields.forEach((field) => { if (!(field in secondaryColumnMapping)) secondaryColumnMapping[field] = null; });
  return {
    main_column_mapping: mainColumnMapping,
    secondary_column_mapping: secondaryColumnMapping,
    image_columns: imageColumns,
    unmapped_columns: headers.filter((header) => !usedColumns.has(header)),
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
        { type: 'fallback_parser', message: !apiKey ? 'OpenAI API key is not configured. Please configure it in Admin -> AI config. AI mapping was not available. Fallback parser was used.' : 'AI mapping is disabled. Fallback parser was used.', severity: 'warning' },
        ...(configError ? [{ type: 'ai_config', message: configError, severity: 'warning' }] : []),
      ],
    };
  }
  try {
    const openai = createOpenAIClient(apiKey);
    const response = await openai.responses.create({
      model: config.default_model,
      instructions: 'You return strict JSON only. Never include markdown.',
      input: `You are an AI data extraction assistant for a B2B electronic components marketplace.
You receive Excel/CSV column headers and sample rows from a supplier stock list.
Your task is Stage 1 column mapping only. Do not validate individual rows.
Priority: 1 part_number/MPN, 2 unit_price, 3 available_quantity, 4 product_name/description, 5 currency/status if available.
Map secondary fields after main fields. Put unknown columns into unmapped_columns.
Return strict JSON only with main_column_mapping, secondary_column_mapping, image_columns, unmapped_columns, confidence, warnings. Do not invent values. Return null for mappings not found.
Main fields: part_number, unit_price, available_quantity, product_name, currency.
Secondary fields: manufacturer, supplier_sku, package_case, condition, moq, lead_time, country_of_origin, stock_location, shipping_from, incoterms, datasheet_url, product_video_url, product_video_description, warranty, notes, active.
Headers: ${JSON.stringify(headers)}
Sample rows: ${JSON.stringify(sampleRows)}
Column pattern summary: ${JSON.stringify(columnPatternSummary(headers, sampleRows))}`,
    } as any);
    const parsed = parseJsonObject(extractResponseText(response));
    const mainColumnMapping = { ...fallback.main_column_mapping, ...(parsed.main_column_mapping ?? parsed.column_map ?? {}) };
    const secondaryColumnMapping = { ...fallback.secondary_column_mapping, ...(parsed.secondary_column_mapping ?? {}) };
    const imageColumns = Array.isArray(parsed.image_columns) ? parsed.image_columns : fallback.image_columns;
    const usedColumns = new Set([
      ...Object.values(mainColumnMapping).filter(Boolean),
      ...Object.values(secondaryColumnMapping).filter(Boolean),
      ...imageColumns.map((item: any) => item.column).filter(Boolean),
    ] as string[]);
    const mappingStatus = ['part_number', 'unit_price', 'available_quantity'].every((field) => mainColumnMapping[field]) ? 'completed' : 'error';
    return {
      main_column_mapping: mainColumnMapping,
      secondary_column_mapping: secondaryColumnMapping,
      image_columns: imageColumns,
      unmapped_columns: Array.isArray(parsed.unmapped_columns) ? parsed.unmapped_columns : headers.filter((header) => !usedColumns.has(header)),
      confidence: { ...fallback.confidence, ...(parsed.confidence ?? {}) },
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      ai_used: true,
      column_mapping_status: mappingStatus,
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
  return { headers, dataRows: rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']))) };
};

const parseFile = async (file: File) => {
  if (file.name.toLowerCase().endsWith('.csv')) return parseCsv(await file.text());
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error('The Excel file does not contain a worksheet.');
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheetName], { defval: '' });
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return { headers, dataRows: rows.map((row) => Object.fromEntries(headers.map((header) => [header, String(row[header] ?? '').trim()]))) };
};

const read = (row: Record<string, string>, columnMap: Record<string, string | null>, field: string) => {
  const column = columnMap[field];
  return column ? String(row[column] ?? '').trim() : '';
};

const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) return jsonError('Excel or CSV file is required.');
  const form = Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, typeof value === 'string' ? value : '']));
  const missing = requiredFields.filter((field) => !String(form[field] ?? '').trim());
  if (missing.length > 0) return jsonError(`Required fields missing: ${missing.join(', ')}.`);

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return jsonError('You must be signed in as a supplier to upload a product list.', 401);

  const { data: profile } = await supabase
    .from('supplier_company_profiles')
    .select('company_name, company_email, company_phone, main_contact_name, country_name')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  const supplierEmail = profile?.company_email || authData.user.email || String(form.contactEmail || '');
  const companyName = profile?.company_name || String(form.supplierCompanyName || 'Supplier Account');
  let supplierId = '';
  if (supplierEmail) {
    const { data: byEmail } = await supabase.from('suppliers').select('supplier_id').eq('contact_email', supplierEmail).maybeSingle();
    supplierId = byEmail?.supplier_id || '';
  }
  if (!supplierId) {
    const { data: byCompany } = await supabase.from('suppliers').select('supplier_id').eq('company_name', companyName).maybeSingle();
    supplierId = byCompany?.supplier_id || '';
  }
  if (!supplierId) {
    const { data, error } = await supabase
      .from('suppliers')
      .insert({
        supplier_name: companyName,
        company_name: companyName,
        contact_email: supplierEmail || null,
        email: supplierEmail || null,
        contact_phone: profile?.company_phone || form.contactPhone || null,
        contact_person: profile?.main_contact_name || form.contactPerson || null,
        country: profile?.country_name || form.supplierCountry || null,
        supplier_status: 'active',
      })
      .select('supplier_id')
      .single();
    if (error) return jsonError(`Supplier profile: ${error.message}`, 500);
    supplierId = data.supplier_id;
  }

  const storagePath = `supplier-stock-uploads/${authData.user.id}/${Date.now()}-${sanitizeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage.from('supplier-stock-uploads').upload(storagePath, file, {
    upsert: true,
    contentType: file.type || 'application/octet-stream',
  });
  if (uploadError) return jsonError(`File upload: ${uploadError.message}`, 500);

  const { headers, dataRows } = await parseFile(file);
  if (headers.length === 0 || dataRows.length === 0) return jsonError('The file does not contain product rows.');

  const { data: upload, error: uploadRowError } = await supabase
    .from('supplier_stock_uploads')
    .insert({
      supplier_id: supplierId,
      uploaded_by_user_id: authData.user.id,
      document_name: form.documentName,
      supplier_company_name: form.supplierCompanyName,
      contact_person: form.contactPerson,
      contact_email: form.contactEmail,
      contact_phone: form.contactPhone,
      supplier_country: form.supplierCountry,
      shipping_from_country: form.shippingFromCountry,
      default_currency: form.defaultCurrency,
      default_incoterms: form.defaultIncoterms,
      nktrs_classification: form.nktrsClassification,
      default_lead_time: form.defaultLeadTime,
      additional_notes: form.additionalNotes || null,
      original_file_name: file.name,
      file_url: storagePath,
      file_type: file.type || 'application/octet-stream',
      status: 'processing',
      ai_processing_status: 'processing',
    })
    .select('id')
    .single();
  if (uploadRowError) return jsonError(`supplier_stock_uploads: ${uploadRowError.message}`, 500);

  const mapping = await mapColumns(headers, dataRows.slice(0, 20));
  const mainColumnMapping = mapping.main_column_mapping ?? {};
  const secondaryColumnMapping = mapping.secondary_column_mapping ?? {};
  const imageColumnMapping = Object.fromEntries((mapping.image_columns ?? []).map((item: any) => [item.field, item.column]));
  const columnMap = { ...mainColumnMapping, ...secondaryColumnMapping, ...imageColumnMapping };
  const combinedColumnMapping = {
    main: mainColumnMapping,
    secondary: secondaryColumnMapping,
    image_columns: mapping.image_columns ?? [],
  };

  const mappingUpdate = await supabase
    .from('supplier_stock_uploads')
    .update({
      column_mapping: combinedColumnMapping,
      main_column_mapping: mainColumnMapping,
      secondary_column_mapping: secondaryColumnMapping,
      unmapped_columns: mapping.unmapped_columns ?? [],
      column_mapping_confidence: mapping.confidence ?? {},
      column_mapping_status: mapping.column_mapping_status ?? (mapping.ai_used ? 'completed' : 'fallback_used'),
      column_mapping_warnings: mapping.warnings ?? [],
    })
    .eq('id', upload.id);
  if (mappingUpdate.error) return jsonError(`supplier_stock_uploads column mapping: ${mappingUpdate.error.message}`, 500);

  const itemRows = dataRows.map((row, index) => {
    const partNumber = read(row, columnMap, 'part_number');
    const unitPrice = parseNumber(read(row, columnMap, 'unit_price'));
    const quantity = parseInteger(read(row, columnMap, 'available_quantity'));
    const productName = read(row, columnMap, 'product_name') || read(row, columnMap, 'description');
    const errors: string[] = [];
    if (!partNumber) errors.push('Missing Part Number');
    if (unitPrice === null) errors.push('Missing Price');
    if (quantity === null) errors.push('Missing Quantity');
    if (!productName) errors.push('Missing Product Name');
    const hardErrors = errors.some((item) => item !== 'Missing Product Name');
    return {
      upload_id: upload.id,
      row_number: index + 2,
      part_number: partNumber || null,
      manufacturer: read(row, columnMap, 'manufacturer') || null,
      supplier_sku: read(row, columnMap, 'supplier_sku') || null,
      product_name: productName || null,
      description: read(row, columnMap, 'description') || null,
      package_case: read(row, columnMap, 'package_case') || null,
      condition: read(row, columnMap, 'condition') || null,
      available_quantity: quantity,
      moq: parseInteger(read(row, columnMap, 'moq')),
      unit: read(row, columnMap, 'unit') || 'pcs',
      unit_price: unitPrice,
      currency: read(row, columnMap, 'currency') || String(form.defaultCurrency || 'USD'),
      lead_time: read(row, columnMap, 'lead_time') || form.defaultLeadTime || null,
      country_of_origin: read(row, columnMap, 'country_of_origin') || null,
      shipping_from: form.shippingFromCountry || null,
      incoterms: form.defaultIncoterms || null,
      datasheet_url: read(row, columnMap, 'datasheet_url') || null,
      product_image_url_1: read(row, columnMap, 'product_image_url_1') || null,
      product_image_url_2: read(row, columnMap, 'product_image_url_2') || null,
      product_image_url_3: read(row, columnMap, 'product_image_url_3') || null,
      product_image_url_4: read(row, columnMap, 'product_image_url_4') || null,
      product_image_url_5: read(row, columnMap, 'product_image_url_5') || null,
      product_image_url_6: read(row, columnMap, 'product_image_url_6') || null,
      product_image_url_7: read(row, columnMap, 'product_image_url_7') || null,
      product_image_url_8: read(row, columnMap, 'product_image_url_8') || null,
      product_image_url_9: read(row, columnMap, 'product_image_url_9') || null,
      product_video_url: read(row, columnMap, 'product_video_url') || null,
      product_video_description: read(row, columnMap, 'product_video_description') || null,
      notes: read(row, columnMap, 'notes') || null,
      active: !['false', 'no', '0'].includes(read(row, columnMap, 'active').toLowerCase()),
      validation_status: hardErrors ? 'error' : errors.length > 0 ? 'warning' : 'valid',
      validation_errors: errors,
      ai_confidence: mapping.confidence ?? {},
      raw_row_json: row,
      import_status: 'pending',
    };
  });

  const { error: itemError } = await supabase.from('supplier_stock_upload_items').insert(itemRows);
  if (itemError) return jsonError(`supplier_stock_upload_items: ${itemError.message}`, 500);

  const validRows = itemRows.filter((row) => row.validation_status === 'valid').length;
  const errorRows = itemRows.filter((row) => row.validation_status === 'error').length;
  await supabase
    .from('supplier_stock_uploads')
    .update({
      total_rows: itemRows.length,
      valid_rows: validRows,
      error_rows: errorRows,
      status: errorRows > 0 ? 'validated_with_errors' : 'validated',
      ai_processing_status: mapping.ai_used ? 'completed' : 'fallback_used',
      ai_processing_error: Array.isArray(mapping.warnings) ? mapping.warnings.map((warning: any) => typeof warning === 'string' ? warning : warning.message).filter(Boolean).join(' ') : null,
    })
    .eq('id', upload.id);

  return NextResponse.json({
    upload_id: upload.id,
    total_rows: itemRows.length,
    valid_rows: validRows,
    error_rows: errorRows,
    ai_used: mapping.ai_used,
    warnings: mapping.warnings ?? [],
    main_column_mapping: mainColumnMapping,
    secondary_column_mapping: secondaryColumnMapping,
    unmapped_columns: mapping.unmapped_columns ?? [],
    column_mapping_confidence: mapping.confidence ?? {},
    column_mapping_status: mapping.column_mapping_status ?? (mapping.ai_used ? 'completed' : 'fallback_used'),
    preview_rows: itemRows.slice(0, 10).map((row) => ({
      row_number: row.row_number,
      part_number: row.part_number,
      product_name: row.product_name,
      available_quantity: row.available_quantity,
      unit_price: row.unit_price,
      currency: row.currency,
      validation_status: row.validation_status,
      validation_errors: row.validation_errors,
    })),
  });
}
