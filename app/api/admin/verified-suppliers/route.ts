import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '../../../../lib/auth/require-admin-api';

const bucket = 'verified-supplier-images';
const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const maxSize = 2 * 1024 * 1024;
const safeName = (name: string) => name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '') || 'supplier-logo';
const fields='supplier_id, canonical_supplier_id, name, pic, delivery_product, show_on_homepage, homepage_sort_order, show_public_website, public_directory_sort_order, is_public, is_active';
const fail = (error: string, status: number, message?: string) => NextResponse.json({ error, message }, { status });
const bool=(form:FormData,key:string)=>form.get(key)==='true';
const order=(form:FormData,key:string)=>{const value=String(form.get(key)??'').trim();return value&&Number.isFinite(Number(value))?Math.trunc(Number(value)):0};

export async function GET() {
  const auth=await requireAdminApi();
  if('error'in auth)return fail(auth.status===401?'authentication_required':'admin_authorization_required',auth.status,auth.error);
  const result=await auth.admin.from('verified_supplier').select(fields).order('name',{ascending:true});
  if(result.error){console.error('Verified supplier list failed:',result.error.message);return fail('verified_supplier_list_failed',500,'Verified suppliers could not be loaded.');}
  return NextResponse.json({suppliers:result.data??[]});
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if ('error' in auth) return fail(auth.status===401?'authentication_required':'admin_authorization_required',auth.status,auth.error);
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
    if (error) { console.error('Verified supplier logo upload failed:', error.message); return fail('supplier_logo_upload_failed', 500, 'Supplier logo could not be uploaded.'); }
    pic = auth.admin.storage.from(bucket).getPublicUrl(uploadedPath).data.publicUrl;
  }

  const canonical=await auth.admin.from('suppliers').insert({supplier_name:name,company_name:name,verified_supplier:true,supplier_status:'active'}).select('supplier_id').single();
  if(canonical.error){console.error('Canonical supplier creation failed:',canonical.error.message);if(uploadedPath)await auth.admin.storage.from(bucket).remove([uploadedPath]);return fail('canonical_supplier_create_failed',500,'Canonical supplier record could not be created.');}
  const payload={canonical_supplier_id:canonical.data.supplier_id,name,pic,delivery_product:deliveryProduct||null,show_on_homepage:bool(form,'show_on_homepage'),homepage_sort_order:order(form,'homepage_sort_order'),show_public_website:bool(form,'show_public_website'),public_directory_sort_order:order(form,'public_directory_sort_order'),is_public:bool(form,'is_public'),is_active:bool(form,'is_active')};
  const { data, error } = await auth.admin.from('verified_supplier').insert(payload).select(fields).single();
  if (error) {
    console.error('Verified supplier insert failed:', error.message);
    if (uploadedPath) await auth.admin.storage.from(bucket).remove([uploadedPath]);
    await auth.admin.from('suppliers').delete().eq('supplier_id',canonical.data.supplier_id);
    return fail('verified_supplier_create_failed', 500, 'Verified supplier could not be created.');
  }
  return NextResponse.json({ supplier: data }, { status: 201 });
}
