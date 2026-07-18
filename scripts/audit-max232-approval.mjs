import fs from 'node:fs';
import {createClient} from '@supabase/supabase-js';

for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){
  const match=line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if(match&&!process.env[match[1]])process.env[match[1]]=match[2].replace(/^['"]|['"]$/g,'');
}
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error('Supabase read-only audit configuration is unavailable.');
const db=createClient(url,key,{auth:{persistSession:false}});
const normalize=value=>String(value??'').trim().toUpperCase().replace(/[\s._\/-]+/g,'');
const rfqResult=await db.from('rfq_orders0').select('rfq_id,procurement_chain_id,procurement_number').eq('procurement_number','PR-2026-000002').order('created_at',{ascending:false}).limit(1).maybeSingle();
if(rfqResult.error||!rfqResult.data)throw rfqResult.error??new Error('RFQ not found.');
const rfq=rfqResult.data;
const items=await db.from('rfq_order_items0').select('rfq_item_id,rfq_id,procurement_chain_id,line_number,part_number,description').eq('rfq_id',rfq.rfq_id);
if(items.error)throw items.error;
const item=items.data.find(row=>normalize(row.part_number)===normalize('MAX232CSE+'));
if(!item)throw new Error('MAX232CSE+ RFQ item not found.');
const offers=await db.from('supplier_response_items').select('id,supplier_response_id,rfq_id,rfq_item_id,procurement_chain_id,supplier_id,offered_mpn,normalized_offered_mpn,match_method,review_status,normalization_status,matching_confidence,is_current,calculated_unit_price,currency,price_basis_unit').eq('rfq_item_id',item.rfq_item_id).order('created_at',{ascending:false});
if(offers.error)throw offers.error;
const offer=offers.data.find(row=>normalize(row.offered_mpn)===normalize(item.part_number))??offers.data[0]??null;
const response=offer?await db.from('supplier_responses').select('id,rfq_id,procurement_chain_id,supplier_id,status,is_current').eq('id',offer.supplier_response_id).maybeSingle():{data:null,error:null};
const clarifications=offer?await db.from('supplier_part_clarifications').select('id,status,reply_decision,sent_at,candidate_rfq_item_id,created_at,updated_at').eq('supplier_response_item_id',offer.id).order('created_at',{ascending:false}):{data:[],error:null};
const allocations=offer?await db.from('procurement_supplier_allocations').select('id,rfq_id,rfq_item_id,supplier_response_item_id,is_active,allocated_quantity,selected_by,selected_at').eq('supplier_response_item_id',offer.id).order('created_at',{ascending:false}):{data:[],error:null};
if(response.error||clarifications.error||allocations.error)throw response.error??clarifications.error??allocations.error;
console.log(JSON.stringify({
  rfqId:rfq.rfq_id,procurementChainId:rfq.procurement_chain_id,rfqItemId:item.rfq_item_id,
  requestedPartNumber:item.part_number,normalizedRequestedPartNumber:normalize(item.part_number),
  supplierResponseId:response.data?.id??null,supplierResponseItemId:offer?.id??null,
  offeredPartNumber:offer?.offered_mpn??null,storedNormalizedOfferedPartNumber:offer?.normalized_offered_mpn??null,
  normalizedOfferedPartNumber:normalize(offer?.offered_mpn),matchMethod:offer?.match_method??null,
  matchStatus:offer?`${offer.review_status}/${offer.normalization_status}`:null,matchConfidence:offer?.matching_confidence??null,
  responseStatus:response.data?.status??null,clarifications:clarifications.data??[],allocations:allocations.data??[],
  exactNormalizedMatch:Boolean(offer&&normalize(item.part_number)&&normalize(item.part_number)===normalize(offer.offered_mpn)),
  currentBlockingCondition:'Any clarification in draft/pending/sent/confirmation-pending/ambiguous blocks before current MPN equality is evaluated.'
},null,2));
