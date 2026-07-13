import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '../../../../lib/auth/require-admin-api';

const bucket = 'verified-supplier-images';
const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const maxSize = 2 * 1024 * 1024;
const safeName = (name: string) => name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '') || 'supplier-logo';
const fail = (error: string, status: number, detail?: string) => NextResponse.json({ error, detail }, { status });

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if ('error' in auth) return fail(auth.error, auth.status);
  const form = await request.formData().catch(() => null);
  if (!form) return fail('Invalid form submission.', 400);
  const name = String(form.get('name') || '').trim();
  const deliveryProduct = String(form.get('delivery_product') || '').trim();
  const picInput = String(form.get('pic') || '').trim();
  const file = form.get('file');
  if (!name) return fail('Supplier name is required.', 400);
  if (picInput.startsWith('blob:')) return fail('A temporary browser preview URL cannot be saved.', 400);

  let uploadedPath: string | null = null;
  let pic: string | null = picInput || null;
  if (file instanceof File && file.size > 0) {
    if (!allowedTypes.has(file.type)) return fail('Supplier logo upload failed.', 400, 'Only PNG, JPEG, and WebP images are allowed.');
    if (file.size > maxSize) return fail('Supplier logo upload failed.', 400, 'Image must be 2 MB or smaller.');
    uploadedPath = `verified-suppliers/${crypto.randomUUID()}/${safeName(file.name)}`;
    const { error } = await auth.admin.storage.from(bucket).upload(uploadedPath, file, { contentType: file.type, upsert: false });
    if (error) { console.error('Verified supplier logo upload failed:', error.message); return fail('Supplier logo upload failed.', 500, error.message); }
    pic = auth.admin.storage.from(bucket).getPublicUrl(uploadedPath).data.publicUrl;
  }

  const { data, error } = await auth.admin.from('verified_supplier').insert({ name, pic, delivery_product: deliveryProduct || null }).select('supplier_id, name, pic, delivery_product').single();
  if (error) {
    console.error('Verified supplier insert failed:', error.message);
    if (uploadedPath) await auth.admin.storage.from(bucket).remove([uploadedPath]);
    return fail('Verified supplier record could not be created.', 500, error.message);
  }
  return NextResponse.json({ supplier: data }, { status: 201 });
}
