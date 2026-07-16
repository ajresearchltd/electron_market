import {NextResponse} from 'next/server';
import {requireInternalApi} from '../../../../../../lib/auth/require-internal-api';
import {sendTestInvoiceEmail} from '../../../../../../lib/email/invoice-email';
export async function POST(_:Request,{params}:{params:Promise<{invoiceId:string}>}){const auth=await requireInternalApi();if('error'in auth)return NextResponse.json({error:auth.error},{status:auth.status});if(auth.role!=='admin')return NextResponse.json({error:'Admin authorization is required.'},{status:403});const result=await sendTestInvoiceEmail(auth.admin,(await params).invoiceId);return NextResponse.json({emailDelivery:result},{status:result.status==='sent'?200:result.status==='not_attempted'?422:502})}
