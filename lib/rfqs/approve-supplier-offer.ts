import {evaluateRfqForInvoice} from '../procurement-workflow';
import {validateOfferOwnership} from './offer-ownership';
import {requiresSupplierIdentificationConfirmation} from './supplier-identification-confirmation';

export async function approveSupplierOfferForRfqItem(database:any,input:{rfqId:string;rfqItemId:string;offerItemId:string;actorUserId:string;actorRole:'customer'|'admin';approvedQuantity?:number}){
 const [rfq,item,offer]=await Promise.all([database.from('rfq_orders0').select('rfq_id,procurement_chain_id').eq('rfq_id',input.rfqId).maybeSingle(),database.from('rfq_order_items0').select('rfq_item_id,rfq_id,procurement_chain_id,part_number').eq('rfq_item_id',input.rfqItemId).maybeSingle(),database.from('supplier_response_items').select('id,rfq_id,rfq_item_id,procurement_chain_id,supplier_response_id,supplier_id,offered_mpn,match_method,review_status,normalization_status').eq('id',input.offerItemId).maybeSingle()]);
 const response=offer.data?.supplier_response_id?await database.from('supplier_responses').select('id,rfq_id,procurement_chain_id,supplier_id').eq('id',offer.data.supplier_response_id).maybeSingle():{data:null,error:null};
 if(rfq.error||item.error||offer.error||response.error)return {error:'Offer ownership could not be verified.',status:500} as const;
 const ownershipError=validateOfferOwnership(rfq.data,item.data,offer.data,response.data,input);if(ownershipError)return {error:ownershipError,status:422} as const;
 const decision=requiresSupplierIdentificationConfirmation({requestedPartNumber:item.data.part_number,offeredPartNumber:offer.data.offered_mpn,rfqItemId:item.data.rfq_item_id,offerRfqItemId:offer.data.rfq_item_id,matchState:offer.data.match_method});
 if(decision.supplierConfirmationRequired){
  const confirmed=await database.from('supplier_part_clarifications').select('status').eq('supplier_response_item_id',input.offerItemId).eq('candidate_rfq_item_id',input.rfqItemId).eq('status','supplier_confirmed').limit(1).maybeSingle();
  if(confirmed.error||!confirmed.data)return {error:decision.reason,status:409} as const;
 }
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
 return {data:{...readback.data,approvedByRole:input.actorRole,matchMethod:approval.match_method,invoiceEligible,identificationDecision:decision}} as const;
}
