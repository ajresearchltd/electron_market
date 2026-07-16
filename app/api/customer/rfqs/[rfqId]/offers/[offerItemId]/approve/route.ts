import {NextResponse} from 'next/server';
import {createClient} from '../../../../../../../../lib/supabase/server';
import {createAdminClient} from '../../../../../../../../lib/supabase/admin';
import {approveSupplierOfferForRfqItem} from '../../../../../../../../lib/rfqs/approve-supplier-offer';
import {revalidatePath} from 'next/cache';

const fail=(error:string,status:number)=>NextResponse.json({error},{status});
export async function POST(request:Request,{params}:{params:Promise<{rfqId:string;offerItemId:string}>}){
 const {rfqId,offerItemId}=await params,userClient=await createClient(),{data:{user}}=await userClient.auth.getUser();if(!user)return fail('You must be signed in.',401);
 const database=createAdminClient();if(!database)return fail('Offer approval is temporarily unavailable.',503);
 const [profile,rfq]=await Promise.all([database.from('user_profiles').select('role').eq('id',user.id).maybeSingle(),database.from('rfq_orders0').select('rfq_id,customer_id,procurement_chain_id').eq('rfq_id',rfqId).maybeSingle()]);
 if(profile.data?.role!=='customer')return fail('Customer authorization required.',403);if(!rfq.data)return fail('RFQ not found.',404);if(rfq.data.customer_id!==user.id)return fail('You cannot approve an offer for this RFQ.',403);
 const body=await request.json().catch(()=>({})),rfqItemId=String(body.rfqItemId??'');if(!rfqItemId)return fail('RFQ position is required.',400);
 const result=await approveSupplierOfferForRfqItem(database,{rfqId,rfqItemId,offerItemId,actorUserId:user.id,actorRole:'customer'});if('error'in result)return fail(result.error,result.status);
 const readback=result.data,invoiceEligible=readback.invoiceEligible;
 revalidatePath(`/customer/rfqs/${rfqId}`);revalidatePath('/customer/dashboard');revalidatePath(`/admin/rfqs/${rfqId}`);revalidatePath('/admin');revalidatePath(`/supplier/rfqs/${rfqId}`);revalidatePath('/supplier/dashboard');
 if(rfq.data.procurement_chain_id)revalidatePath(`/admin/procurement-progress/${rfq.data.procurement_chain_id}`);
 return NextResponse.json({success:true,rfqId,rfqItemId:readback.rfq_item_id,offerItemId,isApproved:true,approvalStatus:'approved',approvedQuantity:readback.allocated_quantity,unitPrice:readback.selected_unit_price,currency:readback.currency,priceBasis:`${readback.price_basis_quantity} / ${readback.price_basis_unit}`,invoiceEligible,approvedByRole:'customer',approvedAt:readback.selected_at},{status:200});
}
