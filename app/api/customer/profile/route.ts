import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';

const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const photoBucketName = 'customer-profile-photos';

const textOrNull = (value: unknown) => {
  const trimmed = String(value ?? '').trim();
  return trimmed ? trimmed : null;
};

export async function GET() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) return jsonError('Authentication required.', 401);

  const [{ data: userProfile }, { data: customerProfile, error: profileError }, { data: documents, error: documentsError }] = await Promise.all([
    supabase.from('user_profiles').select('email, full_name, company_name, role, created_at').eq('id', user.id).maybeSingle(),
    supabase.from('customer_company_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('customer_profile_documents').select('document_type, file_name, mime_type, size_bytes, uploaded_at, updated_at').eq('user_id', user.id).order('uploaded_at', { ascending: false }),
  ]);

  if (profileError) return jsonError(`customer_company_profiles: ${profileError.message}`, 500);
  if (documentsError) return jsonError(`customer_profile_documents: ${documentsError.message}`, 500);

  let profileWithSignedPhoto = customerProfile ?? null;
  if (customerProfile?.profile_photo_path) {
    const { data: signedPhoto } = await supabase.storage
      .from(photoBucketName)
      .createSignedUrl(customerProfile.profile_photo_path, 60 * 60);
    profileWithSignedPhoto = {
      ...customerProfile,
      profile_photo_url: signedPhoto?.signedUrl || customerProfile.profile_photo_url || '',
    };
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email || userProfile?.email || '',
      created_at: user.created_at,
      role: userProfile?.role || user.user_metadata?.role || 'customer',
    },
    profile: profileWithSignedPhoto,
    user_profile: userProfile ?? null,
    documents: (documents || []).map((document) => ({
      ...document,
      preview_url: `/api/customer/profile/documents?document_type=${encodeURIComponent(document.document_type)}`,
      download_url: `/api/customer/profile/documents?document_type=${encodeURIComponent(document.document_type)}&download=1`,
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) return jsonError('Authentication required.', 401);

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const allowedFields = new Set([
    'email', 'full_name', 'company_name', 'contact_phone', 'website', 'country_name', 'city',
    'address_line1', 'address_line2', 'postal_code', 'state_region', 'business_registration_number',
    'tax_vat_number', 'profile_photo_url', 'profile_photo_path',
  ]);
  const unexpectedFields = Object.keys(body).filter((field) => !allowedFields.has(field));
  if (unexpectedFields.length) return jsonError(`Unexpected profile fields: ${unexpectedFields.join(', ')}.`, 400);

  const fullName = String(body.full_name ?? '').trim();
  const companyName = String(body.company_name ?? '').trim();
  if (!fullName) return jsonError('Full name is required.', 422);
  if (!companyName) return jsonError('Company name is required.', 422);
  if (fullName.length > 160 || companyName.length > 200) return jsonError('Name values are too long.', 422);
  const website = String(body.website ?? '').trim();
  if (website) {
    try {
      const parsed = new URL(website);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('unsupported protocol');
    } catch {
      return jsonError('Website must be a valid http:// or https:// address.', 422);
    }
  }

  const { data: currentUserProfile, error: userProfileLoadError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (userProfileLoadError) return jsonError(`User profile load failed: ${userProfileLoadError.message}`, 500);
  if (currentUserProfile?.role && currentUserProfile.role !== 'customer') return jsonError('Customer profile access is required.', 403);

  const profilePayload = {
    user_id: user.id,
    company_name: companyName,
    business_registration_number: textOrNull(body.business_registration_number),
    tax_vat_number: textOrNull(body.tax_vat_number),
    country_name: textOrNull(body.country_name),
    contact_name: fullName,
    contact_email: user.email || null,
    contact_phone: textOrNull(body.contact_phone),
    website: textOrNull(website),
    company_address: textOrNull(body.address_line1),
    city: textOrNull(body.city),
    address_line1: textOrNull(body.address_line1),
    address_line2: textOrNull(body.address_line2),
    postal_code: textOrNull(body.postal_code),
    state_region: textOrNull(body.state_region),
    updated_at: new Date().toISOString(),
  };

  const { data: userProfile, error: userProfileError } = await supabase
    .from('user_profiles')
    .update({ full_name: fullName, company_name: companyName, updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .select('email, full_name, company_name')
    .single();
  if (userProfileError) return jsonError(`User profile update failed: ${userProfileError.message}`, 500);

  const { data, error } = await supabase
    .from('customer_company_profiles')
    .upsert(profilePayload, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) return jsonError(`Company profile update failed: ${error.message}`, 500);
  return NextResponse.json({ profile: data, user_profile: userProfile });
}
