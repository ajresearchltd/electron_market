import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {derivePublicProfileCompletion,isPublicProfileStatus,mapSupplierProfile,mapVerifiedSupplierPublic,validateSupplierProfile,type SupplierCompanyProfileEditableData} from '../lib/suppliers/profile-contract.ts';

const read=(path:string)=>fs.readFileSync(path,'utf8');
const sql=read('database/044_run_in_supabase_sql_editor_extend_existing_supplier_profile_fields.sql');
const valid=():SupplierCompanyProfileEditableData=>({
  publicDisplayName:'Supplier',publicShortDescription:'Short',publicDetailedDescription:'Detailed',country:'IL',city:'Haifa',supplierType:'Distributor',brands:'',categories:'Components',logoUrl:'',coverImageUrl:'',regionsServed:'EMEA',deliveryCountries:'IL',preferredCurrencies:'USD',website:'',employeeCount:10,supportedLanguages:['English'],minimumOrderValue:0,minimumOrderCurrency:'USD',typicalLeadTimeMinDays:2,typicalLeadTimeMaxDays:7,responseTimeHours:24,publicIncoterms:['EXW'],publicPaymentTerms:'Net 30',manufacturingCapabilities:['Assembly'],engineeringCapabilities:[],testingCapabilities:[],qualityControlCapabilities:[],customSourcingCapabilities:[],additionalCapabilities:[],
});

test('migration 044 extends only the two correct existing tables and creates no table',()=>{
  assert.match(sql,/ALTER TABLE public\.supplier_company_profiles/);
  assert.match(sql,/ALTER TABLE public\.verified_supplier/);
  assert.doesNotMatch(sql,/CREATE\s+TABLE/i);
  assert.doesNotMatch(sql,/ALTER TABLE public\.suppliers\s/i);
});

test('migration adds only live-audited missing profile fields and reuses existing equivalents',()=>{
  for(const column of ['supported_languages','minimum_order_value','minimum_order_currency','typical_lead_time_min_days','typical_lead_time_max_days','response_time_hours','public_incoterms','public_payment_terms','manufacturing_capabilities','engineering_capabilities','testing_capabilities','quality_control_capabilities','custom_sourcing_capabilities','additional_capabilities','public_profile_status'])assert.match(sql,new RegExp(`ADD COLUMN IF NOT EXISTS ${column}\\b`));
  const profileAlter=sql.split('-- Approved public snapshot fields.')[0];
  for(const reused of ['employee_count','regions_served','delivery_countries','preferred_currencies','pending_review_at','reviewed_at','updated_at','decision_reason','admin_notes'])assert.doesNotMatch(profileAlter,new RegExp(`ADD COLUMN IF NOT EXISTS ${reused}\\b`));
  assert.doesNotMatch(sql,/public_profile_completion_percent/);
});

test('profile status defaults to draft and accepts only the five Phase 2 states',()=>{
  assert.match(sql,/public_profile_status text NOT NULL DEFAULT 'draft'/);
  for(const status of ['draft','pending_review','approved','rejected','suspended'])assert.equal(isPublicProfileStatus(status),true);
  for(const status of ['verified','pending','public','revoked'])assert.equal(isPublicProfileStatus(status),false);
});

test('monetary values reject negatives and currency codes are uppercase',()=>{
  assert.equal(validateSupplierProfile({...valid(),minimumOrderValue:-1}).ok,false);
  assert.equal(validateSupplierProfile({...valid(),minimumOrderCurrency:'usd'}).ok,false);
  assert.equal(validateSupplierProfile(valid()).ok,true);
  assert.match(sql,/minimum_order_value IS NULL OR minimum_order_value >= 0/);
});

test('lead-time minimum cannot exceed maximum and response time is non-negative',()=>{
  assert.equal(validateSupplierProfile({...valid(),typicalLeadTimeMinDays:8,typicalLeadTimeMaxDays:7}).ok,false);
  assert.equal(validateSupplierProfile({...valid(),responseTimeHours:-1}).ok,false);
  assert.match(sql,/typical_lead_time_min_days <= typical_lead_time_max_days/);
});

test('completion is derived in trusted application code and remains between zero and one hundred',()=>{
  assert.equal(derivePublicProfileCompletion({...valid(),publicDisplayName:'',publicShortDescription:'',publicDetailedDescription:'',country:'',supplierType:'',categories:'',supportedLanguages:[],minimumOrderValue:null,typicalLeadTimeMinDays:null,typicalLeadTimeMaxDays:null,publicIncoterms:[],regionsServed:'',deliveryCountries:''}),0);
  assert.equal(derivePublicProfileCompletion(valid()),100);
});

