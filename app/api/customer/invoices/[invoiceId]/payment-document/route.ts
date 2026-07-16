import {NextResponse} from 'next/server';
import {createClient} from '../../../../../../lib/supabase/server';
import {createAdminClient} from '../../../../../../lib/supabase/admin';
import {loadInvoicePaymentDocument, PAYMENT_DOCUMENT_ERROR, uploadInvoicePaymentDocument} from '../../../../../../lib/invoices/payment-document';

const unavailable=()=>NextResponse.json({error:'Payment document is not available.'},{status:404});
async function context(invoiceId:string){
  const session=await createClient(),{data:{user}}=await session.auth.getUser();
  if(!user)return {response:NextResponse.json({error:'Authentication required.'},{status:401})};
  const role=await session.from('user_profiles').select('role').eq('id',user.id).maybeSingle();
  if(role.data?.role!=='customer')return {response:NextResponse.json({error:'You are not authorized to access this payment document.'},{status:403})};
  const db=createAdminClient();if(!db)return {response:NextResponse.json({error:'Payment document could not be uploaded.'},{status:503})};
  const invoice=await db.from('procurement_invoices').select('id,customer_user_id,paid_boolean,paid_at,paid_document_path,paid_document_original_name,paid_document_mime_type,paid_document_size_bytes,paid_document_uploaded_at,paid_document_uploaded_by').eq('id',invoiceId).eq('customer_user_id',user.id).maybeSingle();
  if(invoice.error||!invoice.data)return {response:NextResponse.json({error:'Invoice was not found.'},{status:404})};
  return {db,user,invoice:invoice.data};
}

export async function POST(request:Request,{params}:{params:Promise<{invoiceId:string}>}){
  const auth=await context((await params).invoiceId);if('response'in auth)return auth.response;
  const form=await request.formData().catch(()=>null),file=form?.get('file');
  if(!(file instanceof File))return NextResponse.json({error:'Please select a payment document.'},{status:400});
  try{const payment=await uploadInvoicePaymentDocument(auth.db,auth.invoice,auth.user.id,file);return NextResponse.json({success:true,message:'Payment document was uploaded successfully.',invoice:{id:payment.id,invoiceNumber:payment.invoice_number,status:payment.invoice_status,paidBoolean:Boolean(payment.paid_boolean),paidAt:payment.paid_at,paymentDocument:{originalName:payment.paid_document_original_name,mimeType:payment.paid_document_mime_type,sizeBytes:Number(payment.paid_document_size_bytes),uploadedAt:payment.paid_document_uploaded_at},payment:{paid:Boolean(payment.paid_boolean),paidAt:payment.paid_at,originalName:payment.paid_document_original_name,mimeType:payment.paid_document_mime_type,sizeBytes:Number(payment.paid_document_size_bytes),uploadedAt:payment.paid_document_uploaded_at,uploadedBy:payment.paid_document_uploaded_by,downloadAvailable:true}}})}catch(error){const message=error instanceof Error&&error.message===PAYMENT_DOCUMENT_ERROR?PAYMENT_DOCUMENT_ERROR:'Payment document could not be uploaded.';return NextResponse.json({error:message},{status:message===PAYMENT_DOCUMENT_ERROR?400:500})}
}

export async function GET(_:Request,{params}:{params:Promise<{invoiceId:string}>}){
  const auth=await context((await params).invoiceId);if('response'in auth)return auth.response;
  try{const file=await loadInvoicePaymentDocument(auth.db,auth.invoice);return new NextResponse(file.blob,{headers:{'Content-Type':file.mimeType,'Content-Disposition':`attachment; filename="${file.filename}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})}catch{return unavailable()}
}
