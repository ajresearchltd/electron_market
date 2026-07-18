import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { createRequiredAdminClient } from '../supabase/admin';
import { createClient } from '../supabase/server';
import { sendSmtp, verifySmtp } from '../email/smtp';
import { EMAIL_OTP_LENGTH, normalizePublicRequestEmail, validCanonicalEmailOtp, validPublicRequestEmail } from './policy';

const browserCookie='em_public_request_browser',purpose='public_request_access';
export class PublicRequestCodeError extends Error{constructor(public stage:string,public diagnosticCode:string,public status:number,public safeMessage:string,public safeDetails?:Record<string,string|number|boolean>){super(safeMessage)}}
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
const secret=()=>process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SMTP_PASSWORD||'';
const codeDigest=(id:string,email:string,code:string)=>createHmac('sha256',secret()).update(`${id}:${email}:${code}`).digest('hex');
const equal=(a:string,b:string)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)};
const mask=(email:string)=>{const[name,domain]=email.split('@');return`${name.slice(0,1)}${'*'.repeat(Math.max(3,name.length-2))}${name.length>1?name.slice(-1):''}@${domain}`};
async function browserToken(){const store=await cookies();let value=store.get(browserCookie)?.value;if(!value){value=randomBytes(32).toString('base64url');store.set(browserCookie,value,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:86400})}return value}

export async function sendCanonicalEmailCode(rawEmail:unknown){
  const email=normalizePublicRequestEmail(rawEmail);
  if(!validPublicRequestEmail(email))throw new PublicRequestCodeError('email_validated','INVALID_EMAIL',400,'Enter a valid email address.');
  const database=createRequiredAdminClient(),sessionHash=digest(await browserToken());
  const recent=await database.from('public_request_verifications').select('id,resend_count,last_sent_at').eq('session_key_hash',sessionHash).eq('normalized_email',email).eq('purpose',purpose).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(recent.error){const schema=['42P01','42703'].includes(recent.error.code||'');throw new PublicRequestCodeError('rate_limit_checked',schema?'CHALLENGE_SCHEMA_MISSING':'CHALLENGE_LOOKUP_FAILED',schema?500:503,schema?'Verification challenge storage is not installed.':'Verification protection is temporarily unavailable.')}
  if(recent.data){const elapsed=Date.now()-new Date(recent.data.last_sent_at).getTime();if(elapsed<60000)throw new PublicRequestCodeError('rate_limit_checked','SEND_COOLDOWN',429,'Please wait before requesting another code.');if(Number(recent.data.resend_count)>=5)throw new PublicRequestCodeError('rate_limit_checked','SEND_RATE_LIMITED',429,'Too many verification emails were requested. Please try again later.')}
  let generated;try{generated=await database.auth.admin.generateLink({type:'magiclink',email,options:{data:{auth_source:'electron_market_email_code'}}})}catch{throw new PublicRequestCodeError('generate_link_called','SUPABASE_GENERATE_LINK_NETWORK_FAILED',503,'Authentication service is temporarily unavailable.')}
  const otp=generated.data.properties?.email_otp;
  if(generated.error)throw new PublicRequestCodeError('generate_link_called',String((generated.error as any).code||'SUPABASE_GENERATE_LINK_FAILED'),503,'Authentication service could not generate a verification code.');
  if(!validCanonicalEmailOtp(otp))throw new PublicRequestCodeError('email_otp_extracted','EMAIL_OTP_FORMAT_INVALID',503,'We could not generate a valid eight-digit verification code. Please try again.',{otpPresent:Boolean(otp),otpLength:String(otp||'').length,otpNumeric:/^\d+$/.test(String(otp||'')),sdkProperty:'data.properties.email_otp'});
  const generatedUser=generated.data.user,newAuthUser=!generatedUser.last_sign_in_at&&Date.now()-new Date(generatedUser.created_at).getTime()<30000;
  if(newAuthUser)await database.from('user_profiles').delete().eq('id',generatedUser.id);
  const id=crypto.randomUUID(),now=new Date(),expires=new Date(now.getTime()+10*60000);
  await database.from('public_request_verifications').update({consumed_at:now.toISOString(),updated_at:now.toISOString()}).eq('session_key_hash',sessionHash).eq('normalized_email',email).eq('purpose',purpose).is('consumed_at',null);
  const inserted=await database.from('public_request_verifications').insert({id,session_key_hash:sessionHash,normalized_email:email,purpose,code_digest:codeDigest(id,email,otp),expires_at:expires.toISOString(),last_sent_at:now.toISOString(),resend_count:Number(recent.data?.resend_count??-1)+1}).select('id').single();
  if(inserted.error){if(newAuthUser)await database.auth.admin.deleteUser(generatedUser.id);const schema=['42P01','42703'].includes(inserted.error.code||'');throw new PublicRequestCodeError('challenge_persisted',schema?'CHALLENGE_SCHEMA_MISSING':'CHALLENGE_PERSIST_FAILED',schema?500:503,schema?'Verification challenge storage is not installed.':'Verification challenge could not be saved.')}
  try{await verifySmtp()}catch{await database.from('public_request_verifications').delete().eq('id',id);if(newAuthUser)await database.auth.admin.deleteUser(generatedUser.id);throw new PublicRequestCodeError('smtp_verified','SMTP_VERIFY_FAILED',503,'Electron Market email service is temporarily unavailable.')}
  try{const delivery=await sendSmtp({to:email,subject:'Your Electron Market verification code',text:`Hello,\n\nYour secure eight-digit Electron Market verification code is:\n\n${otp}\n\nEnter this code on the Electron Market website to continue securely.\n\nThis code expires in 10 minutes. Do not share this code with anyone.\n\nIf you did not request this code, you may ignore this email.\n\nElectron Market`,html:`<div style="background:#f3f6fb;padding:32px 16px;font-family:Arial,sans-serif;color:#0b1f3a"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #dbe5f1;border-radius:16px;padding:32px"><h1 style="margin:0;color:#071b3a;font-size:24px">Electron Market</h1><p style="line-height:1.6">Your secure eight-digit verification code is:</p><div style="margin:24px 0;padding:18px;text-align:center;background:#071b3a;color:#fff;border-radius:10px;font-size:34px;font-weight:700;letter-spacing:8px">${otp}</div><p style="line-height:1.6">Enter this code on the Electron Market website to continue securely. It expires in 10 minutes.</p><p style="line-height:1.6"><strong>Do not share this code with anyone.</strong></p><p style="color:#52627a;font-size:13px">If you did not request this code, you may ignore this email.</p></div></div>`});if(!delivery.accepted.length)throw new Error('recipient_not_accepted')}catch{await database.from('public_request_verifications').delete().eq('id',id);if(newAuthUser)await database.auth.admin.deleteUser(generatedUser.id);throw new PublicRequestCodeError('smtp_send_accepted','SMTP_RECIPIENT_REJECTED',503,'Electron Market could not deliver the verification code.')}
  return{ok:true,challengeId:id,maskedEmail:mask(email),cooldownSeconds:60,message:'If the email is valid, a verification code has been sent.'};
}

