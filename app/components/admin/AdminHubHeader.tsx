'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '../../../lib/supabase/client';
import ProductFinderModal from '../product-finder/ProductFinderModal';

type Props = { title?: string; description?: string; showProductFinderConfiguration?: boolean; showProductFinder?: boolean; showPreliminaryOrders?: boolean };

const initials = (value: string) => value.split(/\s+|@/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'A';

export default function AdminHubHeader({ title = 'Admin HUB', description = 'Review RFQs, suppliers, customers, and manually assign buyer RFQs to suppliers.', showProductFinderConfiguration = false, showProductFinder = false, showPreliminaryOrders = true }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState({ email: '', name: 'Admin User', companyName: 'Electron Market Admin', avatarUrl: '' });
  const [productFinderOpen, setProductFinderOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;
      const metadata = user.user_metadata || {};
      const { data } = await supabase.from('user_profiles').select('email, full_name, company_name').eq('id', user.id).maybeSingle();
      if (!active) return;
      setProfile({
        email: data?.email || user.email || '',
        name: data?.full_name || metadata.full_name || user.email || 'Admin User',
        companyName: data?.company_name || metadata.company_name || 'Electron Market Admin',
        avatarUrl: String(metadata.avatar_url || metadata.picture || '').trim(),
      });
    })();
    return () => { active = false; };
  }, [supabase]);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.assign('/login');
  };

  return <><header className="sticky top-0 z-[80] w-full bg-[#071b3a] px-4 py-4 text-white shadow-lg sm:px-6 lg:px-8">
    <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">Electron Market</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-blue-100">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {profile.email && <p className="max-w-[220px] truncate text-sm font-medium" title={profile.email}>{profile.email}</p>}
        {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" className="h-12 w-12 rounded-full border border-white/30 object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-blue-600 text-sm font-bold">{initials(profile.name || profile.email)}</div>}
        <div className="min-w-0"><p className="max-w-48 truncate text-sm font-semibold">{profile.name}</p><p className="max-w-48 truncate text-xs text-blue-100">{profile.companyName}</p></div>
        {showProductFinder && <button type="button" onClick={() => setProductFinderOpen(true)} className="admin-primary-button admin-primary-button-compact">Product AI Finder</button>}
        {showProductFinderConfiguration && <Link href="/admin/product-finder-ai-config" className="admin-primary-button admin-primary-button-compact">AI Product Finder Settings</Link>}
        {showPreliminaryOrders && <Link href="/admin/preliminary-orders" className="admin-primary-button admin-primary-button-compact">Preliminary Orders</Link>}
        <Link href="/" className="admin-primary-button admin-primary-button-compact">Home</Link>
        <button type="button" onClick={signOut} className="admin-primary-button admin-primary-button-compact">Sign out</button>
      </div>
    </div>
  </header><ProductFinderModal open={productFinderOpen} mode="admin" onClose={() => setProductFinderOpen(false)}/></>;
}
