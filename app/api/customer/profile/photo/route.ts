import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase/server';

const bucketName = 'customer-profile-photos';
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxBytes = 5 * 1024 * 1024;

const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const safeFileName = (value: string) => value.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '') || 'profile-photo';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) return jsonError('Authentication required.', 401);

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) return jsonError('Profile photo file is required.');
  if (!allowedTypes.has(file.type)) return jsonError('Only JPG, PNG, and WEBP profile photos are allowed.');
  if (file.size > maxBytes) return jsonError('Profile photo must be 5 MB or smaller.');

  const storagePath = `${user.id}/profile/${Date.now()}-${safeFileName(file.name)}`;
  const { data: uploadData, error: uploadError } = await supabase.storage.from(bucketName).upload(storagePath, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: true,
  });
  if (uploadError) return jsonError(`Profile photo upload: ${uploadError.message}`, 500);

  const { data: signedUrlData } = await supabase.storage.from(bucketName).createSignedUrl(uploadData.path, 60 * 60);
  const { data: profile, error: updateError } = await supabase
    .from('customer_company_profiles')
    .upsert({
      user_id: user.id,
      contact_email: user.email || null,
      profile_photo_url: signedUrlData?.signedUrl || '',
      profile_photo_path: uploadData.path,
      profile_photo_file_name: file.name,
      profile_photo_uploaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (updateError) return jsonError(`Profile photo save: ${updateError.message}`, 500);
  return NextResponse.json({ profile, photo_url: signedUrlData?.signedUrl || '', photo_path: uploadData.path });
}
