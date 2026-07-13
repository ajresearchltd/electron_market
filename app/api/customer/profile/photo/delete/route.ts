import { NextResponse } from 'next/server';
import { createClient } from '../../../../../../lib/supabase/server';

const bucketName = 'customer-profile-photos';
const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function POST() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) return jsonError('Authentication required.', 401);

  const { data: profile, error: loadError } = await supabase
    .from('customer_company_profiles')
    .select('profile_photo_path')
    .eq('user_id', user.id)
    .maybeSingle();
  if (loadError) return jsonError(`customer_company_profiles: ${loadError.message}`, 500);

  const photoPath = String(profile?.profile_photo_path || '');
  if (photoPath) {
    const { error: removeError } = await supabase.storage.from(bucketName).remove([photoPath]);
    if (removeError) return jsonError(`Profile photo delete: ${removeError.message}`, 500);
  }

  const { error: updateError } = await supabase
    .from('customer_company_profiles')
    .update({
      profile_photo_url: null,
      profile_photo_path: null,
      profile_photo_file_name: null,
      profile_photo_uploaded_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id);

  if (updateError) return jsonError(`Profile photo clear: ${updateError.message}`, 500);
  return NextResponse.json({ ok: true });
}
