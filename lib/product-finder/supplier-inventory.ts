import 'server-only';

const INVENTORY_COLUMNS = 'part_number,manufacturer,supplier_sku,product_name,description,available_quantity,moq,unit,unit_price,currency,lead_time,condition';

const searchTerms = (message: string) => [...new Set(
  message
    .split(/\s+/)
    .map(value => value.replace(/[^\p{L}\p{N}._+\/-]/gu, '').trim())
    .filter(value => value.length >= 3)
    .sort((a, b) => /\d/.test(b) === /\d/.test(a) ? b.length - a.length : Number(/\d/.test(b)) - Number(/\d/.test(a)))
    .slice(0, 8),
)];

export async function searchSupplierInventory(database: any, message: string) {
  const terms = searchTerms(message);
  if (!terms.length) return [];

  const filters = terms.flatMap(term => {
    const safe = term.replace(/[%_,()]/g, '');
    return safe ? [
      `part_number.ilike.%${safe}%`,
      `supplier_sku.ilike.%${safe}%`,
      `product_name.ilike.%${safe}%`,
      `manufacturer.ilike.%${safe}%`,
    ] : [];
  });
  if (!filters.length) return [];

  const result = await database
    .from('supplier_stock_upload_items')
    .select(INVENTORY_COLUMNS)
    .eq('active', true)
    .in('validation_status', ['valid', 'warning'])
    .or(filters.join(','))
    .order('unit_price', { ascending: true, nullsFirst: false })
    .limit(20);

  if (result.error) {
    console.error('Supplier inventory lookup failed', { code: result.error.code ?? null });
    return [];
  }

  return (result.data ?? []).map((row: any) => ({
    partNumber: row.part_number,
    manufacturer: row.manufacturer,
    supplierSku: row.supplier_sku,
    productName: row.product_name,
    description: row.description,
    availableQuantity: row.available_quantity,
    unit: row.unit,
    unitPrice: row.unit_price,
    currency: row.currency,
    moq: row.moq,
    leadTime: row.lead_time,
    condition: row.condition,
  }));
}
