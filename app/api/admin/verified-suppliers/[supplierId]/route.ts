import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminApi } from '../../../../../lib/auth/require-admin-api';
import { requireInternalApi } from '../../../../../lib/auth/require-internal-api';

const bucket='verified-supplier-images';const allowed=new Set(['image/png','image/jpeg','image/webp']);const max=2*1024*1024;
const fail=(error:string,status:number,detail?:string,fields?:Record<string,string>)=>NextResponse.json({error,detail,fields},{status});
const idFrom=async(params:Promise<{supplierId:string}>)=>{try{return decodeURIComponent((await params).supplierId).trim()}catch{return ''}};
const text=(value:unknown,maxLength=5000)=>{const result=String(value??'').trim();return result?result.slice(0,maxLength):null};
const emailTypes=new Set(['primary','correspondence','quotes','manager','accounting','logistics','support','alternative']);
const adminStatuses=new Set(['active','inactive','pending_review','suspended']);
const listFields='supplier_id,canonical_supplier_id,public_slug,name,pic,delivery_product,show_on_homepage,homepage_sort_order,show_public_website,public_directory_sort_order,is_public,is_active';
const formBool=(form:FormData,key:string)=>form.get(key)==='true';
const formOrder=(form:FormData,key:string)=>{const value=String(form.get(key)??'').trim();return value&&Number.isFinite(Number(value))?Math.trunc(Number(value)):0};

export async function GET(_:NextRequest,{params}:{params:Promise<{supplierId:string}>}){
  const auth=await requireInternalApi();if('error'in auth)return fail(auth.error,auth.status);const id=await idFrom(params);if(!id)return fail('Invalid supplier ID.',400);
  const [supplier,details,contacts,emails,audit,quarantine]=await Promise.all([
    auth.admin.from('verified_supplier').select('supplier_id,name,pic,delivery_product,public_short_description,public_country,show_public_website,show_on_homepage,homepage_sort_order,public_directory_sort_order,is_public,is_active').eq('supplier_id',id).maybeSingle(),
    auth.admin.from('verified_supplier_details').select('*').eq('supplier_id',id).maybeSingle(),
    auth.admin.from('supplier_company_contacts').select('contact_id,contact_index,contact_name,contact_position,department,contact_email,contact_phone,mobile_phone,contact_whatsapp,contact_notes,is_primary,is_active,created_at,updated_at').eq('verified_supplier_id',id).order('contact_index'),
    auth.admin.from('supplier_contact_emails').select('id,contact_id,contact_name,contact_role,email,email_type,is_active,is_verified,consented,can_send_quotes,consent_evidence_reference,consent_recorded_at,verification_method,verification_reason,verified_at,created_at,updated_at').eq('supplier_id',id).order('created_at'),
    auth.admin.from('supplier_contact_authorization_audit_log').select('id,email_id,action,reason,evidence_reference,evidence_type,confirmation_date,admin_note,confirmed_by,confirmed_at,actor_user_id,created_at').eq('supplier_id',id).order('created_at',{ascending:false}).limit(100),
    auth.admin.from('supplier_inbound_messages').select('id,sender_email,subject,received_at,processing_status,processing_error').eq('sender_authorization_status','quarantined').order('received_at',{ascending:false}).limit(25),
  ]);
  if(supplier.error||!supplier.data)return fail('Verified supplier was not found.',404);for(const result of [details,contacts,emails,audit,quarantine])if(result.error)return fail('Supplier details database setup is required.',503,result.error.message);
  const authorizedEmails=new Set((emails.data??[]).map((row:any)=>String(row.email).toLowerCase()));
  const emailAddresses=emails.data??[];
  return NextResponse.json({
    supplier:supplier.data,
    details:details.data,
    homepageSettings:{show_on_homepage:supplier.data.show_on_homepage,homepage_sort_order:supplier.data.homepage_sort_order,show_public_website:supplier.data.show_public_website,public_directory_sort_order:supplier.data.public_directory_sort_order,is_public:supplier.data.is_public,is_active:supplier.data.is_active},
    contacts:contacts.data??[],
    emailAddresses,
    authorizedQuoteSenders:emailAddresses.filter((row:any)=>row.is_active&&row.is_verified&&row.consented&&row.can_send_quotes),
    emails:emailAddresses,
    audit:audit.data??[],
    quarantinedMessages:(quarantine.data??[]).filter((row:any)=>authorizedEmails.has(String(row.sender_email??'').toLowerCase())),
  });
}

