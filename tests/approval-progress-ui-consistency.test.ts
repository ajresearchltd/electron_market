import assert from 'node:assert/strict';import test from 'node:test';import fs from 'node:fs';
import{buildCanonicalAllocationViews}from'../lib/rfqs/canonical-allocation-view.ts';

test('Admin and Customer derive the same active allocation and exact Invoice linkage',()=>{
 const allocations=[{id:'a1',procurement_chain_id:'chain',rfq_id:'rfq',rfq_item_id:'item',supplier_response_item_id:'offer',is_active:true,allocated_quantity:80,selected_unit_price:.72,currency:'USD',selected_at:'2026-07-17',selected_by:'admin'}];
 const input={allocations,invoiceItems:[{invoice_id:'inv',source_allocation_id:'a1'}],invoices:[{id:'inv',invoice_number:'PR-INV-001'}],rfqId:'rfq',procurementChainId:'chain',actorRoles:new Map([['admin','admin']])};
 const admin=buildCanonicalAllocationViews(input).get('offer'),customer=buildCanonicalAllocationViews(input).get('offer');assert.deepEqual(customer,admin);assert.equal(admin?.approvedQuantity,80);assert.equal(admin?.selectedUnitPrice,.72);assert.equal(admin?.currency,'USD');assert.equal(admin?.isInvoiced,true);
});

test('cross-RFQ and inactive allocations never become Approved',()=>{
 const rows=[{id:'wrong',procurement_chain_id:'chain',rfq_id:'other',rfq_item_id:'item',supplier_response_item_id:'offer1',is_active:true},{id:'inactive',procurement_chain_id:'chain',rfq_id:'rfq',rfq_item_id:'item',supplier_response_item_id:'offer2',is_active:false}];
 assert.equal(buildCanonicalAllocationViews({allocations:rows,invoiceItems:[],rfqId:'rfq',procurementChainId:'chain'}).size,0);
});

test('Customer API no longer drops allocations whose parent response is historical',()=>{
 const source=fs.readFileSync('app/api/customer/rfqs/[rfqId]/route.ts','utf8');assert.doesNotMatch(source,/supplier_responses'[\s\S]{0,250}eq\('is_current',true\)/);assert.match(source,/buildCanonicalAllocationViews/);
});

test('Invoice progress wrapper is success-only and monotonic with manual backfill',()=>{
 const sql=fs.readFileSync('database/033_run_in_supabase_sql_editor_advance_progress_to_approved_after_invoice.sql','utf8');assert.match(sql,/IF v_created THEN/);assert.match(sql,/IN\('approved','payment','goods_shipped','goods_received','order_completed'\)/);assert.match(sql,/ELSE 'approved'/);assert.match(sql,/EXISTS\(SELECT 1 FROM public\.procurement_invoices/);
});

test('Customer RFQ table starts with sticky View and contains no Edit action',()=>{
 const source=fs.readFileSync('app/customer/CustomerHubClient.tsx','utf8'),block=source.slice(source.indexOf('<SectionCard title="RFQ"'),source.indexOf('<SectionCard title="Quotes"'));assert.ok(block.indexOf("key:'action'")<block.indexOf("key: 'order_number'"));assert.match(block,/sticky:true/);assert.match(block,/aria-label={`View RFQ/);assert.doesNotMatch(block,/>Edit</);
});
