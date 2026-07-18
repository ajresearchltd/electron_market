import fs from 'node:fs';
import OpenAI from 'openai';
import {supplierEmailResponseSchema,validateStructuredSupplierEmail} from '../lib/supplier-email/schema.ts';
import {semanticMatchSchema,validateSemanticMatch} from '../lib/supplier-email/semantic-schema.ts';
import {searchNexarByPartNumber} from '../lib/market-data/nexar.ts';

for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const match=line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);if(match&&!process.env[match[1]])process.env[match[1]]=match[2].replace(/^['"]|['"]$/g,'')}
if(!process.env.OPENAI_API_KEY)throw new Error('OPENAI_API_KEY is not configured.');
const model=process.env.OPENAI_SUPPLIER_EMAIL_MODEL||'gpt-5.5';const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
const text=(response)=>response.output_text||(response.output||[]).flatMap(entry=>(entry.content||[]).filter(part=>part.type==='output_text').map(part=>part.text)).join('');
const fixture=`From: supplier@example.com\nSubject: Quotation for PR-2026-000002\nCurrency USD. Quote valid 30 days.\n1 TPS5430DDAR Texas Instruments, 100 pcs, USD 1.25 each\n2 STM32F103C8T6 STMicroelectronics, 50 pcs, USD 3.10 each\n3 ESP32-WROOM-32E Espressif, 25 pcs, USD 4.20 each\n4 N-channel power MOSFET, 100 V, 33 A, TO-220, 40 pcs, USD 0.80 each`;
const extraction=await client.responses.create({model,instructions:'Extract every supplier product position and only information explicitly present. Missing values are null and arrays remain present. Never match RFQ IDs.',input:fixture,text:{format:{type:'json_schema',name:'supplier_product_response',strict:true,schema:supplierEmailResponseSchema}}});
const checked=validateStructuredSupplierEmail(JSON.parse(text(extraction)));if(!checked.value)throw new Error(`Live extraction validation failed: ${checked.errors.join('; ')}`);
const semanticCandidates=[{rfq_item_id:'mosfet-position',part_number:'IRF540N',manufacturer:'Infineon',description:'N-channel power MOSFET 100 V 33 A TO-220'}];
const semantic=await client.responses.create({model,instructions:'Match only against the supplied current-RFQ positions. Never invent equivalence. Return a valid controlled no-match/review result when uncertain.',input:JSON.stringify({supplierPosition:checked.value.items[3],currentRfqPositions:[{rfqItemId:'mosfet-position',requestedPartNumber:'IRF540N',manufacturer:'Infineon',description:'N-channel power MOSFET 100 V 33 A TO-220'}]}),text:{format:{type:'json_schema',name:'supplier_rfq_semantic_match',strict:true,schema:semanticMatchSchema}}});
const semanticChecked=validateSemanticMatch(JSON.parse(text(semantic)),semanticCandidates);if(!semanticChecked)throw new Error('Live semantic response failed validation.');
let nexar={attempted:false,verified:false};if(process.env.NEXAR_CLIENT_ID&&process.env.NEXAR_CLIENT_SECRET){nexar.attempted=true;const found=await searchNexarByPartNumber('TPS5430DDAR');nexar.verified=Boolean(found.part_number&&found.manufacturer)}
console.log(JSON.stringify({model,extraction:{items:checked.value.items.length,partNumbers:checked.value.items.map(item=>item.offeredMpn||item.requestedMpn||null)},semantic:{state:semanticChecked.matchState,matchedRfqItemId:semanticChecked.matchedRfqItemId,confidence:semanticChecked.confidence},nexar},null,2));