export async function PATCH(request:NextRequest,{params}:{params:Promise<{supplierId:string}>}){
  const auth=await requireInternalApi();if('error'in auth)return fail(auth.error,auth.status);const id=await idFrom(params);if(!id)return fail('Invalid supplier ID.',400);const body=await request.json().catch(()=>null);if(!body||typeof body!=='object')return fail('Invalid JSON body.',400);
  const current=await auth.admin.from('verified_supplier').select('supplier_id,canonical_supplier_id').eq('supplier_id',id).maybeSingle();if(!current.data)return fail('Verified supplier was not found.',404);
  const supplier=body.supplier??{},details=body.details??{};const name=text(supplier.name,200);if(!name)return fail('Supplier name is required.',400,undefined,{name:'Supplier name is required.'});
  const supplierUpdate={name,pic:text(supplier.pic,2000),delivery_product:text(supplier.delivery_product),public_short_description:text(supplier.public_short_description,500),public_country:text(supplier.public_country,120),show_public_website:Boolean(supplier.show_public_website),show_on_homepage:Boolean(supplier.show_on_homepage),homepage_sort_order:Number.isFinite(Number(supplier.homepage_sort_order))?Math.trunc(Number(supplier.homepage_sort_order)):0,public_directory_sort_order:Number.isFinite(Number(supplier.public_directory_sort_order))?Math.trunc(Number(supplier.public_directory_sort_order)):0,is_public:Boolean(supplier.is_public),is_active:Boolean(supplier.is_active)};
  if(!current.data.canonical_supplier_id&&(supplierUpdate.show_on_homepage||supplierUpdate.show_public_website))return fail('A canonical supplier link is required before public publication.',422);
  const updated=await auth.admin.from('verified_supplier').update(supplierUpdate).eq('supplier_id',id);if(updated.error)return fail('Supplier public profile could not be saved.',500,updated.error.message);
  const administrativeStatus=adminStatuses.has(String(details.administrative_status))?String(details.administrative_status):'active';const detailsPayload={supplier_id:id,supplier_user_id:text(details.supplier_user_id,100),legal_company_name:text(details.legal_company_name,250),display_name:text(details.display_name,250),detailed_description:text(details.detailed_description),product_categories:text(details.product_categories),country:text(details.country,120),city:text(details.city,120),company_address:text(details.company_address,500),postal_code:text(details.postal_code,40),website:text(details.website,1000),phone:text(details.phone,80),secondary_phone:text(details.secondary_phone,80),whatsapp:text(details.whatsapp,80),registration_number:text(details.registration_number,120),tax_number:text(details.tax_number,120),primary_company_email:text(details.primary_company_email,320),correspondence_email:text(details.correspondence_email,320),internal_admin_notes:text(details.internal_admin_notes),administrative_status:administrativeStatus};
  const detailSave=await auth.admin.from('verified_supplier_details').upsert(detailsPayload,{onConflict:'supplier_id'});if(detailSave.error)return fail('Private supplier details could not be saved.',500,detailSave.error.message);
  return NextResponse.json({ok:true});
}

