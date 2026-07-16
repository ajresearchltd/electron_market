import { NextResponse } from 'next/server';
import { requireInternalApi } from '../../../../../../../lib/auth/require-internal-api';

const types=new Set(['primary','correspondence','quotes','manager','accounting','logistics','support','alternative']);
const fail=(error:string,status=400,detail?:string)=>NextResponse.json({error,detail},{status});
const mailbox=(value:unknown)=>String(value??'').trim().match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0]?.toLowerCase()??'';

export async function PATCH(request:Request,{params}:{params:Promise<{supplierId:string;emailId:string}>}) {
  const auth=await requireInternalApi();if('error'in auth)return fail(auth.error,auth.status);
  const {supplierId,emailId}=await params;const body=await request.json().catch(()=>null);if(!body)return fail('Invalid JSON body.');
  const before=await auth.admin.from('supplier_contact_emails').select('*').eq('id',emailId).eq('supplier_id',supplierId).maybeSingle();if(!before.data)return fail('Supplier email was not found.',404);
  const reason=String(body.admin_note??body.reason??'').trim(),evidence=String(body.evidence_reference??'').trim();
  const evidenceType=String(body.evidence_type??'').trim(),confirmationDate=String(body.confirmation_date??'').trim();
  const evidenceTypes=new Set(['supplier_email','signed_agreement','supplier_portal_confirmation','other']);
  const grantsVerification=body.is_verified===true&&!before.data.is_verified,grantsConsent=body.consented===true&&!before.data.consented;
  if((grantsVerification||grantsConsent)&&(!reason||!evidence||!evidenceTypes.has(evidenceType)||!/^\d{4}-\d{2}-\d{2}$/.test(confirmationDate)))return fail('Evidence reference, evidence type, confirmation date, and Admin note are required.',400);
  const update:any={};
  for(const key of ['contact_id','supplier_user_id','contact_name','contact_role','is_active','is_verified','consented','can_send_quotes'])if(Object.hasOwn(body,key))update[key]=body[key];
  if(Object.hasOwn(body,'email')){const address=mailbox(body.email);if(!address)return fail('A valid email address is required.');update.email=address;}
  if(Object.hasOwn(body,'email_type')){if(!types.has(String(body.email_type)))return fail('Invalid email type.');update.email_type=body.email_type;}
  if(body.is_verified===true&&!before.data.is_verified)Object.assign(update,{verified_at:new Date().toISOString(),verified_by:auth.user.id,verification_method:'manual',verification_reason:reason});
  if(body.is_verified===false)Object.assign(update,{verified_at:null,verified_by:null});
  if(body.consented===true&&!before.data.consented)Object.assign(update,{consent_recorded_at:new Date().toISOString(),consent_recorded_by:auth.user.id,consent_evidence_reference:evidence});
  if(body.consented===false)Object.assign(update,{consent_recorded_at:null,consent_recorded_by:null});
  const saved=await auth.admin.from('supplier_contact_emails').update(update).eq('id',emailId).eq('supplier_id',supplierId).select('*').single();if(saved.error)return fail('Email could not be saved.',409,saved.error.message);
  const actions:string[]=[];if(grantsVerification)actions.push('verified_manually');if(grantsConsent)actions.push('consent_recorded');if(before.data.consented&&!saved.data.consented)actions.push('consent_revoked');if(!before.data.can_send_quotes&&saved.data.can_send_quotes)actions.push('quote_permission_granted');if(before.data.can_send_quotes&&!saved.data.can_send_quotes)actions.push('quote_permission_revoked');if(before.data.is_active&&!saved.data.is_active)actions.push('deactivated');if(!before.data.is_active&&saved.data.is_active)actions.push('activated');if(!actions.length)actions.push('updated');
  const confirmedAt=(grantsVerification||grantsConsent)?new Date().toISOString():null;
  const audits=actions.map(action=>({supplier_id:supplierId,email_id:emailId,action,previous_state:before.data,new_state:saved.data,reason:reason||null,evidence_reference:evidence||null,evidence_type:evidenceType||null,confirmation_date:confirmationDate||null,admin_note:reason||null,confirmed_by:confirmedAt?auth.user.id:null,confirmed_at:confirmedAt,actor_user_id:auth.user.id}));
  const auditSave=await auth.admin.from('supplier_contact_authorization_audit_log').insert(audits);if(auditSave.error)return fail('Email was saved, but its authorization audit could not be recorded.',500,auditSave.error.message);
  return NextResponse.json({email:saved.data});
}

export async function DELETE(_:Request,{params}:{params:Promise<{supplierId:string;emailId:string}>}) {
  const auth=await requireInternalApi();if('error'in auth)return fail(auth.error,auth.status);const {supplierId,emailId}=await params;
  const before=await auth.admin.from('supplier_contact_emails').select('*').eq('id',emailId).eq('supplier_id',supplierId).maybeSingle();if(!before.data)return fail('Supplier email was not found.',404);
  const removed=await auth.admin.from('supplier_contact_emails').delete().eq('id',emailId).eq('supplier_id',supplierId);if(removed.error)return fail('Email could not be deleted.',409,removed.error.message);
  await auth.admin.from('supplier_contact_authorization_audit_log').insert({supplier_id:supplierId,email_id:null,action:'deleted',previous_state:before.data,actor_user_id:auth.user.id});return NextResponse.json({ok:true});
}
