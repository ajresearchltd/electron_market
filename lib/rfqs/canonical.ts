type Database = any;

export async function loadCanonicalRfqsForAdmin(database: Database, limit = 30) {
  const rfqs = await database.from('rfq_orders0').select('*').order('created_at', { ascending: false }).limit(limit);
  if (rfqs.error) return { error: rfqs.error };
  const rows = rfqs.data ?? [];
  const rfqIds = rows.map((row: any) => row.rfq_id);
  const chainIds = [...new Set(rows.map((row: any) => row.procurement_chain_id).filter(Boolean))];
  const bomIds = [...new Set(rows.map((row: any) => row.source_bom_upload_id).filter(Boolean))];
  const [items, assignments, progress, rfqStageProgress, boms] = await Promise.all([
    rfqIds.length ? database.from('rfq_order_items0').select('*').in('rfq_id', rfqIds).order('line_number') : Promise.resolve({ data: [], error: null }),
    rfqIds.length ? database.from('rfq_supplier_assignments').select('*').in('rfq_id', rfqIds).order('assigned_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
    chainIds.length ? database.from('procurement_progress').select('id,procurement_chain_id,procurement_number,current_stage,current_stage_label,status_note').in('procurement_chain_id', chainIds) : Promise.resolve({ data: [], error: null }),
    database.from('procurement_progress').select('id,procurement_chain_id,procurement_number,current_stage,current_stage_label,status_note').eq('current_stage', 'rfq').limit(100),
    bomIds.length ? database.from('customer_bom_uploads').select('id,original_file_name,document_name').in('id', bomIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const bomMap = new Map((boms.data ?? []).map((row: any) => [row.id, row.original_file_name || row.document_name]));
  const warnings: Array<{ code: string; procurementChainId: string; procurementNumber?: string; message: string }> = [];
  const rfqChainIds = new Set(chainIds);
  for (const row of rfqStageProgress.data ?? []) if (row.procurement_chain_id && !rfqChainIds.has(row.procurement_chain_id)) warnings.push({ code: 'RFQ_PROGRESS_WITHOUT_DOCUMENT', procurementChainId: row.procurement_chain_id, procurementNumber: row.procurement_number, message: 'Procurement progress is at RFQ stage, but no canonical RFQ row was found.' });
  return { data: { rfqs: rows.map((row: any) => ({ ...row, source_bom_file: row.source_bom_upload_id ? bomMap.get(row.source_bom_upload_id) ?? null : null })), items: items.data ?? [], assignments: assignments.data ?? [], progress: progress.data ?? [], warnings } };
}