export async function PUT(request:NextRequest,{params}:{params:Promise<{supplierId:string}>}){
 const auth=await requireAdminApi();if('error'in auth)return fail(auth.error,auth.status);const id=await idFrom(params);if(!id)return fail('Invalid supplier ID.',400);
 const multipart=request.headers.get('content-type')?.includes('multipart/form-data');const form=multipart?await request.formData().catch(()=>null):null;const json=!multipart?await request.json().catch(()=>null):null;if(!form&&!json)return fail('Invalid submission.',400);
 const value=(key:string)=>form?form.get(key):json?.[key];const boolValue=(key:string)=>form?formBool(form,key):value(key)===true;const orderValue=(key:string)=>form?formOrder(form,key):(Number.isFinite(Number(value(key)))?Math.trunc(Number(value(key))):0);
 const name=String(value('name')||'').trim(),delivery=String(value('delivery_product')||'').trim(),requestedCanonicalId=String(value('canonical_supplier_id')||'').trim()||null;let pic=String(value('pic')||'').trim()||null;const file=form?.get('file');
 if(!name)return fail('Supplier name is required.',400);if(pic?.startsWith('blob:'))return fail('A temporary browser preview URL cannot be saved.',400);
 const update={canonical_supplier_id:requestedCanonicalId,name,pic,delivery_product:delivery||null,show_on_homepage:boolValue('show_on_homepage'),homepage_sort_order:orderValue('homepage_sort_order'),show_public_website:boolValue('show_public_website'),public_directory_sort_order:orderValue('public_directory_sort_order'),is_public:boolValue('is_public'),is_active:boolValue('is_active')};
 if(process.env.NODE_ENV==='development')console.info('Verified supplier update payload',{supplier_id:id,...update,pic:update.pic?'[provided]':null});
 let path:string|null=null;if(file instanceof File&&file.size){if(!allowed.has(file.type))return fail('Supplier logo upload failed.',400,'Only PNG, JPEG, and WebP images are allowed.');if(file.size>max)return fail('Supplier logo upload failed.',400,'Image must be 2 MB or smaller.');path=`verified-suppliers/${id}/${crypto.randomUUID()}-${file.name.toLowerCase().replace(/[^a-z0-9.]+/g,'-')}`;const uploaded=await auth.admin.storage.from(bucket).upload(path,file,{contentType:file.type,upsert:false});if(uploaded.error){console.error('Supplier logo upload failed:',uploaded.error.message);return fail('Supplier logo upload failed.',500)}update.pic=auth.admin.storage.from(bucket).getPublicUrl(path).data.publicUrl}
 const existing=await auth.admin.from('verified_supplier').select('supplier_id,canonical_supplier_id').eq('supplier_id',id).maybeSingle();if(existing.error){console.error('Verified supplier lookup failed:',existing.error.message);return fail('verified_supplier_lookup_failed',500,'Verified supplier could not be loaded.');}if(!existing.data)return fail('verified_supplier_not_found',404,'Verified supplier was not found.');
 if(!requestedCanonicalId&&existing.data.canonical_supplier_id)update.canonical_supplier_id=existing.data.canonical_supplier_id;
 if(requestedCanonicalId&&requestedCanonicalId!==existing.data.canonical_supplier_id){const canonical=await auth.admin.from('suppliers').select('supplier_id,supplier_status').eq('supplier_id',requestedCanonicalId).maybeSingle();if(!canonical.data)return fail('canonical_supplier_invalid',422,'The selected canonical supplier does not exist.');if(canonical.data.supplier_status!=='active')return fail('canonical_supplier_inactive',422,'The selected canonical supplier is not active.');const duplicate=await auth.admin.from('verified_supplier').select('supplier_id').eq('canonical_supplier_id',requestedCanonicalId).neq('supplier_id',id).maybeSingle();if(duplicate.data)return fail('canonical_supplier_already_verified',409,'This canonical supplier already has a Verified Supplier snapshot.');}
 if(!existing.data.canonical_supplier_id&&(update.show_on_homepage||update.show_public_website))return fail('canonical_supplier_required',422,'A canonical supplier link is required before public publication.');
 const result=await auth.admin.from('verified_supplier').update(update).eq('supplier_id',id).select(listFields).single();
 if(result.error){console.error('Verified supplier update failed:',result.error.message);if(path)await auth.admin.storage.from(bucket).remove([path]);return fail('verified_supplier_update_failed',500,'Verified supplier could not be updated.');}
 if(result.data.show_on_homepage!==update.show_on_homepage||result.data.is_public!==update.is_public||result.data.show_public_website!==update.show_public_website||result.data.is_active!==update.is_active){console.error('Verified supplier update verification failed.',{supplierId:id});return fail('verified_supplier_update_not_persisted',500,'Verified supplier visibility settings were not persisted.');}
 revalidatePath('/');revalidatePath('/suppliers');if(result.data.public_slug)revalidatePath(`/suppliers/${result.data.public_slug}`);
 return NextResponse.json({supplier:result.data});
}
export async function DELETE(_:NextRequest,{params}:{params:Promise<{supplierId:string}>}){const auth=await requireAdminApi();if('error'in auth)return fail(auth.error,auth.status);const id=await idFrom(params);if(!id)return fail('Invalid supplier ID.',400);const{error}=await auth.admin.from('verified_supplier').delete().eq('supplier_id',id);if(error)return fail('Verified supplier record could not be deleted.',500,error.message);return NextResponse.json({ok:true})}
