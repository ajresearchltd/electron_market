import {evaluateRfqForInvoice} from '../procurement-workflow';

export async function approveSupplierOfferForRfqItem(database:any,input:{rfqId:string;rfqItemId:string;offerItemId:string;actorUserId:string;actorRole:'customer'|'admin';approvedQuantity?:number}){
 const existing=await database.from('procurement_supplier_allocations').select('id,supplier_response_item_id').eq('rfq_id',input.rfqId).eq('rfq_item_id',input.rfqItemId).eq('is_active',true);
 console.info('[human-offer-approval] request',{...input,existingApprovalIds:(existing.data??[]).map((row:any)=>row.id)});
 const saved=await database.rpc('approve_supplier_offer_for_rfq_item',{p_rfq_id:input.rfqId,p_rfq_item_id:input.rfqItemId,p_offer_item_id:input.offerItemId,p_actor_id:input.actorUserId,p_actor_role:input.actorRole,p_approved_quantity:input.approvedQuantity??null});
 if(saved.error){console.error('[human-offer-approval] persistence failed',{actorUserId:input.actorUserId,actorRole:input.actorRole,rfqId:input.rfqId,rfqItemId:input.rfqItemId,offerItemId:input.offerItemId,code:saved.error.code,message:saved.error.message});return {error:saved.error.message,status:saved.error.code==='42501'?403:saved.error.code==='P0002'?404:saved.error.code==='23505'?409:saved.error.code==='22023'?422:500} as const}
 const approval=Array.isArray(saved.data)?saved.data[0]:saved.data;if(!approval)return {error:'Approval could not be persisted.',status:500} as const;
 const readback=await database.from('procurement_supplier_allocations').select('*').eq('id',approval.allocation_id).eq('rfq_id',input.rfqId).eq('rfq_item_id',input.rfqItemId).eq('supplier_response_item_id',input.offerItemId).eq('is_active',true).maybeSingle();
 if(readback.error||!readback.data)return {error:'Approval database readback failed.',status:500} as const;
 const readiness=await evaluateRfqForInvoice(database,input.rfqId);if('error'in readiness)return readiness;
 const invoiceEligible=readiness.data.allocations.some((row:any)=>row.id===readback.data.id)&&!readiness.data.blockers.some((row:any)=>row.offerItemId===input.offerItemId);
 console.info('[human-offer-approval] persisted',{actorUserId:input.actorUserId,actorRole:input.actorRole,rfqId:input.rfqId,rfqItemId:input.rfqItemId,offerItemId:input.offerItemId,procurementChainId:readback.data.procurement_chain_id,resultingApprovalId:readback.data.id,approvedQuantity:readback.data.allocated_quantity,manualOverrideState:approval.match_method,invoiceEligible});
 return {data:{...readback.data,approvedByRole:input.actorRole,matchMethod:approval.match_method,invoiceEligible}} as const;
}
