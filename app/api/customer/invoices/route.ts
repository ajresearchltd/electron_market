import {NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {createAdminClient} from '../../../../lib/supabase/admin';
import {listInvoices} from '../../../../lib/invoices/server';
export async function GET(){const session=await createClient();const {data:{user}}=await session.auth.getUser();if(!user)return NextResponse.json({error:'Authentication required.'},{status:401});const role=await session.from('user_profiles').select('role').eq('id',user.id).maybeSingle();if(role.data?.role!=='customer')return NextResponse.json({error:'Customer authorization is required.'},{status:403});const db=createAdminClient();if(!db)return NextResponse.json({error:'Invoice service is unavailable.'},{status:503});try{return NextResponse.json({invoices:await listInvoices(db,'customer',user.id,100)})}catch(error){console.error('Customer Invoice list failed:',error);return NextResponse.json({error:'Invoices could not be loaded.'},{status:500})}}
