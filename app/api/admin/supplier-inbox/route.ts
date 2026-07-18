import { NextResponse } from 'next/server';
import { requireInternalApi } from '../../../../lib/auth/require-internal-api';
import { recalculateCoverage, reprocessInboundMessage } from '../../../../lib/supplier-email/pipeline';

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
export async function GET() {
  const auth = await requireInternalApi(); if ('error' in auth) return fail(auth.error,auth.status);
  const rows = await auth.admin.from('supplier_inbound_messages').select('id,received_at,detected_procurement_number,procurement_chain_id,procurement_identification_method,rfq_id,rfq_identification_method,supplier_id,sender_authorization_status,subject,processing_status,processing_attempts,processing_error,created_at,supplier_message_attachments(id,sanitized_display_name),supplier_message_parse_runs(id,status),supplier_responses(id,status,response_revision,response_relationship,review_item_count),supplier_response_match_reviews(id,status,review_type,suggested_bom_item_id,suggested_rfq_item_id,candidate_rfq_item_ids,supplier_response_item_id,reason)').order('received_at',{ascending:false}).limit(100);
  if(rows.error)return fail('Supplier inbox could not be loaded.',500);
  const messages=(rows.data??[]).map((row:any)=>({...row,processing_error:row.processing_status==='failed'?'AI processing could not be completed. Open message details or reprocess the email.':row.processing_error}));
  return NextResponse.json({messages});
}
export async function PATCH(request: Request) {
  const auth=await requireInternalApi();if('error'in auth)return fail(auth.error,auth.status);const body=await request.json().catch(()=>({}));const messageId=String(body.messageId||'');const action=String(body.action||'');if(!messageId)return fail('Message ID is required.');
  try {
    if(action==='reprocess')return NextResponse.json(await reprocessInboundMessage(auth.admin,messageId));
    if(action==='assign'){const update:any={};if(body.procurementChainId)update.procurement_chain_id=body.procurementChainId;if(body.rfqId!==undefined)update.rfq_id=body.rfqId||null;if(body.supplierId!==undefined)update.supplier_id=body.supplierId||null;const result=await auth.admin.from('supplier_inbound_messages').update(update).eq('id',messageId);if(result.error)throw new Error(result.error.message);return NextResponse.json({ok:true});}
    if(action==='resolveReview'){
      const review=await auth.admin.from('supplier_response_match_reviews').select('*').eq('id',String(body.reviewId||'')).eq('message_id',messageId).single();if(review.error)return fail('Review record was not found.',404);
      const itemUpdate:any={review_status:'resolved',normalization_status:'validated'};const rfqItemId=body.rfqItemId||review.data.suggested_rfq_item_id;const bomItemId=body.bomItemId||review.data.suggested_bom_item_id;
      if(rfqItemId){const rfqItem=await auth.admin.from('rfq_order_items0').select('rfq_item_id,rfq_id,source_bom_item_id,procurement_chain_id').eq('rfq_item_id',rfqItemId).eq('procurement_chain_id',review.data.procurement_chain_id).single();if(rfqItem.error)return fail('RFQ item does not belong to this procurement chain.',409);itemUpdate.rfq_item_id=rfqItem.data.rfq_item_id;itemUpdate.rfq_id=rfqItem.data.rfq_id;itemUpdate.bom_item_id=rfqItem.data.source_bom_item_id;itemUpdate.match_method='admin_confirmed';itemUpdate.matching_confidence=1}
      if(bomItemId&&!rfqItemId){const bom=await auth.admin.from('customer_bom_upload_items').select('id,upload_id,procurement_chain_id').eq('id',bomItemId).eq('procurement_chain_id',review.data.procurement_chain_id).single();if(bom.error)return fail('BOM item does not belong to this procurement chain.',409);itemUpdate.bom_item_id=bom.data.id;itemUpdate.bom_upload_id=bom.data.upload_id;itemUpdate.match_method='admin_confirmed';itemUpdate.matching_confidence=1}
      for(const key of ['currency','price_basis_quantity','price_basis_unit','package_quantity','lead_time_value','lead_time_unit','lead_time_days','response_status'])if(body.corrections&&Object.prototype.hasOwnProperty.call(body.corrections,key))itemUpdate[key]=body.corrections[key];
      if(review.data.supplier_response_item_id){const updated=await auth.admin.from('supplier_response_items').update(itemUpdate).eq('id',review.data.supplier_response_item_id);if(updated.error)throw new Error(updated.error.message)}
      await auth.admin.from('supplier_response_match_reviews').update({status:'resolved',reviewed_by:auth.user.id,reviewed_at:new Date().toISOString(),resolution_note:String(body.note||'Resolved by internal review.')}).eq('id',review.data.id);return NextResponse.json({ok:true});
    }
    if(action==='validate'){
      const response=await auth.admin.from('supplier_responses').select('id,procurement_chain_id,supplier_id,response_relationship,supersedes_response_id,status').eq('source_message_id',messageId).single();if(response.error)return fail('Parsed response was not found.',404);
      const pending=await auth.admin.from('supplier_response_match_reviews').select('id',{count:'exact',head:true}).eq('supplier_response_id',response.data.id).eq('status','pending');if(pending.count)return fail('Resolve all pending reviews before validation.',409);
      if(response.data.supersedes_response_id){
        if(response.data.response_relationship==='amendment'){
          const [currentItems,previousItems]=await Promise.all([auth.admin.from('supplier_response_items').select('bom_item_id').eq('supplier_response_id',response.data.id),auth.admin.from('supplier_response_items').select('*').eq('supplier_response_id',response.data.supersedes_response_id).eq('is_current',true)]);const changed=new Set((currentItems.data??[]).map((item:any)=>item.bom_item_id).filter(Boolean));const inherited=(previousItems.data??[]).filter((item:any)=>!changed.has(item.bom_item_id)).map(({id,created_at,updated_at,...item}:any)=>({...item,supplier_response_id:response.data.id,source_message_id:messageId,is_current:true}));if(inherited.length){const copied=await auth.admin.from('supplier_response_items').insert(inherited);if(copied.error)throw new Error(copied.error.message)}
        }
        await auth.admin.from('supplier_responses').update({status:'superseded',is_current:false}).eq('id',response.data.supersedes_response_id);await auth.admin.from('supplier_response_items').update({is_current:false}).eq('supplier_response_id',response.data.supersedes_response_id);
      }
      await auth.admin.from('supplier_responses').update({status:'validated',needs_review:false,is_current:true}).eq('id',response.data.id);await auth.admin.from('supplier_inbound_messages').update({processing_status:'parsed'}).eq('id',messageId);
      const coverage=await recalculateCoverage(auth.admin,response.data.procurement_chain_id);const progress=await auth.admin.from('procurement_progress').select('id,current_stage').eq('procurement_chain_id',response.data.procurement_chain_id).maybeSingle();if(progress.data?.id){await auth.admin.from('procurement_progress_events').insert({progress_id:progress.data.id,actor_user_id:auth.user.id,actor_role:auth.role,stage_code:'supplier_response_validated',stage_label:'Supplier response validated',event_data:{supplier_response_id:response.data.id,coverage}});if(!['approved','payment','goods_shipped','goods_received','order_completed'].includes(progress.data.current_stage))await auth.admin.from('procurement_progress').update({current_stage:'quote_received',current_stage_label:'Quote Received',quote_received_at:new Date().toISOString()}).eq('id',progress.data.id);}
      return NextResponse.json({ok:true,coverage});
    }
    return fail('Unsupported action.');
  }catch(error){console.error('[supplier-inbox-action]',error);return fail(error instanceof Error?error.message:'Action failed.',500)}
}
