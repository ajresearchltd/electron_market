export function validateOfferOwnership(rfq:any,rfqItem:any,offer:any,response:any,input:{rfqId:string;rfqItemId:string;offerItemId:string}){
 if(!rfq||rfq.rfq_id!==input.rfqId)return'RFQ was not found.';
 if(!rfqItem||rfqItem.rfq_item_id!==input.rfqItemId||rfqItem.rfq_id!==rfq.rfq_id||rfqItem.procurement_chain_id!==rfq.procurement_chain_id)return'RFQ position belongs to another procurement order.';
 if(!offer||offer.id!==input.offerItemId||offer.rfq_item_id!==rfqItem.rfq_item_id||offer.rfq_id!==rfq.rfq_id||offer.procurement_chain_id!==rfq.procurement_chain_id)return'Supplier offer belongs to another procurement order.';
 if(!response||response.id!==offer.supplier_response_id||response.procurement_chain_id!==rfq.procurement_chain_id||response.rfq_id!==rfq.rfq_id||response.supplier_id!==offer.supplier_id)return'Supplier offer belongs to another procurement order.';
 return null;
}
