import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../../../lib/supabase/server';

const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function GET(_request: NextRequest, { params }: { params: Promise<{ uploadId: string }> }) {
  const { uploadId } = await params;
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return jsonError('You must be signed in to view this BOM upload.', 401);

  const { data: upload, error: uploadError } = await supabase
    .from('customer_bom_uploads')
    .select('*')
    .eq('id', uploadId)
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (uploadError) return jsonError(uploadError.message, 500);
  if (!upload) return jsonError('BOM upload not found.', 404);

  const { data: items, error: itemError } = await supabase
    .from('customer_bom_upload_items')
    .select('id, row_number, part_number, normalized_part_number, manufacturer, quantity, unit, description, validation_status, validation_errors, validation_warnings, part_number_check_status, part_number_check_message, part_number_check_source')
    .eq('upload_id', uploadId)
    .eq('user_id', authData.user.id)
    .order('row_number', { ascending: true });

  if (itemError) return jsonError(itemError.message, 500);
  let chain: any = null; let progress: any = null;
  if (upload.procurement_chain_id) {
    const [chainResult, progressResult] = await Promise.all([
      supabase.from('procurement_chains').select('id,procurement_number,customer_reference,current_stage,current_stage_label').eq('id',upload.procurement_chain_id).eq('customer_user_id',authData.user.id).maybeSingle(),
      supabase.from('procurement_progress').select('current_stage,current_stage_label').eq('procurement_chain_id',upload.procurement_chain_id).eq('customer_user_id',authData.user.id).maybeSingle(),
    ]); chain=chainResult.data; progress=progressResult.data;
  }
  return NextResponse.json({ upload: { ...upload, procurement_number: chain?.procurement_number || upload.procurement_number, customer_reference: chain?.customer_reference || upload.document_name, current_stage: progress?.current_stage || chain?.current_stage || 'bom_received', current_stage_label: progress?.current_stage_label || chain?.current_stage_label || 'BOM received' }, items: items ?? [] });
}
