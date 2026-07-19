import {NextResponse} from 'next/server';
import {requireInternalApi} from '../../../../../../lib/auth/require-internal-api';
import {resolveCanonicalSupplierId} from '../../../../../../lib/suppliers/canonical';
import {mapSupplierProfile,missingRequiredPublicProfileFields,toVerifiedSupplierPublicColumns,validateSupplierProfile} from '../../../../../../lib/suppliers/profile-contract';

const fail=(error:string,status:number,details?:unknown)=>NextResponse.json({error,details},{status});
const safeReason=(value:unknown)=>String(value??'').trim().replace(/[<>]/g,'').slice(0,1000);
const safeOrder=(value:unknown)=>Number.isFinite(Number(value))?Math.trunc(Number(value)):0;
const slugify=(value:string)=>value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||'supplier';

async function context(inputId:string){
 const auth=await requireInternalApi();if('error'in auth)return{response:fail(auth.error,auth.status)} as const;
 if(!['admin','support'].includes(auth.role))return{response:fail('Admin or authorized Support access is required.',403)} as const;
 let identity;try{identity=await resolveCanonicalSupplierId(auth.admin,inputId)}catch{return{response:fail('Supplier relationship could not be resolved.',409)} as const}
 if(!identity)return{response:fail('Canonical supplier was not found.',404)} as const;
 const snapshot=await auth.admin.from('verified_supplier').select('*').eq('canonical_supplier_id',identity.canonicalSupplierId).maybeSingle();
 if(snapshot.error)return{response:fail('Approved snapshot could not be loaded.',500)} as const;
 return{auth,identity,snapshot:snapshot.data} as const;
}
async function audit(ctx:any,action:string,reason:string|null,previous_values?:unknown,new_values?:unknown){
 const result=await ctx.auth.admin.from('supplier_verification_audit_log').insert({profile_id:ctx.identity.sourceProfileId,canonical_supplier_id:ctx.identity.canonicalSupplierId,verified_supplier_id:ctx.snapshot?.supplier_id??null,action,reason,previous_values:previous_values??null,new_values:new_values??null,performed_by:ctx.auth.user.id});
 if(result.error){console.error('Public profile audit failed:',result.error.message);return false}return true;
}

