type Database = any;

export type WorkflowBlocker = { code: string; rfqItemId?: string; offerItemId?: string; message: string };

export async function evaluateRfqForInvoice(database: Database, rfqId: string) {
  const [rfqResult, itemResult, allocationResult] = await Promise.all([
    database.from('rfq_orders0').select('*').eq('rfq_id', rfqId).maybeSingle(),
    database.from('rfq_order_items0').select('*').eq('rfq_id', rfqId).order('line_number'),
    database.from('procurement_supplier_allocations').select('*').eq('rfq_id', rfqId).eq('is_active', true),
  ]);
  if (rfqResult.error || !rfqResult.data) return { error: 'RFQ not found.', status: 404 as const };
  if (itemResult.error || allocationResult.error) return { error: 'Invoice readiness could not be evaluated.', status: 500 as const };
  const allocations = allocationResult.data ?? [];
  const offerIds = allocations.map((row: any) => row.supplier_response_item_id);
  const offers = offerIds.length ? await database.from('supplier_response_items').select('*,supplier_responses!inner(quote_valid_until,status,is_current)').in('id', offerIds) : { data: [], error: null };
  if (offers.error) return { error: 'Selected supplier offers could not be evaluated.', status: 500 as const };
  const offerMap = new Map((offers.data ?? []).map((row: any) => [row.id, row]));
  const blockers: WorkflowBlocker[] = [];
  for (const allocation of allocations) {
    const offer: any = offerMap.get(allocation.supplier_response_item_id);
    const add = (code: string, message: string) => blockers.push({ code, rfqItemId: allocation.rfq_item_id, offerItemId: allocation.supplier_response_item_id, message });
    if (!offer) { add('OFFER_NOT_FOUND', 'The selected supplier offer no longer exists.'); continue; }
    if (offer.calculated_unit_price === null || offer.calculated_unit_price === undefined) add('PRICE_MISSING', 'Supplier unit price and price basis must be explicit.');
    if (!offer.currency) add('AMBIGUOUS_CURRENCY', 'Supplier offer currency must be confirmed.');
    if (!offer.price_basis_quantity || !offer.price_basis_unit) add('AMBIGUOUS_PRICE_BASIS', 'Supplier price basis must be confirmed.');
    if (offer.rfq_item_id !== allocation.rfq_item_id) add('OFFER_MATCH_INVALID', 'Supplier offer is not deterministically matched to this RFQ position.');
    if (Number(offer.available_quantity ?? offer.offered_quantity ?? 0) < Number(allocation.allocated_quantity)) add('INSUFFICIENT_AVAILABILITY', 'Allocated quantity exceeds supplier availability.');
    if (offer.supplier_responses?.quote_valid_until && new Date(offer.supplier_responses.quote_valid_until) < new Date(new Date().toISOString().slice(0, 10))) add('OFFER_EXPIRED', 'The supplier quotation has expired.');
  }
  const allocatedByItem = new Map<string, number>();
  for (const row of allocations) allocatedByItem.set(row.rfq_item_id, (allocatedByItem.get(row.rfq_item_id) ?? 0) + Number(row.allocated_quantity));
  const items = itemResult.data ?? [];
  const fullyCoveredItems = items.filter((row: any) => (allocatedByItem.get(row.rfq_item_id) ?? 0) >= Number(row.requested_quantity)).length;
  const partiallyCoveredItems = items.filter((row: any) => { const n = allocatedByItem.get(row.rfq_item_id) ?? 0; return n > 0 && n < Number(row.requested_quantity); }).length;
  const requested = items.reduce((sum: number, row: any) => sum + Number(row.requested_quantity ?? 0), 0);
  const allocated = [...allocatedByItem.values()].reduce((sum, value) => sum + value, 0);
  const currencies = [...new Set(allocations.map((row: any) => row.currency))];
  if (currencies.length > 1) blockers.push({ code: 'MULTIPLE_CURRENCIES', message: 'Selected allocations use multiple currencies; no FX policy is configured.' });
  return { data: { ready: allocations.length > 0 && blockers.length === 0, mode: 'manual', coverage: { rfqItems: items.length, fullyCoveredItems, partiallyCoveredItems, uncoveredItems: items.length - fullyCoveredItems - partiallyCoveredItems, quantityCoveragePercent: requested ? Math.min(100, Math.round(allocated / requested * 100)) : 0 }, blockers, warnings: fullyCoveredItems < items.length ? [{ code: 'PARTIAL_INVOICE', message: 'Admin confirmation will create a partial Draft Invoice; uncovered RFQ positions remain open.' }] : [], allocations, items, offers: offers.data ?? [], rfq: rfqResult.data } };
}

