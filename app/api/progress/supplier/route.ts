import { NextResponse } from 'next/server';
import { getSupplierProgress, isMissingProgressTableError } from '../../../../lib/procurement-progress/progress';
import { createClient } from '../../../../lib/supabase/server';

const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function GET() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return jsonError('You must be signed in to view supplier progress.', 401);

  const { data, error } = await getSupplierProgress(supabase, authData.user.id);
  if (error) {
    if (isMissingProgressTableError(error.message)) return NextResponse.json({ progress: [], setup_required: true });
    return jsonError(error.message, 500);
  }

  return NextResponse.json({ progress: data ?? [] });
}