export async function POST(request:Request,{params}:{params:Promise<{supplierId:string}>}){
 const body=await request.json().catch(()=>null);if(!body||typeof body.action!=='string')return fail('Invalid action.',400);
 const ctx=await context((await params).supplierId);if('response'in ctx)return ctx.response;
 const now=new Date().toISOString(),profile=ctx.identity.profile,action=body.action;
 if(action==='approve'){
  if(profile.public_profile_status!=='pending_review')return fail('Only a formally submitted pending profile can be approved.',409);
  const mapped=mapSupplierProfile(profile),validation=validateSupplierProfile(mapped),missing=missingRequiredPublicProfileFields(mapped);
  const validationErrors='errors' in validation?validation.errors:[];
  if(validationErrors.length||missing.length)return fail('The draft does not satisfy the public profile contract.',422,{errors:validationErrors,missing});
  const publicValues=toVerifiedSupplierPublicColumns(mapped);let snapshot=ctx.snapshot;const rollbackKeys=[...Object.keys(publicValues),'public_slug','is_active','is_public','show_public_website','show_on_homepage','public_directory_sort_order','homepage_sort_order'];const previousSnapshot=ctx.snapshot?Object.fromEntries(rollbackKeys.map(key=>[key,ctx.snapshot[key]])):null;let createdSnapshot=false;
  if(snapshot){const saved=await ctx.auth.admin.from('verified_supplier').update(publicValues).eq('supplier_id',snapshot.supplier_id).eq('canonical_supplier_id',ctx.identity.canonicalSupplierId).select('*').single();if(saved.error)return fail('Approved snapshot could not be updated.',500);snapshot=saved.data}
  else {let slug=slugify(mapped.publicDisplayName);const collision=await ctx.auth.admin.from('verified_supplier').select('supplier_id').eq('public_slug',slug).maybeSingle();if(collision.data)slug=`${slug}-${ctx.identity.canonicalSupplierId.slice(0,8)}`;const saved=await ctx.auth.admin.from('verified_supplier').insert({...publicValues,canonical_supplier_id:ctx.identity.canonicalSupplierId,public_slug:slug,is_active:true,is_public:false,show_public_website:false,show_on_homepage:false,public_directory_sort_order:0,homepage_sort_order:0}).select('*').single();if(saved.error)return fail(saved.error.code==='23505'?'An approved snapshot already exists for this canonical supplier.':'Approved snapshot could not be created.',saved.error.code==='23505'?409:500);snapshot=saved.data;createdSnapshot=true}
  const updated=await ctx.auth.admin.from('supplier_company_profiles').update({public_profile_status:'approved',reviewed_at:now,reviewed_by:ctx.auth.user.id,decision_reason:null,has_pending_public_changes:false}).eq('profile_id',ctx.identity.sourceProfileId).eq('public_profile_status','pending_review').select('*').single();
  if(updated.error){if(createdSnapshot)await ctx.auth.admin.from('verified_supplier').delete().eq('supplier_id',snapshot.supplier_id).eq('canonical_supplier_id',ctx.identity.canonicalSupplierId);else if(previousSnapshot)await ctx.auth.admin.from('verified_supplier').update(previousSnapshot).eq('supplier_id',snapshot.supplier_id).eq('canonical_supplier_id',ctx.identity.canonicalSupplierId);return fail('Draft approval status could not be saved; the approved snapshot was restored.',409)}const audited=await audit({...ctx,snapshot},'public_profile_approved',null,{status:'pending_review'},{status:'approved'});return NextResponse.json({profile:updated.data,snapshot,auditRecorded:audited});
 }
 if(action==='reject'){
  if(profile.public_profile_status!=='pending_review')return fail('Only a pending profile can be rejected.',409);const reason=safeReason(body.reason);if(reason.length<3)return fail('A safe Supplier-visible rejection reason is required.',422);
  const saved=await ctx.auth.admin.from('supplier_company_profiles').update({public_profile_status:'rejected',reviewed_at:now,reviewed_by:ctx.auth.user.id,decision_reason:reason,admin_notes:safeReason(body.internalNotes)||profile.admin_notes}).eq('profile_id',ctx.identity.sourceProfileId).eq('public_profile_status','pending_review').select('*').single();if(saved.error)return fail('Rejection could not be saved.',409);await audit(ctx,'public_profile_rejected',reason,{status:'pending_review'},{status:'rejected'});return NextResponse.json({profile:saved.data});
 }
 if(action==='suspend'){
  if(!['pending_review','approved'].includes(profile.public_profile_status))return fail('This profile cannot be suspended from its current state.',409);
  const p=await ctx.auth.admin.from('supplier_company_profiles').update({public_profile_status:'suspended',reviewed_at:now,reviewed_by:ctx.auth.user.id}).eq('profile_id',ctx.identity.sourceProfileId).select('*').single();if(p.error)return fail('Profile could not be suspended.',409);
  if(ctx.snapshot){const s=await ctx.auth.admin.from('verified_supplier').update({is_public:false,show_public_website:false,show_on_homepage:false}).eq('supplier_id',ctx.snapshot.supplier_id);if(s.error)return fail('Profile was suspended but visibility could not be disabled.',500)}await audit(ctx,'public_profile_suspended',null);return NextResponse.json({profile:p.data});
 }
 if(action==='restore'){
  if(profile.public_profile_status!=='suspended')return fail('Only a suspended profile can be restored.',409);const next=ctx.snapshot?'approved':'draft';const p=await ctx.auth.admin.from('supplier_company_profiles').update({public_profile_status:next,reviewed_at:now,reviewed_by:ctx.auth.user.id}).eq('profile_id',ctx.identity.sourceProfileId).select('*').single();if(p.error)return fail('Profile could not be restored.',409);await audit(ctx,'public_profile_restored',null,{status:'suspended'},{status:next});return NextResponse.json({profile:p.data});
 }
 if(action==='publication'){
  if(!ctx.snapshot)return fail('An approved snapshot is required.',409);const directory=Boolean(body.show_public_website),isPublic=Boolean(body.is_public),isActive=Boolean(body.is_active),homepage=Boolean(body.show_on_homepage);
  if(homepage&&(!directory||!isPublic||!isActive))return fail('Homepage display requires an active, public, Directory-eligible snapshot.',422);
  const values={is_active:isActive,is_public:isPublic,show_public_website:directory,show_on_homepage:homepage,public_directory_sort_order:safeOrder(body.public_directory_sort_order),homepage_sort_order:safeOrder(body.homepage_sort_order)};
  const saved=await ctx.auth.admin.from('verified_supplier').update(values).eq('supplier_id',ctx.snapshot.supplier_id).eq('canonical_supplier_id',ctx.identity.canonicalSupplierId).select('*').single();if(saved.error)return fail('Publication controls could not be saved.',500);await audit(ctx,directory?'public_profile_published':'public_profile_unpublished',null,undefined,values);if(homepage!==ctx.snapshot.show_on_homepage)await audit(ctx,homepage?'public_profile_homepage_enabled':'public_profile_homepage_disabled',null);return NextResponse.json({snapshot:saved.data});
 }
 return fail('Unsupported public profile action.',400);
}