test('array fields have database cardinality and server item limits',()=>{
  assert.match(sql,/cardinality\(supported_languages\),0\) <= 20/);
  assert.match(sql,/cardinality\(additional_capabilities\),0\) <= 30/);
  assert.equal(validateSupplierProfile({...valid(),supportedLanguages:Array.from({length:21},(_,i)=>`Language ${i}`)}).ok,false);
  assert.equal(validateSupplierProfile({...valid(),publicIncoterms:['EXW','exw']}).ok,false);
});

test('canonical mapper owns snake-case to camelCase naming',()=>{
  const mapped=mapSupplierProfile({public_display_name:'Mapped',minimum_order_currency:'USD',supported_languages:['English'],public_profile_status:'draft'});
  assert.equal(mapped.publicDisplayName,'Mapped');
  assert.equal(mapped.minimumOrderCurrency,'USD');
  assert.deepEqual(mapped.supportedLanguages,['English']);
  const snapshot=mapVerifiedSupplierPublic({public_display_name:'Approved',public_country:'IL',pic:'/logo.png',public_website_url:'https://example.test'});
  assert.equal(snapshot.publicDisplayName,'Approved');
  assert.equal(snapshot.country,'IL');
  assert.equal(snapshot.logoUrl,'/logo.png');
});

test('private fields and Phase 2 pending fields remain absent from public serializer',()=>{
  const route=read('app/api/public/suppliers/route.ts');
  for(const field of ['bank_name','iban','swift_bic','company_email','main_contact_email','admin_notes','decision_reason'])assert.doesNotMatch(route,new RegExp(field));
  assert.match(route,/verified_supplier/);
  assert.doesNotMatch(route,/supplier_company_profiles/);
});

test('migration 043 canonical public filters remain intact',()=>{
  const route=read('app/api/public/suppliers/route.ts');
  assert.match(route,/eq\('is_active',true\)\.eq\('is_public',true\)\.not\('canonical_supplier_id','is',null\)/);
  assert.match(route,/eq\('show_on_homepage',true\)[\s\S]{0,300}\.limit\(4\)/);
  assert.match(route,/eq\('show_public_website',true\)/);
});

test('Phase 2 migration invents no AJ, KINIK or Samsung relationships',()=>{
  for(const value of ['dfef2cb2-557e-4015-b19a-f866333356a9','5f998023-242b-4e80-a196-97db7d03911d','893e3f6d-f0ec-43ec-b461-d8a087b372df','18fad2ca-850f-49af-aeae-c0940081322f','b3f54b70-24bd-4256-88db-9001eae25f39'])assert.doesNotMatch(sql,new RegExp(value));
  assert.doesNotMatch(sql,/UPDATE\s+public\.(?:suppliers|verified_supplier)/i);
});

test('procurement auth identity, aliases and contact confidentiality remain unchanged',()=>{
  const assignment=read('database/007_create_rfq_supplier_assignments.sql');
  const customer=read('app/api/customer/rfqs/[rfqId]/route.ts');
  const snapshot=read('lib/ai/procurement-order-snapshot.ts');
  assert.match(assignment,/supplier_id uuid NOT NULL REFERENCES auth\.users\(id\)/);
  assert.match(customer,/supplierAlias/);
  assert.doesNotMatch(customer,/company_email|main_contact_email|contact_phone/);
  assert.match(snapshot,/Anonymous supplier|Supplier \[A-Z\]/);
});

test('existing Supplier HUB and Admin Verified Supplier contracts remain present',()=>{
  const modal=read('app/supplier/dashboard/components/SupplierCompanyProfileModal.tsx');
  const supplierRoute=read('app/api/supplier/profile/route.ts');
  const admin=read('app/admin/verified-suppliers/page.tsx');
  assert.match(modal,/\/api\/supplier\/profile/);
  assert.match(supplierRoute,/supplier_company_profiles/);
  assert.match(supplierRoute,/canonical_supplier_id/);
  assert.match(admin,/canonical_supplier_id/);
  assert.match(admin,/show_on_homepage/);
});

test('migration preserves RLS and creates no grants or anonymous profile policies',()=>{
  assert.doesNotMatch(sql,/DROP POLICY|CREATE POLICY|DISABLE ROW LEVEL SECURITY|GRANT\s/i);
  assert.doesNotMatch(sql,/TO anon/i);
});
