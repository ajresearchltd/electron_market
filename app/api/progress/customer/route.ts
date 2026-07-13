import { NextResponse } from 'next/server';
import { getOrCreateProcurementCaseForBom } from '../../../../lib/procurement-documents/document-chain';
import { getCustomerProgress, getStageIndex, isMissingProgressTableError } from '../../../../lib/procurement-progress/progress';
import { createClient } from '../../../../lib/supabase/server';

const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function GET() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return jsonError('You must be signed in to view progress.', 401);

  const { data, error } = await getCustomerProgress(supabase, authData.user.id);
  if (error) {
    if (isMissingProgressTableError(error.message)) return NextResponse.json({ progress: [], setup_required: true });
    return jsonError(error.message, 500);
  }

  const progress = [...(data ?? [])];
  for (const row of progress) {
    if (!row.procurement_number && row.customer_bom_upload_id) {
      const procurementCase = await getOrCreateProcurementCaseForBom(supabase, row.customer_bom_upload_id);
      if (procurementCase.data?.procurement_number) {
        row.procurement_chain_id = procurementCase.data.procurement_chain_id || procurementCase.data.id;
        row.procurement_case_id = procurementCase.data.id;
        row.procurement_number = procurementCase.data.procurement_number;
      }
    }
  }

  return NextResponse.json({ progress: progress.map((row) => ({
    ...row,
    id: row.id,
    procurement_chain_id: row.procurement_chain_id ?? null,
    procurement_number: row.procurement_number ?? null,
    progress_number: row.progress_number ?? null,
    customer_reference: row.customer_reference ?? row.document_name ?? null,
    source_bom_id: row.customer_bom_upload_id ?? null,
    current_stage: row.current_stage ?? 'bom_received',
    stage_number: Math.max(1, getStageIndex(row.current_stage) + 1),
    updated_at: row.updated_at ?? row.created_at ?? null,
  })) });
}
