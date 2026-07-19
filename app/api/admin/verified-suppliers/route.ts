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
  const [result,canonical,pending]=await Promise.all([auth.admin.from('verified_supplier').select(fields).order('name',{ascending:true}),auth.admin.from('suppliers').select('supplier_id,source_profile_id,supplier_name,company_name,supplier_status').order('company_name',{ascending:true}),auth.admin.from('supplier_company_profiles').select('profile_id,canonical_supplier_id,company_name,public_display_name,country_name,public_profile_status,pending_review_at,updated_at,supported_languages,public_short_description,public_detailed_description,public_supplier_type,public_categories,regions_served,delivery_countries').eq('public_profile_status','pending_review').order('pending_review_at',{ascending:true})]);
  if(result.error||canonical.error||pending.error){console.error('Verified supplier list failed:',result.error?.message||canonical.error?.message||pending.error?.message);return fail('verified_supplier_list_failed',500,'Verified suppliers could not be loaded.');}
  const canonicalById=new Map((canonical.data??[]).map(row=>[row.supplier_id,row]));
  const suppliers=(result.data??[]).map(row=>{const owner=row.canonical_supplier_id?canonicalById.get(row.canonical_supplier_id):null;return{...row,canonical_diagnostic:!row.canonical_supplier_id?'Manual canonical review required.':owner&&!owner.source_profile_id?'Canonical supplier exists, but no Supplier HUB account/profile is linked.':owner?null:'Canonical supplier reference is invalid.'}});
  const snapshotByCanonical=new Map(suppliers.filter(row=>row.canonical_supplier_id).map(row=>[row.canonical_supplier_id,row]));
  const pendingProfiles=(pending.data??[]).map(row=>{const snapshot=snapshotByCanonical.get(row.canonical_supplier_id);const values=[row.public_display_name,row.public_short_description,row.public_detailed_description,row.country_name,row.public_supplier_type,row.public_categories,row.supported_languages?.length,row.regions_served||row.delivery_countries];return{...row,completion_percent:Math.round(values.filter(Boolean).length/values.length*100),snapshot_status:snapshot?snapshot.is_active?'Active':'Inactive':'No approved snapshot',directory_visible:Boolean(snapshot?.show_public_website&&snapshot?.is_public&&snapshot?.is_active),homepage_visible:Boolean(snapshot?.show_on_homepage&&snapshot?.show_public_website&&snapshot?.is_public&&snapshot?.is_active)}});
  return NextResponse.json({suppliers,pendingProfiles,canonicalSuppliers:(canonical.data??[]).filter(row=>row.supplier_status==='active').map(row=>({supplier_id:row.supplier_id,name:row.company_name||row.supplier_name,source_profile_id:row.source_profile_id}))});
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if ('error' in auth) return fail(auth.status===401?'authentication_required':'admin_authorization_required',auth.status,auth.error);
  const form = await request.formData().catch(() => null);
  if (!form) return fail('Invalid form submission.', 400);
  const name = String(form.get('name') || '').trim();
  const canonicalSupplierId = String(form.get('canonical_supplier_id') || '').trim();
  const deliveryProduct = String(form.get('delivery_product') || '').trim();
  const picInput = String(form.get('pic') || '').trim();
  const file = form.get('file');
  if (!name) return fail('Supplier name is required.', 400);
  if (!canonicalSupplierId) return fail('canonical_supplier_required', 422, 'Select an existing canonical supplier before creating a Verified Supplier.');
  if (picInput.startsWith('blob:')) return fail('A temporary browser preview URL cannot be saved.', 400);
  const canonical=await auth.admin.from('suppliers').select('supplier_id,supplier_status').eq('supplier_id',canonicalSupplierId).maybeSingle();
  if(canonical.error||!canonical.data)return fail('canonical_supplier_invalid',422,'The selected canonical supplier does not exist.');
  if(canonical.data.supplier_status!=='active')return fail('canonical_supplier_inactive',422,'The selected canonical supplier is not active.');
  const duplicate=await auth.admin.from('verified_supplier').select('supplier_id').eq('canonical_supplier_id',canonicalSupplierId).maybeSingle();
  if(duplicate.data)return fail('canonical_supplier_already_verified',409,'This canonical supplier already has a Verified Supplier snapshot.');

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

  const payload={canonical_supplier_id:canonical.data.supplier_id,name,pic,delivery_product:deliveryProduct||null,show_on_homepage:bool(form,'show_on_homepage'),homepage_sort_order:order(form,'homepage_sort_order'),show_public_website:bool(form,'show_public_website'),public_directory_sort_order:order(form,'public_directory_sort_order'),is_public:bool(form,'is_public'),is_active:bool(form,'is_active')};
  const { data, error } = await auth.admin.from('verified_supplier').insert(payload).select(fields).single();
  if (error) {
    console.error('Verified supplier insert failed:', error.message);
    if (uploadedPath) await auth.admin.storage.from(bucket).remove([uploadedPath]);
    return fail('verified_supplier_create_failed', 500, 'Verified supplier could not be created.');
  }
  return NextResponse.json({ supplier: data }, { status: 201 });
}
