import { createClient } from './supabase/server';

export const productSelect = 'product_id, product_name, brand_manufacturer, part_number_mpn, short_description, category, availability, base_price, base_currency, compare_at_price, discount_percent, moq_quantity, moq_unit, main_image_url, supplier_id';

export type PublicProduct = {
  product_id: string; product_name: string; brand_manufacturer: string | null;
  part_number_mpn: string | null; short_description: string | null; category: string | null;
  availability: string | null; base_price: number | null; base_currency: string | null;
  compare_at_price: number | null; discount_percent: number | null; moq_quantity: number | null;
  moq_unit: string | null; main_image_url: string | null; supplier_id: string | null;
};

export function publicProducts(query: any) {
  return query.eq('visibility', 'public').eq('is_active', true).eq('status', 'active').eq('product_status', 'active');
}

export async function getListingUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('user_profiles').select('email, company_name').eq('id', user.id).maybeSingle();
  return { email: profile?.email || user.email || '', companyName: profile?.company_name || '', avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || null };
}
