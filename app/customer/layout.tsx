import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import CustomerHubHeader from '../components/customer/CustomerHubHeader';
import {customerProfileCompleteness}from'../../lib/customer/profile-completeness';
import { createClient } from '../../lib/supabase/server';

export default async function CustomerLayout({children}:{children:ReactNode}){
  const supabase=await createClient(); const{data:{user}}=await supabase.auth.getUser(); if(!user)redirect('/login');
  const[{data:profile},{data:company}]=await Promise.all([supabase.from('user_profiles').select('email, full_name, company_name').eq('id',user.id).maybeSingle(),supabase.from('customer_company_profiles').select('company_name, contact_name, contact_phone, phone, country_iso2, country_name, business_registration_number, registration_number, profile_photo_url, profile_photo_path').eq('user_id',user.id).maybeSingle()]);
  let avatarUrl=String(company?.profile_photo_url||user.user_metadata?.avatar_url||user.user_metadata?.picture||''); if(company?.profile_photo_path){const{data}=await supabase.storage.from('customer-profile-photos').createSignedUrl(company.profile_photo_path,3600);avatarUrl=data?.signedUrl||avatarUrl}
  const identity={email:String(profile?.email||user.email||''),name:String(profile?.full_name||company?.contact_name||user.email||'Customer'),companyName:String(company?.company_name||profile?.company_name||'Electron Market Buyer'),avatarUrl};
  const profileIncomplete=!customerProfileCompleteness(profile,company).complete;
  return <div className="hub-scope"><CustomerHubHeader identity={identity} profileIncomplete={profileIncomplete}/><div className="pt-[154px] sm:pt-[142px] lg:pt-[106px]">{children}</div></div>;
}
