import {NextResponse} from 'next/server';
import {requireInternalApi} from '../../../../../../lib/auth/require-internal-api';
import {loadInvoicePaymentDocument} from '../../../../../../lib/invoices/payment-document';

export async function GET(_:Request,{params}:{params:Promise<{invoiceId:string}>}){
  const auth=await requireInternalApi();if('error'in auth)return NextResponse.json({error:auth.error},{status:auth.status});
  if(auth.role!=='admin')return NextResponse.json({error:'You are not authorized to access this payment document.'},{status:403});
  const invoice=await auth.admin.from('procurement_invoices').select('id,paid_document_path,paid_document_original_name,paid_document_mime_type').eq('id',(await params).invoiceId).maybeSingle();
  if(invoice.error||!invoice.data)return NextResponse.json({error:'Invoice was not found.'},{status:404});
  try{const file=await loadInvoicePaymentDocument(auth.admin,invoice.data);return new NextResponse(file.blob,{headers:{'Content-Type':file.mimeType,'Content-Disposition':`attachment; filename="${file.filename}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})}catch{return NextResponse.json({error:'Payment document is not available.'},{status:404})}
}