export async function selectSupplierAllocation(database: Database, actorId: string, input: any) {
  const deliveryTerms = String(input.deliveryTerms ?? '').trim();
  const selectionReason = String(input.selectionReason ?? '').trim();
  const offer = await database.from('supplier_response_items').select('*,supplier_responses!inner(supplier_id,quote_valid_until,status,is_current)').eq('id', input.supplierResponseItemId).maybeSingle();
  if (offer.error || !offer.data) return { error: 'Supplier offer position not found.', status: 404 as const };
  const row = offer.data;
  if (row.rfq_id !== input.rfqId || row.rfq_item_id !== input.rfqItemId) return { error: 'Supplier offer is not matched to this RFQ position.', status: 422 as const };
  if (row.calculated_unit_price === null || row.calculated_unit_price === undefined || !row.currency || !row.price_basis_quantity || !row.price_basis_unit) return { error: 'Supplier price, currency and price basis must be confirmed before selection.', status: 422 as const };
  if (row.review_status !== 'not_required' || row.normalization_status !== 'validated') return { error: 'Resolve the supplier-offer review before selection.', status: 422 as const };
  const rfqItem=await database.from('rfq_order_items0').select('rfq_item_id,requested_quantity').eq('rfq_id',input.rfqId).eq('rfq_item_id',input.rfqItemId).maybeSingle();
  if(rfqItem.error||!rfqItem.data)return {error:'RFQ position not found.',status:404 as const};
  const quantity = Number(input.allocatedQuantity);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > Number(row.available_quantity ?? row.offered_quantity ?? 0)) return { error: 'Allocated quantity must be positive and cannot exceed availability.', status: 422 as const };
  if(quantity>Number(rfqItem.data.requested_quantity))return {error:'Approved quantity cannot exceed the requested RFQ quantity.',status:422 as const};
  if(!deliveryTerms&&!input.customerApproval)return {error:'Delivery terms and a selection reason are required.',status:422 as const};
  if(input.replaceExisting){const cleared=await database.from('procurement_supplier_allocations').update({is_active:false,updated_at:new Date().toISOString()}).eq('rfq_id',input.rfqId).eq('rfq_item_id',input.rfqItemId).eq('is_active',true).neq('supplier_response_item_id',row.id);if(cleared.error)return {error:'The previous approval could not be replaced.',status:409 as const}}
  const saved = await database.from('procurement_supplier_allocations').upsert({ procurement_chain_id: row.procurement_chain_id, rfq_id: input.rfqId, rfq_item_id: input.rfqItemId, supplier_response_item_id: row.id, supplier_id: row.supplier_id, allocated_quantity: quantity, selected_unit_price: row.calculated_unit_price, currency: row.currency, price_basis_quantity: row.price_basis_quantity, price_basis_unit: row.price_basis_unit, delivery_terms: deliveryTerms||String(row.lead_time_raw||'Not provided'), selection_reason: selectionReason||(input.customerApproval?'Customer approved supplier offer.':''), selected_by: actorId, selected_at: new Date().toISOString(), is_active: true }, { onConflict: 'rfq_item_id,supplier_response_item_id' }).select('*').single();
  if (saved.error) return { error: 'Supplier allocation could not be saved.', status: 409 as const };
  return { data: saved.data };
}