export async function verifyCanonicalEmailCode(rawEmail:unknown,rawCode:unknown,rawChallengeId:unknown){
  const email=normalizePublicRequestEmail(rawEmail),code=String(rawCode??'').trim(),challengeId=String(rawChallengeId??'');
  if(!validPublicRequestEmail(email)||!validCanonicalEmailOtp(code)||!/^[0-9a-f-]{36}$/i.test(challengeId))return{ok:false,error:'Enter the complete eight-digit verification code.'};
  const database=createRequiredAdminClient(),sessionHash=digest(await browserToken()),challenge=await database.from('public_request_verifications').select('id,code_digest,attempt_count,expires_at,consumed_at').eq('id',challengeId).eq('session_key_hash',sessionHash).eq('normalized_email',email).eq('purpose',purpose).maybeSingle();
  if(!challenge.data)return{ok:false,error:'The verification code is invalid.'};if(challenge.data.consumed_at)return{ok:false,error:'This code has already been used. Please request a new code.'};if(new Date(challenge.data.expires_at)<=new Date())return{ok:false,error:'This code has expired. Please request a new code.'};if(Number(challenge.data.attempt_count)>=5)return{ok:false,error:'Verification attempts exceeded. Please request a new code.'};
  if(!equal(challenge.data.code_digest,codeDigest(challengeId,email,code))){await database.from('public_request_verifications').update({attempt_count:Number(challenge.data.attempt_count)+1,updated_at:new Date().toISOString()}).eq('id',challengeId);return{ok:false,error:Number(challenge.data.attempt_count)+1>=5?'Verification attempts exceeded. Please request a new code.':'The verification code is incorrect.'}}
  const session=await createClient(),verified=await session.auth.verifyOtp({email,token:code,type:'email'});
  if(verified.error||!verified.data.user||!verified.data.session)return{ok:false,error:'The verification code is invalid or has expired.'};
  await database.from('public_request_verifications').update({consumed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',challengeId).is('consumed_at',null);
  return{ok:true,user:verified.data.user};
}
