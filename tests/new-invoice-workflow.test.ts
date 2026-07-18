import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {nextInvoiceIdentity,selectNextSupplierCurrencyGroup} from '../lib/invoices/invoice-sequencing.ts';

test('second and third Invoice preserve procurement number and increment only Invoice sequence',()=>{
 assert.deepEqual(nextInvoiceIdentity('PR-2026-000002',[1]),{previousMax:1,nextSequence:2,nextInvoiceNumber:'PR-2026-000002-INV-002'});
 assert.deepEqual(nextInvoiceIdentity('PR-2026-000002',[1,2]),{previousMax:2,nextSequence:3,nextInvoiceNumber:'PR-2026-000002-INV-003'});
});

test('supplier and currency groups are never mixed and next group is deterministic',()=>{
 const result=selectNextSupplierCurrencyGroup([
  {supplier_id:'b',currency:'EUR',created_at:'2026-01-02'},
  {supplier_id:'a',currency:'USD',created_at:'2026-01-01'},
  {supplier_id:'a',currency:'usd',created_at:'2026-01-03'},
 ]);
 assert.equal(result.group.length,2);assert.ok(result.group.every(row=>row.supplier_id==='a'&&row.currency.toUpperCase()==='USD'));assert.equal(result.remainingGroups,1);
});

test('canonical RPC protects sequence, allocation uniqueness, idempotency and prior payment state',()=>{
 const sql=fs.readFileSync('database/026_run_in_supabase_sql_editor_fix_invoice_from_admin_or_customer_approval.sql','utf8');
 assert.match(sql,/FOR UPDATE/);assert.match(sql,/max\(pi\.invoice_sequence\)/);assert.match(sql,/procurement_invoices_chain_sequence_unique/);assert.match(sql,/procurement_invoices_number_unique/);
 assert.match(sql,/procurement_invoices_idempotency_unique/);assert.match(sql,/source_allocation_id\)/);assert.match(sql,/NOT EXISTS[\s\S]*source_allocation_id = psa\.id/);
 assert.match(sql,/invoice_status[\s\S]*'draft'/);assert.doesNotMatch(sql,/UPDATE public\.procurement_invoices[\s\S]*paid_boolean/);
});

test('new Invoice endpoint uses caller request key and reloads the persisted header',()=>{
 const route=fs.readFileSync('app/api/admin/rfqs/[rfqId]/create-invoice/route.ts','utf8');
 assert.match(route,/p_idempotency_key: idempotencyKey/);assert.match(route,/invoice_number,invoice_sequence/);assert.match(route,/Only an Admin may create an Invoice/);
});
