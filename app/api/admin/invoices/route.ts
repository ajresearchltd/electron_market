import {NextResponse} from 'next/server';
import {requireInternalApi} from '../../../../lib/auth/require-internal-api';
import {listInvoices} from '../../../../lib/invoices/server';
export async function GET(){const auth=await requireInternalApi();if('error'in auth)return NextResponse.json({error:auth.error},{status:auth.status});if(auth.role!=='admin')return NextResponse.json({error:'Admin authorization is required.'},{status:403});try{return NextResponse.json({invoices:await listInvoices(auth.admin,'admin',undefined,50)})}catch(error){console.error('Admin Invoice list failed:',error);return NextResponse.json({error:'Invoices could not be loaded.'},{status:500})}}
