import { NextResponse } from 'next/server';
import { requireInternalApi } from '../../../../../lib/auth/require-internal-api';
import { revalidatePath } from 'next/cache';

const fail=(error:string,status:number)=>NextResponse.json({error},{status});
const safeText=(value:unknown)=>typeof value==='string'&&value.trim()?value.trim():null;

export async function GET(_:Request,{params}:{params:Promise<{rfqId:string}>}){
  const auth=await requireInternalApi();if('error'in auth)return fail(auth.error,auth.status);const {rfqId}=await params;
  const header=await auth.admin.from('rfq_orders0').select('*').eq('rfq_id',rfqId).maybeSingle();if(header.error)return fail('RFQ could not be loaded.',500);if(!header.data)return fail('RFQ not found.',404);
  const chainId=header.data.procurement_chain_id;
  const [chain,progress,items,bom,preferences,messages,responses,allocations,invoices,workflow]=await Promise.all([
    chainId?auth.admin.from('procurement_chains').select('*').eq('id',chainId).maybeSingle():Promise.resolve({data:null,error:null}),
    chainId?auth.admin.from('procurement_progress').select('*').eq('procurement_chain_id',chainId).maybeSingle():Promise.resolve({data:null,error:null}),
    auth.admin.from('rfq_order_items0').select('*').eq('rfq_id',rfqId).order('line_number'),
    header.data.source_bom_upload_id?auth.admin.from('customer_bom_uploads').select('*').eq('id',header.data.source_bom_upload_id).maybeSingle():chainId?auth.admin.from('customer_bom_uploads').select('*').eq('procurement_chain_id',chainId).order('created_at',{ascending:false}).limit(1).maybeSingle():Promise.resolve({data:null,error:null}),
    chainId?auth.admin.from('procurement_order_preferences').select('*').eq('procurement_chain_id',chainId).maybeSingle():Promise.resolve({data:null,error:null}),
    chainId?auth.admin.from('supplier_inbound_messages').select('id,procurement_chain_id,rfq_id,supplier_id,sender_email,subject,received_at,sender_authorization_status,detected_procurement_number,processing_status,processing_error,rfq_identification_method').or(`rfq_id.eq.${rfqId},procurement_chain_id.eq.${chainId}`).order('received_at',{ascending:false}):auth.admin.from('supplier_inbound_messages').select('*').eq('rfq_id',rfqId),
    chainId?auth.admin.from('supplier_responses').select('*').eq('procurement_chain_id',chainId):auth.admin.from('supplier_responses').select('*').eq('rfq_id',rfqId),
    auth.admin.from('procurement_supplier_allocations').select('*').eq('rfq_id',rfqId).eq('is_active',true),
    auth.admin.from('procurement_invoices').select('id,invoice_status,procurement_chain_id,procurement_number,created_at').eq('source_rfq_id',rfqId).order('created_at',{ascending:false}).limit(1),
    chainId?auth.admin.from('procurement_workflow_settings').select('*').eq('procurement_chain_id',chainId).maybeSingle():Promise.resolve({data:null,error:null}),
  ]);
  if(items.error||messages.error||responses.error)return fail('Related RFQ records could not be loaded.',500);
  const linkedMessages=(messages.data??[]).filter((row:any)=>!row.rfq_id||row.rfq_id===rfqId),linkedResponses=(responses.data??[]).filter((row:any)=>!row.rfq_id||row.rfq_id===rfqId);
  const bomItemIds=(items.data??[]).map((row:any)=>row.source_bom_item_id).filter(Boolean),messageIds=linkedMessages.map((row:any)=>row.id),responseIds=linkedResponses.map((row:any)=>row.id),supplierIds=[...new Set(linkedMessages.map((row:any)=>row.supplier_id).filter(Boolean))];
  const [bomItems,positions,runs,reviews,attachments,profiles]=await Promise.all([
    bomItemIds.length?auth.admin.from('customer_bom_upload_items').select('id,row_number,validation_errors,validation_warnings').in('id',bomItemIds):Promise.resolve({data:[],error:null}),
    responseIds.length?auth.admin.from('supplier_response_items').select('*').in('supplier_response_id',responseIds).order('source_row_number'):Promise.resolve({data:[],error:null}),
    messageIds.length?auth.admin.from('supplier_message_parse_runs').select('id,message_id,status,model_name,validation_error,extracted_payload,completed_at').in('message_id',messageIds).order('created_at',{ascending:false}):Promise.resolve({data:[],error:null}),
    messageIds.length?auth.admin.from('supplier_response_match_reviews').select('*').in('message_id',messageIds).order('created_at',{ascending:false}):Promise.resolve({data:[],error:null}),
    messageIds.length?auth.admin.from('supplier_message_attachments').select('id,message_id,sanitized_display_name,extraction_status,extraction_error').in('message_id',messageIds):Promise.resolve({data:[],error:null}),
    supplierIds.length?auth.admin.from('user_profiles').select('id,email,company_name,full_name').in('id',supplierIds):Promise.resolve({data:[],error:null}),
  ]);
  const bomMap=new Map((bomItems.data??[]).map((row:any)=>[row.id,row])),profileMap=new Map((profiles.data??[]).map((row:any)=>[row.id,row])),responseMap=new Map(linkedResponses.map((row:any)=>[row.id,row])),itemByBom=new Map((items.data??[]).filter((row:any)=>row.source_bom_item_id).map((row:any)=>[row.source_bom_item_id,row.rfq_item_id]));
  const rfqItems=(items.data??[]).map((row:any)=>{const source:any=bomMap.get(row.source_bom_item_id);return {...row,bom_row:source?.row_number??row.line_number,issues:[...(source?.validation_errors??[]),...(source?.validation_warnings??[])]}});
  const offers=(positions.data??[]).map((row:any)=>{
    const response:any=responseMap.get(row.supplier_response_id),profile:any=profileMap.get(response?.supplier_id);
    const linkedItem=row.rfq_item_id||itemByBom.get(row.bom_item_id)||null;
    const productState=row.review_status==='pending'||row.normalization_status==='needs_review'?'Product review required':linkedItem?'Matched':'Unmatched supplier line';
    const coverageState=row.quantity_coverage_status==='full'?'Full coverage':row.quantity_coverage_status==='partial'?'Partial coverage · Additional supplier required':'Quantity confirmation required';
    return {...row,rfq_item_id:linkedItem,supplier_name:profile?.company_name||profile?.full_name||'Supplier',source_message_id:row.source_message_id,quote_valid_until:response?.quote_valid_until??null,response_status_record:response?.status??null,total_line_value:row.calculated_unit_price!=null&&row.offered_quantity!=null&&row.price_basis_quantity?Number(row.calculated_unit_price)*Number(row.offered_quantity)/Number(row.price_basis_quantity):null,match_state:`${productState} · ${coverageState}`,commercial_review_state:row.commercial_review_required?`Commercial review required: ${(row.missing_commercial_fields??[]).join(', ')}`:'Commercial fields complete'};
  });
  const latestRunByMessage=new Map();for(const run of runs.data??[])if(!latestRunByMessage.has(run.message_id))latestRunByMessage.set(run.message_id,run);
  const supplierMessages=linkedMessages.map((row:any)=>{const profile:any=profileMap.get(row.supplier_id),run:any=latestRunByMessage.get(row.id),messageReviews=(reviews.data??[]).filter((review:any)=>review.message_id===row.id&&review.status==='pending'),files=(attachments.data??[]).filter((file:any)=>file.message_id===row.id);return {...row,supplier_name:profile?.company_name||profile?.full_name||'Supplier',authorization_state:row.sender_authorization_status==='authorized'?'Authorized':'Unauthorized',procurement_state:row.procurement_chain_id&&row.detected_procurement_number?`Matched to ${row.detected_procurement_number}`:'Review required',rfq_assignment_state:row.rfq_id?'Linked':row.processing_error==='awaiting_rfq_creation'?'Awaiting RFQ creation':'Assignment required',ai_state:row.processing_status==='needs_review'?'Review required':row.processing_status,ai_summary:safeText(run?.extracted_payload?.supplierGeneralMessage),warnings:[safeText(run?.validation_error),safeText(row.processing_error),...messageReviews.map((review:any)=>review.reason)].filter(Boolean),attachment_count:files.length,position_count:offers.filter((offer:any)=>offer.source_message_id===row.id).length}});
  const buyerAllocations=(allocations.data??[]).map((row:any)=>({...row,human_approved:true,buyer_approved:true,approved_by_role:row.selected_by===header.data.customer_id?'customer':'admin',included_in_invoice:Boolean(invoices.data?.[0])}));
  return NextResponse.json({rfq:header.data,chain:chain.data,progress:progress.data,bom:bom.data,preferences:preferences.data,items:rfqItems,messages:supplierMessages,offers,unmatchedOffers:offers.filter((offer:any)=>!offer.rfq_item_id),reviews:reviews.data??[],allocations:buyerAllocations,invoice:invoices.data?.[0]??null,workflow:workflow.data??{execution_mode:'manual',automatic_rfq_to_invoice:false}},{headers:{'cache-control':'private, no-store'}});
}

