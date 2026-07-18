export type CanonicalAllocationView={allocationId:string;offerItemId:string;rfqItemId:string;isApproved:boolean;isActive:boolean;approvedQuantity:number;selectedUnitPrice:number;currency:string;approvedAt:string|null;approvedByRole:string;isInvoiced:boolean;invoiceId:string|null;invoiceNumber:string|null};

export function buildCanonicalAllocationViews(input:{allocations:any[];invoiceItems:any[];invoices?:any[];rfqId:string;procurementChainId:string;customerId?:string|null;actorRoles?:Map<string,string>}){
 const invoiceMap=new Map((input.invoices??[]).map(row=>[row.id,row]));
 const invoiceByAllocation=new Map((input.invoiceItems??[]).filter(row=>row.source_allocation_id).map(row=>[row.source_allocation_id,row]));
 const byOffer=new Map<string,CanonicalAllocationView>();
 for(const row of input.allocations??[]){
  if(!row.is_active||row.rfq_id!==input.rfqId||row.procurement_chain_id!==input.procurementChainId||!row.rfq_item_id||!row.supplier_response_item_id)continue;
  const linked:any=invoiceByAllocation.get(row.id),invoice:any=linked?invoiceMap.get(linked.invoice_id):null;
  const role=input.actorRoles?.get(row.selected_by)||(row.selected_by===input.customerId?'customer':'admin');
  byOffer.set(row.supplier_response_item_id,{allocationId:row.id,offerItemId:row.supplier_response_item_id,rfqItemId:row.rfq_item_id,isApproved:true,isActive:true,approvedQuantity:Number(row.allocated_quantity),selectedUnitPrice:Number(row.selected_unit_price),currency:row.currency,approvedAt:row.selected_at??null,approvedByRole:role,isInvoiced:Boolean(linked),invoiceId:linked?.invoice_id??null,invoiceNumber:invoice?.invoice_number??null});
 }
 return byOffer;
}
