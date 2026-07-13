import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase/server';

const bucketName = 'customer-profile-documents';
const allowedTypes = new Map([
  ['application/pdf', new Set(['pdf'])],
  ['image/jpeg', new Set(['jpg', 'jpeg'])],
  ['image/png', new Set(['png'])],
]);
const allowedDocumentTypes = new Set(['company_registration', 'tax_vat_document', 'proof_of_address', 'other_customer_document']);
const maxBytes = 10 * 1024 * 1024;

const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const safeFileName = (input: string) => {
  const extension = input.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
  const base = input.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'customer-document';
  return `${base.slice(0, 80)}${extension ? `.${extension}` : ''}`;
};
const extensionOf = (input: string) => input.split('.').pop()?.toLowerCase() || '';
const publicDocument = (document: Record<string, any>) => ({
  document_type: document.document_type,
  file_name: document.file_name,
  mime_type: document.mime_type || '',
  size_bytes: Number(document.size_bytes || 0),
  uploaded_at: document.uploaded_at || document.updated_at || null,
  updated_at: document.updated_at || null,
  preview_url: `/api/customer/profile/documents?document_type=${encodeURIComponent(document.document_type)}`,
  download_url: `/api/customer/profile/documents?document_type=${encodeURIComponent(document.document_type)}&download=1`,
});

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) return jsonError('Authentication required.', 401);

  const documentType = String(request.nextUrl.searchParams.get('document_type') || '');
  if (!allowedDocumentTypes.has(documentType)) return jsonError('Invalid document slot.', 400);

  const { data: document, error: loadError } = await supabase
    .from('customer_profile_documents')
    .select('document_type, file_name, file_path')
    .eq('user_id', user.id)
    .eq('document_type', documentType)
    .maybeSingle();
  if (loadError) return jsonError(`Document could not be loaded: ${loadError.message}`, 500);
  if (!document?.file_path) return jsonError('No file is stored for this document slot.', 404);

  const download = request.nextUrl.searchParams.get('download') === '1';
  const { data: signed, error: signedError } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(document.file_path, 300, download ? { download: document.file_name || true } : undefined);
  if (signedError || !signed?.signedUrl) return jsonError(`Document could not be prepared: ${signedError?.message || 'Signed URL was not created.'}`, 500);
  return NextResponse.redirect(signed.signedUrl);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) return jsonError('Authentication required.', 401);

  const formData = await request.formData();
  const file = formData.get('file');
  const documentType = String(formData.get('document_type') || '');
  if (!allowedDocumentTypes.has(documentType)) return jsonError('Invalid document slot.', 400);
  if (!(file instanceof File)) return jsonError('Document file is required.');
  const validExtensions = allowedTypes.get(file.type);
  if (!validExtensions || !validExtensions.has(extensionOf(file.name))) return jsonError('File type is not supported. Use PDF, JPG, JPEG, or PNG.');
  if (file.size > maxBytes) return jsonError('File exceeds the maximum size of 10 MB.');

  const [{ data: profile, error: profileError }, { data: existing, error: existingError }] = await Promise.all([
    supabase.from('customer_company_profiles').select('customer_profile_id').eq('user_id', user.id).maybeSingle(),
    supabase.from('customer_profile_documents').select('file_path').eq('user_id', user.id).eq('document_type', documentType).maybeSingle(),
  ]);
  if (profileError) return jsonError(`Customer profile could not be resolved: ${profileError.message}`, 500);
  if (existingError) return jsonError(`Existing document could not be loaded: ${existingError.message}`, 500);

  const storagePath = `${user.id}/${documentType}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { data: uploadData, error: uploadError } = await supabase.storage.from(bucketName).upload(storagePath, file, {
    cacheControl: '3600', contentType: file.type, upsert: false,
  });
  if (uploadError) return jsonError(`Document upload failed: ${uploadError.message}`, 500);

  const now = new Date().toISOString();
  const { data: document, error: saveError } = await supabase
    .from('customer_profile_documents')
    .upsert({
      user_id: user.id,
      customer_profile_id: profile?.customer_profile_id ?? null,
      document_type: documentType,
      file_name: file.name,
      file_url: null,
      file_path: uploadData.path,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_at: now,
      updated_at: now,
    }, { onConflict: 'user_id,document_type' })
    .select('document_type, file_name, mime_type, size_bytes, uploaded_at, updated_at')
    .single();

  if (saveError) {
    const { error: cleanupError } = await supabase.storage.from(bucketName).remove([uploadData.path]);
    if (cleanupError) console.error('Customer document orphan cleanup failed:', cleanupError.message);
    return jsonError(`Document metadata could not be saved: ${saveError.message}`, 500);
  }

  if (existing?.file_path && existing.file_path !== uploadData.path) {
    const { error: cleanupError } = await supabase.storage.from(bucketName).remove([existing.file_path]);
    if (cleanupError) console.error('Replaced customer document cleanup failed:', cleanupError.message);
  }
  return NextResponse.json({ document: publicDocument(document) });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) return jsonError('Authentication required.', 401);

  const body = await request.json().catch(() => ({}));
  const documentType = String(body.document_type || '');
  if (!allowedDocumentTypes.has(documentType)) return jsonError('Invalid document slot.', 400);

  const { data: document, error: loadError } = await supabase
    .from('customer_profile_documents')
    .select('id, file_path')
    .eq('user_id', user.id)
    .eq('document_type', documentType)
    .maybeSingle();
  if (loadError) return jsonError(`Document could not be loaded: ${loadError.message}`, 500);
  if (!document) return jsonError('No file is stored for this document slot.', 404);

  const { error: deleteError } = await supabase.from('customer_profile_documents').delete().eq('id', document.id).eq('user_id', user.id);
  if (deleteError) return jsonError(`Document metadata could not be deleted: ${deleteError.message}`, 500);
  if (document.file_path) {
    const { error: removeError } = await supabase.storage.from(bucketName).remove([document.file_path]);
    if (removeError) console.error('Deleted customer document Storage cleanup failed:', removeError.message);
  }
  return NextResponse.json({ ok: true });
}
