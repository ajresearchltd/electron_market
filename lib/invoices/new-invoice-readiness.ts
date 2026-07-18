type Database = any;
import {nextInvoiceIdentity,selectNextSupplierCurrencyGroup} from './invoice-sequencing';
import {requiresSupplierIdentificationConfirmation} from '../rfqs/supplier-identification-confirmation';

const pendingClarificationStates = [
  'clarification_draft','clarification_pending_send','clarification_sent',
  'supplier_confirmation_pending','supplier_reply_ambiguous',
];

const n = (value: unknown) => Number(value ?? 0);

export async function evaluateNewInvoiceReadiness(database: Database, rfqId: string) {
  const [rfqResult, itemResult, allocationResult, invoiceResult] = await Promise.all([
    database.from('rfq_orders0').select('rfq_id,procurement_chain_id,procurement_number,customer_id,customer_company_name').eq('rfq_id',rfqId).maybeSingle(),
    database.from('rfq_order_items0').select('rfq_item_id,rfq_id,procurement_chain_id,line_number,part_number,description,requested_quantity,quantity_unit').eq('rfq_id',rfqId).order('line_number'),
    database.from('procurement_supplier_allocations').select('*').eq('rfq_id',rfqId).eq('is_active',true).order('created_at'),
    database.from('procurement_invoices').select('id,invoice_number,invoice_sequence,supplier_user_id,currency,total_amount,generated_at,invoice_status').eq('source_rfq_id',rfqId).order('invoice_sequence',{ascending:false}),
  ]);
  if (rfqResult.error || !rfqResult.data) return {error:'RFQ not found.',status:404 as const};
  if (itemResult.error || allocationResult.error || invoiceResult.error) return {error:'New Invoice readiness could not be evaluated.',status:500 as const};
  const rfq=rfqResult.data, allocations=allocationResult.data??[], items=itemResult.data??[], invoices=invoiceResult.data??[];
  if (!rfq.procurement_chain_id) return {error:'RFQ procurement chain not found.',status:422 as const};
  const allocationIds=allocations.map((row:any)=>row.id), offerIds=allocations.map((row:any)=>row.supplier_response_item_id), approverIds=allocations.map((row:any)=>row.selected_by).filter(Boolean);
  const [invoiced,offers,approvers,clarifications,suppliers]=await Promise.all([
    allocationIds.length?database.from('procurement_invoice_items').select('source_allocation_id').in('source_allocation_id',allocationIds):Promise.resolve({data:[],error:null}),
    offerIds.length?database.from('supplier_response_items').select('id,rfq_id,rfq_item_id,procurement_chain_id,supplier_id,supplier_response_id,offered_mpn,offered_manufacturer,calculated_unit_price,currency,price_basis_quantity,price_basis_unit,available_quantity,offered_quantity,lead_time_days,condition,supplier_responses!inner(id,rfq_id,procurement_chain_id,supplier_id,quote_valid_until)').in('id',offerIds):Promise.resolve({data:[],error:null}),
    approverIds.length?database.from('user_profiles').select('id,role').in('id',approverIds):Promise.resolve({data:[],error:null}),
    offerIds.length?database.from('supplier_part_clarifications').select('supplier_response_item_id,status').in('supplier_response_item_id',offerIds).in('status',pendingClarificationStates):Promise.resolve({data:[],error:null}),
    Promise.resolve({data:[],error:null}),
  ]);
  if(invoiced.error||offers.error||approvers.error)return {error:'Canonical Invoice allocation data could not be evaluated.',status:500 as const};
  const invoicedIds=new Set((invoiced.data??[]).map((row:any)=>row.source_allocation_id)), offerMap=new Map((offers.data??[]).map((row:any)=>[row.id,row])), itemMap=new Map(items.map((row:any)=>[row.rfq_item_id,row])), roleMap=new Map((approvers.data??[]).map((row:any)=>[row.id,row.role]));
  const pendingByOffer=new Set(clarifications.error?[]:(clarifications.data??[]).map((row:any)=>row.supplier_response_item_id));
  const valid:any[]=[], ineligible:any[]=[];
  for(const allocation of allocations){
    const offer:any=offerMap.get(allocation.supplier_response_item_id),item:any=itemMap.get(allocation.rfq_item_id),response=offer?.supplier_responses;
    const role=roleMap.get(allocation.selected_by), approved=role==='admin'||(role==='customer'&&allocation.selected_by===rfq.customer_id);
    const canonical=Boolean(item&&offer&&item.rfq_id===rfq.rfq_id&&item.procurement_chain_id===rfq.procurement_chain_id&&offer.rfq_id===rfq.rfq_id&&offer.rfq_item_id===item.rfq_item_id&&offer.procurement_chain_id===rfq.procurement_chain_id&&offer.supplier_id===allocation.supplier_id&&response?.supplier_id===allocation.supplier_id&&response?.procurement_chain_id===rfq.procurement_chain_id&&(!response?.rfq_id||response.rfq_id===rfq.rfq_id));
    const commercial=allocation.allocated_quantity>0&&allocation.selected_unit_price>=0&&allocation.price_basis_quantity>0&&String(allocation.currency??'').trim()&&String(allocation.price_basis_unit??'').trim();
    if(invoicedIds.has(allocation.id)){ineligible.push({...allocation,reason:'already_invoiced'});continue}
    const identification=requiresSupplierIdentificationConfirmation({requestedPartNumber:item?.part_number,offeredPartNumber:offer?.offered_mpn,rfqItemId:item?.rfq_item_id,offerRfqItemId:offer?.rfq_item_id});
    const confirmationPending=pendingByOffer.has(allocation.supplier_response_item_id)&&identification.supplierConfirmationRequired;
    if(!approved||!canonical||!commercial||confirmationPending){ineligible.push({...allocation,reason:confirmationPending?'supplier_confirmation_pending':'canonical_validation_failed'});continue}
    valid.push({...allocation,item,offer,lineTotal:Math.round(n(allocation.allocated_quantity)*n(allocation.selected_unit_price)*100)/100});
  }
  const grouping=selectNextSupplierCurrencyGroup(valid),nextGroup=grouping.group;
  const supplierIds=[...new Set([...allocations.map((row:any)=>row.supplier_id),...invoices.map((row:any)=>row.supplier_user_id)].filter(Boolean))];
  const supplierResult=supplierIds.length?await database.from('user_profiles').select('id,company_name,full_name,email').in('id',supplierIds):suppliers;
  const supplierMap=new Map((supplierResult.data??[]).map((row:any)=>[row.id,row.company_name||row.full_name||row.email||'Supplier']));
  const {previousMax,nextSequence,nextInvoiceNumber}=nextInvoiceIdentity(rfq.procurement_number,invoices.map((row:any)=>row.invoice_sequence));
  const positions=nextGroup.map(row=>({allocationId:row.id,rfqItemId:row.rfq_item_id,rfqPosition:row.item.line_number,requestedPartNumber:row.item.part_number,offeredPartNumber:row.offer.offered_mpn,description:row.item.description,approvedQuantity:n(row.allocated_quantity),unitPrice:n(row.selected_unit_price),priceBasisQuantity:n(row.price_basis_quantity),priceBasisUnit:row.price_basis_unit,lineTotal:row.lineTotal,currency:String(row.currency).toUpperCase(),supplierId:row.supplier_id,supplier:supplierMap.get(row.supplier_id)||'Supplier',leadTimeDays:row.offer.lead_time_days,condition:row.offer.condition}));
  const subtotal=positions.reduce((sum,row)=>sum+row.lineTotal,0), pendingCount=ineligible.filter(row=>row.reason==='supplier_confirmation_pending').length;
  return {data:{ready:positions.length>0,rfq:{id:rfq.rfq_id,procurementChainId:rfq.procurement_chain_id,procurementNumber:rfq.procurement_number,customer:rfq.customer_company_name},expected:{previousMaxSequence:previousMax,nextSequence,nextInvoiceNumber},group:positions.length?{supplierId:positions[0].supplierId,supplier:positions[0].supplier,currency:positions[0].currency,remainingGroups:grouping.remainingGroups}:null,counts:{eligiblePositions:positions.length,alreadyInvoiced:invoicedIds.size,approvedIneligible:ineligible.filter(row=>row.reason!=='already_invoiced').length,awaitingSupplierConfirmation:pendingCount,stillRequireApproval:Math.max(0,items.length-allocations.length)},subtotal,total:subtotal,generationTimestamp:new Date().toISOString(),positions,invoices:invoices.map((row:any)=>({...row,supplier:supplierMap.get(row.supplier_user_id)||'Supplier'})),message:positions.length?'Only approved positions that have not been included in a previous Invoice will be added. Existing Invoice items will not be duplicated.':'No newly approved positions are available for a new Invoice.'}};
}
