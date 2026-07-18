import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeApprovalPartNumber,requiresSupplierIdentificationConfirmation} from '../lib/rfqs/supplier-identification-confirmation.ts';

test('MAX232CSE+ exact match overrides stale semantic provenance',()=>{
  const result=requiresSupplierIdentificationConfirmation({requestedPartNumber:'MAX232CSE+',offeredPartNumber:'MAX232CSE+',rfqItemId:'item',offerRfqItemId:'item',matchState:'openai_semantic'});
  assert.equal(result.matchType,'exact');assert.equal(result.supplierConfirmationRequired,false);assert.equal(result.approvalAllowed,true);
});

test('case and safe separator formatting produce normalized exact',()=>{
  assert.equal(normalizeApprovalPartNumber(' max-232_cse+ '),normalizeApprovalPartNumber('MAX232CSE+'));
  const result=requiresSupplierIdentificationConfirmation({requestedPartNumber:'MAX232CSE+',offeredPartNumber:' max232cse+ '});
  assert.equal(result.matchType,'normalized_exact');assert.equal(result.supplierConfirmationRequired,false);
});

test('missing and different offered Part Numbers remain protected',()=>{
  for(const offeredPartNumber of [null,'ATMEGA328P-PU']){
    const result=requiresSupplierIdentificationConfirmation({requestedPartNumber:'ATMEGA328P-AU',offeredPartNumber});
    assert.equal(result.supplierConfirmationRequired,true);assert.equal(result.approvalAllowed,false);
  }
});

test('cross-RFQ position remains blocked',()=>{
  const result=requiresSupplierIdentificationConfirmation({requestedPartNumber:'MAX232CSE+',offeredPartNumber:'MAX232CSE+',rfqItemId:'current',offerRfqItemId:'other'});
  assert.equal(result.matchType,'ambiguous');assert.equal(result.approvalAllowed,false);
});

test('Admin offer card uses inline Select Offer then Confirm controls',()=>{
  const page=fs.readFileSync('app/admin/rfqs/[rfqId]/page.tsx','utf8');
  assert.match(page,/setPendingOffer\(\{offer,item\}\)/);assert.match(page,/>Select Offer</);assert.match(page,/>Confirm</);assert.match(page,/Request Supplier Clarification/);assert.match(page,/allocationByOffer/);
});

test('database guard permits normalized equality and requires confirmed non-exact clarification',()=>{
  const sql=fs.readFileSync('database/035_run_in_supabase_sql_editor_prioritize_exact_mpn_offer_approval.sql','utf8');
  assert.match(sql,/v_requested_mpn<>v_offered_mpn/);assert.match(sql,/spc\.status='supplier_confirmed'/);assert.match(sql,/source_allocation_id=psa\.id/);
});
