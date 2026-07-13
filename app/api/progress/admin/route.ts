import { NextResponse } from 'next/server';
import { getAdminProgress, isMissingProgressTableError } from '../../../../lib/procurement-progress/progress';
import { createClient } from '../../../../lib/supabase/server';

const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function GET() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return jsonError('You must be signed in to view admin progress.', 401);

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (profileError) return jsonError(profileError.message, 500);
  if (profile?.role !== 'admin') return jsonError('Admin access is required.', 403);

  const { data, error } = await getAdminProgress(supabase);
  if (error) {
    if (isMissingProgressTableError(error.message)) return NextResponse.json({ progress: [], setup_required: true });
    return jsonError(error.message, 500);
  }

  return NextResponse.json({ progress: data ?? [] });
}
