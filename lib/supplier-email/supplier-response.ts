export const supplierResponseKeyForMessage = (messageId: string) => `email:${messageId}`;

export async function getOrCreateSupplierResponseForInboundEmail(database: any, input: {
  messageId: string; procurementChainId: string; supplierId: string; payload: Record<string, unknown>;
}) {
  const responseKey = supplierResponseKeyForMessage(input.messageId);
  const existing = await database.from('supplier_responses').select('id,response_revision,is_current,response_key').eq('source_message_id', input.messageId).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) {
    const updated = await database.from('supplier_responses').update({ ...input.payload, response_key: responseKey }).eq('id', existing.data.id).select('id,response_revision,is_current,response_key').single();
    if (updated.error) throw new Error(updated.error.message);
    return { ...updated.data, created: false };
  }
  const inserted = await database.from('supplier_responses').insert({ ...input.payload, response_key: responseKey }).select('id,response_revision,is_current,response_key').single();
  if (!inserted.error) return { ...inserted.data, created: true };
  if (inserted.error.code !== '23505') throw new Error(inserted.error.message);
  const canonical = await database.from('supplier_responses').select('id,response_revision,is_current,response_key').eq('procurement_chain_id', input.procurementChainId).eq('supplier_id', input.supplierId).eq('response_key', responseKey).maybeSingle();
  if (canonical.error || !canonical.data) throw new Error(inserted.error.message);
  const updated = await database.from('supplier_responses').update(input.payload).eq('id', canonical.data.id).select('id,response_revision,is_current,response_key').single();
  if (updated.error) throw new Error(updated.error.message);
  return { ...updated.data, created: false };
}
