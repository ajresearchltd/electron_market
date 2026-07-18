import test from 'node:test';import assert from 'node:assert/strict';import {validateOfferOwnership} from '../lib/rfqs/offer-ownership.ts';
const rfq={rfq_id:'r',procurement_chain_id:'c'},item={rfq_item_id:'i',rfq_id:'r',procurement_chain_id:'c'},offer={id:'o',rfq_id:'r',rfq_item_id:'i',procurement_chain_id:'c',supplier_response_id:'s',supplier_id:'u'},response={id:'s',rfq_id:'r',procurement_chain_id:'c',supplier_id:'u'},input={rfqId:'r',rfqItemId:'i',offerItemId:'o'};
test('canonical current-RFQ offer ownership succeeds',()=>assert.equal(validateOfferOwnership(rfq,item,offer,response,input),null));
test('cross-RFQ offer is rejected',()=>assert.match(validateOfferOwnership(rfq,item,{...offer,rfq_id:'other'},response,input)!,/another procurement/));
test('wrong chain is rejected',()=>assert.match(validateOfferOwnership(rfq,item,{...offer,procurement_chain_id:'other'},response,input)!,/another procurement/));
test('wrong RFQ item and wrong offer IDs are rejected',()=>{assert.match(validateOfferOwnership(rfq,{...item,rfq_item_id:'other'},offer,response,input)!,/position/);assert.match(validateOfferOwnership(rfq,item,{...offer,id:'other'},response,input)!,/offer/)});
