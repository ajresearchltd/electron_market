import { searchNexarByPartNumber } from '../market-data/nexar';

export type PartNumberCheckStatus =
  | 'not_checked'
  | 'found_internal'
  | 'found_octopart_exact'
  | 'found_exact'
  | 'found_octopart_possible'
  | 'manufacturer_mismatch'
  | 'ambiguous'
  | 'needs_review'
  | 'suspicious_format'
  | 'not_found'
  | 'invalid_format'
  | 'error';

export type PartNumberVerificationResult = {
  status: PartNumberCheckStatus;
  message: string;
  source: string;
  confidence: number | null;
  matched_mpn: string | null;
  matched_manufacturer: string | null;
  matched_description: string | null;
  datasheet_url: string | null;
  raw_json: Record<string, unknown>;
};

type SupabaseLike = {
  from: (table: string) => any;
};

const normalizePartNumber = (value: string) => value.trim().replace(/\s+/g, '').toUpperCase();
const normalizeManufacturer = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();

const invalid = (message: string): PartNumberVerificationResult => ({
  status: 'invalid_format',
  message,
  source: 'format_check',
  confidence: 0,
  matched_mpn: null,
  matched_manufacturer: null,
  matched_description: null,
  datasheet_url: null,
  raw_json: { reason: message },
});

const suspicious = (message: string): PartNumberVerificationResult => ({
  status: 'suspicious_format',
  message,
  source: 'format_check',
  confidence: 0.35,
  matched_mpn: null,
  matched_manufacturer: null,
  matched_description: null,
  datasheet_url: null,
  raw_json: { reason: message },
});

const checkFormat = (partNumber: string) => {
  const trimmed = partNumber.trim();
  if (!trimmed) return invalid('Part number is empty.');
  if (/^[A-Z]{0,3}[$]?\s*\d+(?:[.,]\d+)?$/i.test(trimmed)) return invalid('Part number looks like a price or quantity.');
  if (/^\d+$/.test(trimmed)) return suspicious('Part number is numeric only and needs review.');
  if (trimmed.split(/\s+/).length > 5 || trimmed.length > 80) return suspicious('Part number looks like a sentence or description.');
  return null;
};

const isExactPartMatch = (candidate: string | null | undefined, requested: string) => (
  Boolean(candidate) && normalizePartNumber(String(candidate)) === normalizePartNumber(requested)
);

export async function verifyCustomerBomPartNumber(
  supabase: SupabaseLike,
  item: { part_number?: string | null; manufacturer?: string | null },
): Promise<PartNumberVerificationResult> {
  const partNumber = String(item.part_number ?? '').trim();
  const formatResult = checkFormat(partNumber);
  if (formatResult?.status === 'invalid_format') return formatResult;

  const normalized = normalizePartNumber(partNumber);
  const requestedManufacturer = normalizeManufacturer(item.manufacturer);

  try {
    const { data: internalProducts } = await supabase
      .from('products')
      .select('part_number_mpn, product_name')
      .ilike('part_number_mpn', partNumber)
      .limit(1);
    const product = Array.isArray(internalProducts) ? internalProducts.find((row) => isExactPartMatch(row.part_number_mpn, normalized)) : null;
    if (product) {
      return {
        status: 'found_internal',
        message: 'Part number found in internal product catalog.',
        source: 'products',
        confidence: 0.95,
        matched_mpn: product.part_number_mpn ?? partNumber,
        matched_manufacturer: null,
        matched_description: product.product_name ?? null,
        datasheet_url: null,
        raw_json: { product },
      };
    }
  } catch {
    // Some deployments may not expose product search columns; continue to supplier upload and external checks.
  }

  try {
    const { data: internalStock } = await supabase
      .from('supplier_stock_upload_items')
      .select('part_number, manufacturer, product_name, description, datasheet_url')
      .ilike('part_number', partNumber)
      .limit(1);
    const stock = Array.isArray(internalStock) ? internalStock.find((row) => isExactPartMatch(row.part_number, normalized)) : null;
    if (stock) {
      return {
        status: 'found_internal',
        message: 'Part number found in uploaded supplier stock data.',
        source: 'supplier_stock_upload_items',
        confidence: 0.95,
        matched_mpn: stock.part_number ?? partNumber,
        matched_manufacturer: stock.manufacturer ?? null,
        matched_description: stock.product_name || stock.description || null,
        datasheet_url: stock.datasheet_url ?? null,
        raw_json: { stock },
      };
    }
  } catch {
    // Continue to Nexar.
  }

  if (formatResult) return formatResult;

  try {
    const result = await searchNexarByPartNumber(partNumber);
    const matchedMpn = result.part_number || null;
    const matchedManufacturer = result.manufacturer || null;
    const exactMpn = matchedMpn ? isExactPartMatch(matchedMpn, normalized) : false;
    if (!matchedMpn || !exactMpn) {
      return {
        status: matchedMpn ? 'found_octopart_possible' : 'not_found',
        message: matchedMpn ? 'Possible part number match found, review required.' : 'Part number was not confirmed in available sources.',
        source: 'nexar_octopart',
        confidence: matchedMpn ? 0.55 : 0,
        matched_mpn: matchedMpn,
        matched_manufacturer: matchedManufacturer,
        matched_description: result.description,
        datasheet_url: result.datasheet_url,
        raw_json: { result },
      };
    }
    if (requestedManufacturer && matchedManufacturer && normalizeManufacturer(matchedManufacturer) !== requestedManufacturer) {
      return {
        status: 'manufacturer_mismatch',
        message: 'Part number found, but manufacturer differs from BOM.',
        source: 'nexar_octopart',
        confidence: 0.72,
        matched_mpn: matchedMpn,
        matched_manufacturer: matchedManufacturer,
        matched_description: result.description,
        datasheet_url: result.datasheet_url,
        raw_json: { result },
      };
    }
    return {
      status: 'found_octopart_exact',
      message: requestedManufacturer ? 'Part number found and confirmed.' : 'Part number found. Manufacturer was not provided in BOM.',
      source: 'nexar_octopart',
      confidence: 0.9,
      matched_mpn: matchedMpn,
      matched_manufacturer: matchedManufacturer,
      matched_description: result.description,
      datasheet_url: result.datasheet_url,
      raw_json: { result },
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Part number verification failed.',
      source: 'nexar_octopart',
      confidence: null,
      matched_mpn: null,
      matched_manufacturer: null,
      matched_description: null,
      datasheet_url: null,
      raw_json: { error: error instanceof Error ? error.message : 'Unknown error' },
    };
  }
}

export const partNumberCheckGroup = (status: string | null | undefined) => {
  if (['found_internal', 'found_octopart_exact', 'found_exact'].includes(String(status))) return 'green';
  if (['found_octopart_possible', 'manufacturer_mismatch', 'ambiguous', 'needs_review', 'suspicious_format'].includes(String(status))) return 'yellow';
  if (['not_found', 'invalid_format', 'error'].includes(String(status))) return 'red';
  return 'gray';
};
