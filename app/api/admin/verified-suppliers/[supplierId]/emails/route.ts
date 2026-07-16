import { NextResponse } from 'next/server';
import { requireInternalApi } from '../../../../../../lib/auth/require-internal-api';

const types = new Set(['primary','correspondence','quotes','manager','accounting','logistics','support','alternative']);
const fail=(error:string,status=400,detail?:string)=>NextResponse.json({error,detail},{status});
const mailbox=(value:unknown)=>String(value??'').trim().match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0]?.toLowerCase()??'';

export async function POST(request:Request,{params}:{params:Promise<{supplierId:string}>}) {
  const auth=await requireInternalApi(); if('error' in auth)return fail(auth.error,auth.status);
  const supplierId=decodeURIComponent((await params).supplierId).trim();
  const body=await request.json().catch(()=>null); if(!body)return fail('Invalid JSON body.');
  const address=mailbox(body.email);
  if(!/^\S+@\S+\.\S+$/.test(address))return fail('A valid email address is required.',400);
  const payload={supplier_id:supplierId,contact_id:body.contact_id||null,supplier_user_id:body.supplier_user_id||null,contact_name:String(body.contact_name??'').trim()||null,contact_role:String(body.contact_role??'').trim()||null,email:address,email_type:types.has(String(body.email_type))?body.email_type:'alternative',is_active:body.is_active!==false,is_verified:false,consented:false,can_send_quotes:false};
  const created=await auth.admin.from('supplier_contact_emails').insert(payload).select('*').single();
  if(created.error)return fail('Email could not be added.',409,created.error.message);
  await auth.admin.from('supplier_contact_authorization_audit_log').insert({supplier_id:supplierId,email_id:created.data.id,action:'created',new_state:created.data,actor_user_id:auth.user.id});
  return NextResponse.json({email:created.data},{status:201});
}