export async function DELETE(request:Request,{params}:{params:Promise<{rfqId:string}>}){
 const auth=await requireInternalApi();if('error'in auth)return fail(auth.error,auth.status);if(auth.role!=='admin')return fail('Only an Admin may delete an RFQ.',403);const {rfqId}=await params,body=await request.json().catch(()=>null);if(!body)return fail('Invalid JSON body.',400);
 const result=await auth.admin.rpc('delete_eligible_rfq_as_admin',{p_rfq_id:rfqId,p_admin_user_id:auth.user.id,p_confirmation:String(body.confirmation??''),p_reason:String(body.reason??'')});
 if(result.error){const status=result.error.code==='P0002'?404:result.error.code==='42501'?403:result.error.code==='23503'?409:result.error.code==='22023'?422:500;return fail(status===409?'This RFQ cannot be deleted because downstream commercial documents exist.':status===422?result.error.message:'The RFQ could not be deleted.',status)}
 const deleted=Array.isArray(result.data)?result.data[0]:result.data;revalidatePath('/admin');revalidatePath('/customer/dashboard');revalidatePath('/supplier/dashboard');if(deleted?.procurement_chain_id)revalidatePath(`/admin/procurement-progress/${deleted.procurement_chain_id}`);revalidatePath(`/admin/rfqs/${rfqId}`);return NextResponse.json({deleted:true,rfqId,procurementChainId:deleted?.procurement_chain_id??null,navigationUrl:'/admin'});
}
