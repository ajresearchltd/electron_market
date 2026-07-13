import { NextRequest, NextResponse } from 'next/server';
import { createOpenAIClient, extractResponseText, loadAiConfig, resolveOpenAIKey } from '../../../../lib/ai/config';

type MappingRequest = {
  headers?: string[];
  sampleRows?: Record<string, string>[];
};

const mainFields = ['part_number', 'unit_price', 'available_quantity', 'product_name', 'currency'];
const secondaryFields = ['manufacturer', 'supplier_sku', 'package_case', 'condition', 'moq', 'lead_time', 'country_of_origin', 'stock_location', 'shipping_from', 'incoterms', 'datasheet_url', 'product_video_url', 'product_video_description', 'warranty', 'notes', 'active'];
const imageFields = Array.from({ length: 9 }, (_, index) => `product_image_url_${index + 1}`);

const synonyms: Record<string, string[]> = {
  part_number: ['partnumber', 'mpn', 'manufacturerpartnumber', 'pn', 'p/n', 'model', 'partno', 'itemno', '型号', '料号'],
  unit_price: ['price', 'unitprice', 'usdprice', 'eurprice', 'cnyprice', 'cost', 'quote', '单价', '价格'],
  available_quantity: ['qty', 'quantity', 'availableqty', 'availablequantity', 'stock', 'inventory', '库存', '数量'],
  product_name: ['productname', 'name', 'description', 'itemdescription', '商品名称', '品名'],
  currency: ['currency', 'curr', '币种'],
  manufacturer: ['manufacturer', 'brand', 'mfr', 'maker', '厂牌', '品牌'],
  supplier_sku: ['suppliersku', 'sku', 'offerid', 'supplierofferid'],
  package_case: ['packagecase', 'package', 'case'],
  condition: ['condition'],
  moq: ['moq', 'minimumorderquantity', 'minimumqty'],
  lead_time: ['leadtime', 'deliverytime'],
  country_of_origin: ['countryoforigin', 'origin'],
  stock_location: ['stocklocation', 'warehouse', 'location'],
  shipping_from: ['shippingfrom', 'shipfrom'],
  incoterms: ['incoterms', 'incoterm'],
  datasheet_url: ['datasheeturl', 'datasheet', 'datasheetlink'],
  product_video_url: ['productvideourl', 'videourl', 'youtubeurl', 'demovideo', '视频链接'],
  product_video_description: ['productvideodescription', 'videodescription', 'videotitle'],
  warranty: ['warranty'],
  notes: ['notes', 'remark', 'remarks'],
  active: ['active', 'isactive'],
  ...Object.fromEntries(imageFields.map((field, index) => [field, [`productimageurl${index + 1}`, `imageurl${index + 1}`, `image${index + 1}`]])),
};

const normalizeHeader = (value: string) => value.toLowerCase().replace(/[\s_\-().:/\\]+/g, '');
const parseNumber = (value: unknown) => {
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};

const columnPatternSummary = (headers: string[], sampleRows: Record<string, string>[]) => Object.fromEntries(
  headers.map((header) => {
    const values = sampleRows.map((row) => String(row[header] ?? '').trim()).filter(Boolean);
    const numericCount = values.filter((value) => parseNumber(value) !== null).length;
    const urlCount = values.filter((value) => /^https?:\/\//i.test(value)).length;
    const currencyCount = values.filter((value) => /^[A-Z]{3}$/.test(value)).length;
    const mostly = values.length === 0 ? 'empty' : urlCount >= values.length / 2 ? 'mostly URLs' : currencyCount >= values.length / 2 ? 'mostly currency codes' : numericCount >= values.length / 2 ? 'mostly numbers' : 'mostly text or mixed alphanumeric';
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
    const match = headers.find((header) => candidates.some((candidate) => {
      const normalized = normalizeHeader(header);
      const normalizedCandidate = normalizeHeader(candidate);
      return normalized === normalizedCandidate || normalized.includes(normalizedCandidate);
    }));
    if (!match) continue;
    if (mainFields.includes(field)) mainColumnMapping[field] = match;
    if (secondaryFields.includes(field)) secondaryColumnMapping[field] = match;
    if (imageFields.includes(field)) imageColumns.push({ field, column: match });
    confidence[field] = 0.72;
    usedColumns.add(match);
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

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as MappingRequest;
  const headers = (body.headers ?? []).map(String).filter(Boolean);
  const sampleRows = (body.sampleRows ?? []).slice(0, 20);
  if (headers.length === 0) return NextResponse.json({ error: 'Headers are required.' }, { status: 400 });

  const fallback = fallbackMap(headers);
  const { config, error: configError } = await loadAiConfig();
  let apiKey = '';
  try {
    apiKey = resolveOpenAIKey(config);
  } catch {
    apiKey = '';
  }

  if (!config.is_enabled || !apiKey) {
    return NextResponse.json({
      ...fallback,
      ai_used: false,
      column_mapping_status: 'fallback_used',
      warnings: [
        { type: 'fallback_parser', message: !apiKey ? 'OpenAI API key is not configured. Please configure it in Admin -> AI config. AI mapping was not available. Fallback parser was used.' : 'AI mapping is disabled. Fallback parser was used.', severity: 'warning' },
        ...(configError ? [{ type: 'ai_config', message: configError, severity: 'warning' }] : []),
      ],
    });
  }

  try {
    const openai = createOpenAIClient(apiKey);
    const response = await openai.responses.create({
      model: config.default_model,
      instructions: 'You return strict JSON only. Never include markdown.',
      input: `You are an AI data extraction assistant for a B2B electronic components marketplace.
This is Stage 1 column mapping only. Do not validate individual rows.
Priority: 1 part_number/MPN, 2 unit_price, 3 available_quantity, 4 product_name/description, 5 currency/status if available.
Return strict JSON only with main_column_mapping, secondary_column_mapping, image_columns, unmapped_columns, confidence, warnings.
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
    return NextResponse.json({
      main_column_mapping: mainColumnMapping,
      secondary_column_mapping: secondaryColumnMapping,
      image_columns: imageColumns,
      unmapped_columns: Array.isArray(parsed.unmapped_columns) ? parsed.unmapped_columns : headers.filter((header) => !usedColumns.has(header)),
      confidence: { ...fallback.confidence, ...(parsed.confidence ?? {}) },
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      ai_used: true,
      column_mapping_status: ['part_number', 'unit_price', 'available_quantity'].every((field) => mainColumnMapping[field]) ? 'completed' : 'error',
    });
  } catch (error) {
    return NextResponse.json({
      ...fallback,
      ai_used: false,
      column_mapping_status: 'fallback_used',
      warnings: [{ type: 'fallback_parser', message: `AI mapping failed, fallback parser was used. ${error instanceof Error ? error.message : ''}`.trim(), severity: 'warning' }],
    });
  }
}
