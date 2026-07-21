'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '../../../lib/supabase/client';
import CustomerProfileModal from './CustomerProfileModal';
import HubButton from '../ui/HubButton';
import ProductFinderModal from '../product-finder/ProductFinderModal';

export type CustomerHeaderIdentity = { email: string; name: string; companyName: string; avatarUrl: string };
const initials = (value: string) => value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'C';

export default function CustomerHubHeader({ identity: initialIdentity, profileIncomplete = false }: { identity: CustomerHeaderIdentity; profileIncomplete?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const identityButtonRef = useRef<HTMLButtonElement | null>(null);
  const [identity, setIdentity] = useState(initialIdentity);
  const [profileOpen, setProfileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [productFinderOpen, setProductFinderOpen] = useState(false);
  const [passwordOpen,setPasswordOpen]=useState(false),[newPassword,setNewPassword]=useState(''),[confirmPassword,setConfirmPassword]=useState(''),[passwordMessage,setPasswordMessage]=useState(''),[passwordBusy,setPasswordBusy]=useState(false);

  useEffect(() => setIdentity(initialIdentity), [initialIdentity]);
  useEffect(()=>{const openProfile=()=>setProfileOpen(true);window.addEventListener('electron-market:open-customer-profile',openProfile);return()=>window.removeEventListener('electron-market:open-customer-profile',openProfile)},[]);

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
  const createPassword=async()=>{setPasswordMessage('');if(newPassword.length<8)return setPasswordMessage('Use at least 8 characters.');if(newPassword!==confirmPassword)return setPasswordMessage('Passwords do not match.');setPasswordBusy(true);const{error}=await supabase.auth.updateUser({password:newPassword});setPasswordBusy(false);if(error)return setPasswordMessage('Password could not be created. Please try again.');setPasswordMessage('Password created. You may continue using either password or email-code sign-in.');setNewPassword('');setConfirmPassword('')};

  return <>
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#071b3a]/95 px-4 py-3 text-white shadow-lg backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[.25em] text-cyan-300">Electron Market</p><h1 className="mt-1 text-xl font-bold sm:text-2xl">Customer HUB</h1><p className="mt-1 hidden text-xs text-blue-100 sm:block">Manage RFQs, BOM files, supplier quotes, orders, messages, and procurement progress.</p></div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          {pathname==='/customer/dashboard'&&<HubButton size="sm" onClick={()=>setProductFinderOpen(true)} ariaLabel="Open Product AI Finder" className="h-9">Product AI Finder</HubButton>}
          <HubButton size="sm" href="/customer/requests" ariaLabel="Open preliminary orders" className="h-9">Preliminary Orders</HubButton>
          <HubButton size="sm" onClick={()=>setPasswordOpen(true)} ariaLabel="Create or update password" className="h-9">Create Password</HubButton>
          <button ref={identityButtonRef} type="button" onClick={() => setProfileOpen(true)} aria-label="Open customer profile" className="hub-identity-button group flex min-w-0 items-center gap-2 rounded-xl border border-white/10 text-left">
            <span className="hidden text-right sm:block"><span className="block max-w-48 truncate text-xs font-semibold">{identity.email}</span><span className="block max-w-48 truncate text-[11px] text-blue-100">{identity.name} · {identity.companyName}</span></span>
            {identity.avatarUrl ? <img src={identity.avatarUrl} alt="" className="h-9 w-9 rounded-full border border-white/30 object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-bold">{initials(identity.name || identity.email)}</span>}
          </button>
          <HubButton size="sm" onClick={signOut} loading={signingOut} loadingText="Signing out..." className="h-9">Sign out</HubButton>
          <HubButton size="sm" onClick={goBack} className="h-9">Back</HubButton>
        </div>
      </div>
      {profileIncomplete&&pathname!=='/customer/bom/upload'&&<div className="mx-auto mt-2 flex max-w-7xl flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300/40 bg-amber-100 px-3 py-2 text-xs text-amber-950"><span>Complete your customer and company profile to receive quotations, invoices and delivery documents correctly.</span><button onClick={()=>setProfileOpen(true)} className="font-bold underline">Complete Profile</button></div>}
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
    <ProductFinderModal open={productFinderOpen} mode="customer" onClose={()=>setProductFinderOpen(false)}/>
    {passwordOpen&&<div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-label="Create password"><div className="w-full max-w-md rounded-2xl bg-white p-6 text-slate-950 shadow-2xl"><h2 className="text-xl font-bold">Create Password</h2><p className="mt-2 text-sm text-slate-600">Your secure email-code login will remain available.</p><label className="mt-4 block text-sm font-semibold">New Password<input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} minLength={8} className="mt-1 w-full rounded-lg border px-3 py-2"/></label><label className="mt-3 block text-sm font-semibold">Confirm Password<input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} minLength={8} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>{passwordMessage&&<p className="mt-3 text-sm text-blue-800">{passwordMessage}</p>}<div className="mt-5 flex justify-end gap-2"><HubButton onClick={()=>setPasswordOpen(false)}>Close</HubButton><HubButton onClick={createPassword} loading={passwordBusy} loadingText="Saving...">Save Password</HubButton></div></div></div>}
  </>;
}
