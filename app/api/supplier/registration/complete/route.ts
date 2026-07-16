import { NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase/server';
import { createAdminClient } from '../../../../../lib/supabase/admin';

export async function POST() {
  const session = await createClient();
  const {data:{user}} = await session.auth.getUser();
  if (!user) return NextResponse.json({error:'Authentication required.'},{status:401});
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({error:'Supplier registration is temporarily unavailable.'},{status:503});
  const profile = await admin.from('supplier_company_profiles').select('profile_id,user_id,company_name,company_email,company_phone,main_contact_name,country_name').eq('user_id',user.id).maybeSingle();
  if (!profile.data) return NextResponse.json({error:'Supplier company profile was not found.'},{status:409});
  const payload = {source_profile_id:profile.data.profile_id,supplier_name:profile.data.company_name||'Supplier',company_name:profile.data.company_name||'Supplier',contact_email:profile.data.company_email||null,email:profile.data.company_email||null,contact_phone:profile.data.company_phone||null,contact_person:profile.data.main_contact_name||null,country:profile.data.country_name||null,supplier_status:'active'};
  const saved = await admin.from('suppliers').upsert(payload,{onConflict:'source_profile_id'}).select('supplier_id,source_profile_id').single();
  if (saved.error) { console.error('Canonical supplier registration failed:',saved.error); return NextResponse.json({error:'Supplier relationship could not be created.'},{status:409}); }
  return NextResponse.json({canonicalSupplierId:saved.data.supplier_id,sourceProfileId:saved.data.source_profile_id});
}
