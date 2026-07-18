import test from 'node:test';
import assert from 'node:assert/strict';
import {semanticMatchSchema,validateSemanticMatch} from '../lib/supplier-email/semantic-schema.ts';

const rfq=[{rfq_item_id:'mosfet',part_number:'IRF540N',manufacturer:'Infineon',description:'N-channel power MOSFET 100 V TO-220'}];
test('semantic schema is strict and requires every property',()=>{
  assert.equal(semanticMatchSchema.additionalProperties,false);
  assert.deepEqual([...semanticMatchSchema.required].sort(),Object.keys(semanticMatchSchema.properties).sort());
});
test('semantic response accepts valid no-match and current-RFQ match results',()=>{
  const unmatched=validateSemanticMatch({matchState:'unmatched',matchedRfqItemId:null,candidateRfqItemIds:[],confidence:0,reasons:[],warnings:['No suitable match.']},rfq);
  assert.equal(unmatched?.matchState,'unmatched');assert.equal(unmatched?.match,null);
  const matched=validateSemanticMatch({matchState:'matched_semantic',matchedRfqItemId:'mosfet',candidateRfqItemIds:['mosfet'],confidence:.94,reasons:['Technical identity agrees.'],warnings:[]},rfq);
  assert.equal(matched?.matchedRfqItemId,'mosfet');assert.equal(matched?.method,'openai_semantic');
});
test('semantic response rejects IDs outside the current RFQ',()=>{
  assert.equal(validateSemanticMatch({matchState:'matched_semantic',matchedRfqItemId:'another-rfq',candidateRfqItemIds:[],confidence:.9,reasons:[],warnings:[]},rfq),null);
});
