import { NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase/server';

const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function GET() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return jsonError('You must be signed in to view BOM uploads.', 401);

  const { data, error } = await supabase
    .from('customer_bom_uploads')
    .select('id, upload_number, document_name, original_file_name, created_at, total_rows, valid_rows, warning_rows, error_rows, ai_processing_status, status')
    .eq('user_id', authData.user.id)
    .order('created_at', { ascending: false });

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ uploads: data ?? [] });
}
