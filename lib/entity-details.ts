import { createClient } from './supabase/server';

export function decodeEntityId(value: unknown) {
  try {
    const id = decodeURIComponent(String(value)).trim();
    return !id || ['undefined', 'null', '[object Object]'].includes(id) ? null : id;
  } catch { return null; }
}

export async function getCategoryById(id: string) {
  const db=await createClient(); const result=await db.from('category').select('cat_id, name, pic, text, description, type_of_product').eq('cat_id',id).maybeSingle();
  if(result.error) console.error('Category detail query failed:',result.error.message); return result;
}
export async function getSpecialOfferById(id: string) {
  const db=await createClient(); const result=await db.from('homepage_marketing_discounts').select('id, company_name, title, subtitle, image_url, discount_text, sort_order, created_at, updated_at').eq('id',id).eq('is_active',true).maybeSingle();
  if(result.error) console.error('Special offer detail query failed:',result.error.message); return result;
}
export async function getIndustrySolutionById(id: string) {
  const db=await createClient(); const result=await db.from('industry_solution').select('ind_id, title, text, pic').eq('ind_id',id).maybeSingle();
  if(result.error) console.error('Industry solution detail query failed:',result.error.message); return result;
}
export async function getSupplierById(id: string) {
  const db=await createClient();
  const verified=await db.from('verified_supplier').select('supplier_id, name, pic, delivery_product').eq('supplier_id',id).maybeSingle();
  if(verified.error) console.error('Verified supplier detail query failed:',verified.error.message);
  if(verified.data) return { data: { source:'verified_supplier' as const, ...verified.data }, error:null };
  const canonical=await db.from('suppliers').select('supplier_id, supplier_name, company_name, logo_url, company_description, country, city, website, supplier_type, business_type, verified_supplier, official_authorized_distributor, supplier_status, products_count, supplier_rating').eq('supplier_id',id).eq('supplier_status','active').maybeSingle();
  if(canonical.error) console.error('Supplier detail query failed:',canonical.error.message);
  return { data: canonical.data ? { source:'suppliers' as const, ...canonical.data } : null, error: verified.error || canonical.error };
}
