import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(path, 'utf8');
const supplierPages = [
  'app/supplier/dashboard/page.tsx',
  'app/supplier/products/page.tsx',
  'app/supplier/products/new/page.tsx',
  'app/supplier/products/upload/page.tsx',
  'app/supplier/product-availability/[uploadId]/page.tsx',
  'app/supplier/product-availability/[uploadId]/items/[itemId]/page.tsx',
];

test('existing resolver follows auth user to profile/source profile to canonical supplier', () => {
  const source = read('lib/suppliers/canonical.ts');
  assert.match(source, /supplier_company_profiles/);
  assert.match(source, /eq\('user_id', inputId\)/);
  assert.match(source, /eq\('source_profile_id', profile\.profile_id\)/);
  assert.match(source, /canonicalSupplierId:supplier\.supplier_id/);
  assert.doesNotMatch(source, /contact_email|company_name|\.eq\('email'/);
});

test('Supplier HUB product and availability pages reuse canonical resolution with no email/name fallback', () => {
  for (const path of supplierPages) {
    const source = read(path);
    assert.match(source, /getCanonicalSupplierForAuthenticatedUser/);
    assert.doesNotMatch(source, /\.eq\('contact_email'/);
    assert.doesNotMatch(source, /\.eq\('email'/);
    assert.doesNotMatch(source, /\.eq\('company_name'/);
    assert.doesNotMatch(source, /\.from\('suppliers'\)[\s\S]{0,120}\.insert\(/);
  }
});

test('new products and stock uploads use canonical supplier ownership', () => {
  const product = read('app/supplier/products/new/page.tsx');
  const stock = read('app/api/supplier-stock-upload/upload/route.ts');
  assert.match(product, /supplier_id: supplierId/);
  assert.match(stock, /getCanonicalSupplierForAuthenticatedUser/);
  assert.match(stock, /const supplierId = canonical\.canonicalSupplierId/);
  assert.match(stock, /supplier_id: supplierId/);
  assert.match(stock, /uploaded_by_user_id: authData\.user\.id/);
});

test('contacts, documents and authorized emails receive canonical IDs while retaining legacy ownership', () => {
  const profileRoute = read('app/api/supplier/profile/route.ts');
  const documentRoute = read('app/api/supplier/profile/document/route.ts');
  const emails = read('app/api/admin/suppliers/[supplierId]/emails/route.ts');
  assert.match(profileRoute, /canonical_supplier_id:ctx\.identity\.canonicalSupplierId/);
  assert.match(profileRoute, /profile_id:ctx\.identity\.sourceProfileId/);
  assert.match(profileRoute, /user_id:ctx\.user\.id/);
  assert.match(documentRoute, /canonical_supplier_id:identity\.canonicalSupplierId/);
  assert.match(emails, /canonical_supplier_id:identity\.canonicalSupplierId/);
  assert.match(emails, /source_profile_id:identity\.sourceProfileId/);
});

test('Verified Supplier creation requires one existing active canonical supplier and never creates one', () => {
  const route = read('app/api/admin/verified-suppliers/route.ts');
  const page = read('app/admin/verified-suppliers/page.tsx');
  assert.match(route, /canonical_supplier_required/);
  assert.match(route, /canonical_supplier_invalid/);
  assert.match(route, /canonical_supplier_inactive/);
  assert.match(route, /canonical_supplier_already_verified/);
  assert.doesNotMatch(route, /from\('suppliers'\)\.insert/);
  assert.match(page, /Canonical supplier/);
  assert.match(route, /Manual canonical review required/);
  assert.match(route, /no Supplier HUB account\/profile is linked/);
  assert.match(page, /canonical_diagnostic/);
});

test('homepage and directory exclude canonical-null snapshots without redesigning their cards', () => {
  const route = read('app/api/public/suppliers/route.ts');
  assert.match(route, /not\('canonical_supplier_id','is',null\)/);
  assert.match(route, /eq\('show_on_homepage',true\)[\s\S]{0,300}\.limit\(4\)/);
  assert.match(route, /eq\('show_public_website',true\)/);
});

test('migration 043 deterministically backfills ownership and preserves Samsung/KINIK uncertainty', () => {
  const sql = read('database/043_run_in_supabase_sql_editor_repair_canonical_supplier_identity_and_rls.sql');
  assert.match(sql, /c\.profile_id = s\.source_profile_id/);
  assert.match(sql, /d\.profile_id = s\.source_profile_id/);
  assert.match(sql, /e\.source_profile_id = s\.source_profile_id/);
  const statements = sql.replace(/^--.*$/gm, '');
  assert.doesNotMatch(statements, /AJ Research|KINIK|Samsung|company_name/);
  assert.doesNotMatch(statements, /WHERE[^;]*(?:contact_)?email\s*=/i);
  assert.match(sql, /NOT VALID/);
  assert.doesNotMatch(sql, /DELETE FROM public\.(?:suppliers|verified_supplier)/i);
});

test('public product RLS is restricted while supplier and internal ownership access remain', () => {
  const sql = read('database/043_run_in_supabase_sql_editor_repair_canonical_supplier_identity_and_rls.sql');
  assert.match(sql, /DROP POLICY IF EXISTS "Anyone can select products"/);
  assert.match(sql, /is_public = true AND is_active = true AND review_status = 'approved'/);
  assert.match(sql, /Suppliers can select own canonical products/);
  assert.match(sql, /p\.user_id = auth\.uid\(\)/);
  assert.match(sql, /Internal users manage supplier products/);
});

test('legacy Verified Supplier writes are removed for ordinary authenticated users', () => {
  const sql = read('database/043_run_in_supabase_sql_editor_repair_canonical_supplier_identity_and_rls.sql');
  assert.match(sql, /DROP POLICY IF EXISTS "Authenticated users can insert verified_supplier"/);
  assert.match(sql, /DROP POLICY IF EXISTS "Authenticated users can update verified_supplier"/);
  assert.match(sql, /DROP POLICY IF EXISTS "Authenticated users can delete verified_supplier"/);
  assert.match(sql, /role = 'admin'/);
});

test('procurement assignment auth-user ownership and customer aliases remain unchanged', () => {
  const assignment = read('database/007_create_rfq_supplier_assignments.sql');
  const customerApi = read('app/api/customer/rfqs/[rfqId]/route.ts');
  const snapshot = read('lib/ai/procurement-order-snapshot.ts');
  assert.match(assignment, /supplier_id uuid NOT NULL REFERENCES auth\.users\(id\)/);
  assert.match(customerApi, /supplierAlias/);
  assert.doesNotMatch(customerApi, /contact_email|contact_phone|company_email/);
  assert.match(snapshot, /Anonymous supplier|Supplier [A-Z]/);
});

test('registration remains the only canonical provisioning workflow', () => {
  const route = read('app/api/supplier/registration/complete/route.ts');
  assert.match(route, /source_profile_id:profile\.data\.profile_id/);
  assert.match(route, /upsert\(payload,\{onConflict:'source_profile_id'\}\)/);
});

test('AJ Research identity constants are not rewritten by application or migration', () => {
  const all = supplierPages.map(read).join('\n') + read('database/043_run_in_supabase_sql_editor_repair_canonical_supplier_identity_and_rls.sql');
  for (const id of ['dfef2cb2-557e-4015-b19a-f866333356a9','5f998023-242b-4e80-a196-97db7d03911d','893e3f6d-f0ec-43ec-b461-d8a087b372df']) assert.doesNotMatch(all, new RegExp(id));
});
