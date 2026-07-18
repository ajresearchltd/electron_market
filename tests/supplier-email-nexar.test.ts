import test from 'node:test';
import assert from 'node:assert/strict';
import {matchSupplierItemWithEvidence} from '../lib/supplier-email/nexar-matching.ts';
import type {NexarSearchResult} from '../lib/market-data/nexar.ts';

const rfq=[
  {rfq_item_id:'ti',part_number:'TPS5430DDAR',manufacturer:'Texas Instruments',description:'Buck regulator'},
  {rfq_item_id:'st',part_number:'STM32F103C8T6',manufacturer:'STMicroelectronics',description:'32-bit microcontroller'},
];
const result=(part_number:string,manufacturer:string|null='Texas Instruments',description:string|null='Buck regulator'):NexarSearchResult=>({part_number,manufacturer,description,datasheet_url:null,octopart_url:null,source_url:null,offers:[],raw_response_json:{}});

test('exact and harmless normalized local matches do not call Nexar',async()=>{
  let calls=0;const lookup=async()=>{calls+=1;return result('TPS5430DDAR')};
  assert.equal((await matchSupplierItemWithEvidence({offeredMpn:'TPS5430DDAR'},rfq,lookup)).match.matchState,'matched_exact');
  assert.equal((await matchSupplierItemWithEvidence({offeredMpn:'TPS-5430 DDAR'},rfq,lookup)).match.matchState,'matched_normalized');
  assert.equal(calls,0);
});

test('Nexar canonical identity resolves an otherwise unresolved supplier MPN',async()=>{
  let calls=0;const value=await matchSupplierItemWithEvidence({offeredMpn:'TPS5430-DDAR-TI'},rfq,async()=>{calls+=1;return result('TPS5430DDAR')});
  assert.equal(calls,1);assert.equal(value.match.matchState,'matched_normalized');assert.equal(value.match.matchedRfqItemId,'ti');assert.equal(value.nexar.canonicalPartNumber,'TPS5430DDAR');
});

test('manufacturer aliases remain deterministic and bypass Nexar',async()=>{
  let calls=0;const value=await matchSupplierItemWithEvidence({offeredMpn:'STM32F103C8T6',offeredManufacturer:'ST'},rfq,async()=>{calls+=1;return result('STM32F103C8T6','STMicroelectronics')});
  assert.equal(value.match.matchedRfqItemId,'st');assert.equal(calls,0);
});

test('Nexar timeout, auth failure, and no result are non-fatal review outcomes',async()=>{
  for(const lookup of [async()=>{throw new Error('timeout')},async()=>{throw new Error('401')},async()=>result('',null,null)]){
    const value=await matchSupplierItemWithEvidence({offeredMpn:'UNKNOWN-123'},rfq,lookup);
    assert.equal(value.nexar.attempted,true);assert.equal(value.match,null);
  }
});

test('missing MPN skips Nexar and uses semantic matching safely',async()=>{
  let calls=0;const value=await matchSupplierItemWithEvidence({offeredMpn:null,originalProductName:'unidentified component'},rfq,async()=>{calls+=1;return result('TPS5430DDAR')});
  assert.equal(calls,0);assert.equal(value.nexar.attempted,false);assert.equal(value.match,null);
});

test('multiple canonical candidates are never forced and repeated processing is stable',async()=>{
  const choices=[{rfq_item_id:'a',part_number:'ABC-123'},{rfq_item_id:'b',part_number:'ABC123'}];
  const lookup=async()=>result('ABC123',null,null);
  const first=await matchSupplierItemWithEvidence({offeredMpn:'vendor-abc'},choices,lookup),second=await matchSupplierItemWithEvidence({offeredMpn:'vendor-abc'},choices,lookup);
  assert.equal(first.match,null);assert.equal(second.match,null);assert.deepEqual(first.nexar.warnings,second.nexar.warnings);
});
