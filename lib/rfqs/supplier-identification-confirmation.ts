export type SupplierIdentificationDecision={
  matchType:'exact'|'normalized_exact'|'non_exact'|'ambiguous'|'unmatched';
  supplierConfirmationRequired:boolean;
  approvalAllowed:boolean;
  reason:string;
};

export function normalizeApprovalPartNumber(value:unknown){
  return typeof value==='string'?value.trim().toUpperCase().replace(/[\s._\/-]+/g,''):'';
}

export function requiresSupplierIdentificationConfirmation(input:{
  requestedPartNumber?:unknown;
  offeredPartNumber?:unknown;
  rfqItemId?:unknown;
  offerRfqItemId?:unknown;
  matchState?:unknown;
}):SupplierIdentificationDecision{
  const requestedRaw=typeof input.requestedPartNumber==='string'?input.requestedPartNumber.trim():'';
  const offeredRaw=typeof input.offeredPartNumber==='string'?input.offeredPartNumber.trim():'';
  const requested=normalizeApprovalPartNumber(requestedRaw),offered=normalizeApprovalPartNumber(offeredRaw);
  const state=String(input.matchState??'').toLowerCase();
  if(input.rfqItemId&&input.offerRfqItemId&&input.rfqItemId!==input.offerRfqItemId)
    return{matchType:'ambiguous',supplierConfirmationRequired:true,approvalAllowed:false,reason:'The supplier offer is linked to another RFQ position.'};
  if(!requested||!offered)
    return{matchType:'unmatched',supplierConfirmationRequired:true,approvalAllowed:false,reason:'Supplier confirmation is required because a canonical Part Number is missing.'};
  if(requestedRaw===offeredRaw)
    return{matchType:'exact',supplierConfirmationRequired:false,approvalAllowed:true,reason:'Requested and offered Part Numbers are identical.'};
  if(requested===offered)
    return{matchType:'normalized_exact',supplierConfirmationRequired:false,approvalAllowed:true,reason:'Requested and offered Part Numbers are identical after safe normalization.'};
  if(state.includes('ambiguous')||state.includes('unmatched'))
    return{matchType:state.includes('ambiguous')?'ambiguous':'unmatched',supplierConfirmationRequired:true,approvalAllowed:false,reason:'The supplier position must be manually resolved before approval.'};
  return{matchType:'non_exact',supplierConfirmationRequired:true,approvalAllowed:false,reason:'Supplier confirmation is required because the offered Part Number does not exactly match the requested Part Number.'};
}
