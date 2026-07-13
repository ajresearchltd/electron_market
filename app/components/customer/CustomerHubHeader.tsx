'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '../../../lib/supabase/client';
import CustomerProfileModal from './CustomerProfileModal';
import HubButton from '../ui/HubButton';

export type CustomerHeaderIdentity = { email: string; name: string; companyName: string; avatarUrl: string };
const initials = (value: string) => value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'C';

export default function CustomerHubHeader({ identity: initialIdentity }: { identity: CustomerHeaderIdentity }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const identityButtonRef = useRef<HTMLButtonElement | null>(null);
  const [identity, setIdentity] = useState(initialIdentity);
  const [profileOpen, setProfileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => setIdentity(initialIdentity), [initialIdentity]);

  const signOut = async () => {
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();
    if (error) { setSigningOut(false); return; }
    router.replace('/'); router.refresh();
  };
  const goBack = () => {
    if (window.history.length > 1) { router.back(); return; }
    router.push(pathname === '/customer/dashboard' ? '/' : '/customer/dashboard');
  };
  const closeProfile = () => {
    setProfileOpen(false);
    window.requestAnimationFrame(() => identityButtonRef.current?.focus());
  };

  return <>
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#071b3a]/95 px-4 py-3 text-white shadow-lg backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[.25em] text-cyan-300">Electron Market</p><h1 className="mt-1 text-xl font-bold sm:text-2xl">Customer HUB</h1><p className="mt-1 hidden text-xs text-blue-100 sm:block">Manage RFQs, BOM files, supplier quotes, orders, messages, and procurement progress.</p></div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <button ref={identityButtonRef} type="button" onClick={() => setProfileOpen(true)} aria-label="Open customer profile" className="hub-identity-button group flex min-w-0 items-center gap-2 rounded-xl border border-white/10 text-left">
            <span className="hidden text-right sm:block"><span className="block max-w-48 truncate text-xs font-semibold">{identity.email}</span><span className="block max-w-48 truncate text-[11px] text-blue-100">{identity.name} · {identity.companyName}</span></span>
            {identity.avatarUrl ? <img src={identity.avatarUrl} alt="" className="h-9 w-9 rounded-full border border-white/30 object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-bold">{initials(identity.name || identity.email)}</span>}
          </button>
          <HubButton size="sm" onClick={signOut} loading={signingOut} loadingText="Signing out..." className="h-9">Sign out</HubButton>
          <HubButton size="sm" onClick={goBack} className="h-9">Back</HubButton>
        </div>
      </div>
    </header>
    <CustomerProfileModal
      isOpen={profileOpen}
      onClose={closeProfile}
      fallbackInitials={initials(identity.name || identity.email)}
      onProfileUpdated={(profile) => setIdentity((current) => ({
        ...current,
        name: String(profile.full_name || profile.contact_name || current.name),
        companyName: String(profile.company_name || current.companyName),
        avatarUrl: profile.profile_photo_url === '' ? '' : String(profile.profile_photo_url || current.avatarUrl),
      }))}
    />
  </>;
}
