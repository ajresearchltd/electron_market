import {NextResponse} from 'next/server';
import {createClient} from '../../../../../../lib/supabase/server';
import {createAdminClient} from '../../../../../../lib/supabase/admin';
import {sendTestInvoiceEmail} from '../../../../../../lib/email/invoice-email';

const unauthorized=()=>NextResponse.json({success:false,emailDelivery:{status:'failed',recipient:null,error:'You are not authorized to send this Invoice.'}},{status:403});
export async function POST(_:Request,{params}:{params:Promise<{invoiceId:string}>}){
 const session=await createClient(),{data:{user}}=await session.auth.getUser();
 if(!user)return NextResponse.json({success:false,error:'Authentication required.'},{status:401});
 const profile=await session.from('user_profiles').select('role').eq('id',user.id).maybeSingle();
 if(profile.data?.role!=='customer')return unauthorized();
 const db=createAdminClient();if(!db)return NextResponse.json({success:false,error:'Invoice email service is unavailable.'},{status:503});
 const {invoiceId}=await params,owned=await db.from('procurement_invoices').select('id,invoice_number').eq('id',invoiceId).eq('customer_user_id',user.id).maybeSingle();
 if(owned.error||!owned.data)return unauthorized();
 const result=await sendTestInvoiceEmail(db,owned.data.id);
 if(result.status==='sent')return NextResponse.json({success:true,invoiceId:owned.data.id,invoiceNumber:result.invoiceNumber,emailDelivery:{status:result.status,recipient:result.recipient,messageId:result.messageId}});
 const missing=result.status==='not_attempted'&&result.error==='buyer_email_missing';
 return NextResponse.json({success:false,invoiceId:owned.data.id,invoiceNumber:result.invoiceNumber||owned.data.invoice_number,emailDelivery:{status:result.status,recipient:result.recipient,error:missing?'No Customer email is configured for this Invoice.':'Invoice email could not be delivered. The Invoice remains available.'}},{status:missing?422:502});
}
