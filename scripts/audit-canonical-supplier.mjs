import fs from 'node:fs';
import {createClient} from '@supabase/supabase-js';
const inputId=process.argv[2];if(!inputId)throw new Error('Usage: node scripts/audit-canonical-supplier.mjs <uuid>');
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).filter(x=>x&&!x.startsWith('#')&&x.includes('=')).map(line=>{const i=line.indexOf('=');return[line.slice(0,i),line.slice(i+1).replace(/^['"]|['"]$/g,'')]}));
const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
for(const [table,column] of [['suppliers','supplier_id'],['supplier_company_profiles','profile_id'],['supplier_company_profiles','user_id'],['user_profiles','id'],['verified_supplier','supplier_id']]){
 const result=await db.from(table).select('*').eq(column,inputId).limit(2);if(result.error)console.log(`${table}.${column}: ERROR ${result.error.message}`);else console.log(`${table}.${column}:`,result.data.map(row=>({supplier_id:row.supplier_id,profile_id:row.profile_id,user_id:row.user_id,source_profile_id:row.source_profile_id,canonical_supplier_id:row.canonical_supplier_id,company_name:row.company_name,name:row.name,role:row.role})));
}
const uploads=await db.from('supplier_stock_uploads').select('id,original_file_name,supplier_id,uploaded_by_user_id,total_rows,valid_rows,error_rows').eq('supplier_id',inputId);
if(!uploads.error&&uploads.data.length){const items=await db.from('supplier_stock_upload_items').select('id,upload_id,validation_status,created_product_id').in('upload_id',uploads.data.map(row=>row.id));console.log('supplier_stock_uploads:',uploads.data);console.log('supplier_stock_upload_items:',{count:items.data?.length??0,valid:items.data?.filter(row=>row.validation_status==='valid').length??0,imported:items.data?.filter(row=>row.created_product_id).length??0,error:items.error?.message});}
