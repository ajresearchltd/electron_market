'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ChevronDown, LayoutDashboard, LogOut, Menu, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { loadHomepageContent } from './homepageContent';
import {createClient}from'../../../lib/supabase/client';
import { getPublicHubNavigation } from '../../../lib/auth/redirectByRole';

const fallbackNavItems = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Suppliers', href: '#suppliers' },
  { label: 'Categories', href: '#categories' },
  { label: 'Resources', href: '#resources' },
  { label: 'About us', href: '#about' },
];

const selectFields = 'section_1_country, section_1_language, section_1_name, section_1_description, section_1_menu_1, section_1_menu_1_link, section_1_menu_2, section_1_menu_2_link, section_1_menu_3, section_1_menu_3_link, section_1_menu_4, section_1_menu_4_link';

export default function Header() {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState('EN');
  const [navItems, setNavItems] = useState(fallbackNavItems);
  const [identity,setIdentity]=useState<any>(null);

  useEffect(() => {
    let active = true;
    const loadHeader = async () => {
      const row = await loadHomepageContent(selectFields);
      if (!active || !row) return;

      setLanguage(row.section_1_language ? row.section_1_language.slice(0, 2).toUpperCase() : 'EN');
      setNavItems(fallbackNavItems.map((item, index) => ({
        label: row[`section_1_menu_${index + 1}`] || item.label,
        href: row[`section_1_menu_${index + 1}_link`] || item.href,
      })));
    };

    loadHeader();
    return () => { active = false; };
  }, []);
  useEffect(()=>{let active=true;const load=()=>fetch('/api/public/request-access/session',{cache:'no-store'}).then(r=>r.json()).then(value=>{if(active)setIdentity(value.kind==='authenticated'?value:null)}).catch(()=>{});load();window.addEventListener('electron-market:auth-changed',load);const{data}=createClient().auth.onAuthStateChange(()=>load());return()=>{active=false;window.removeEventListener('electron-market:auth-changed',load);data.subscription.unsubscribe()}},[]);
  const signOut=async()=>{await createClient().auth.signOut();setIdentity(null);window.location.href='/'};
  const hubHref=identity?.role==='admin'||identity?.role==='support'?'/admin':identity?.role==='supplier'?'/supplier/dashboard':'/customer/dashboard';
  const hubNavigation = getPublicHubNavigation(identity?.role);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#020b1f]/95 text-white shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-white">
          <Image
            src="/reference/web_logo_em.png"
            alt="ElectronMarket"
            width={40}
            height={40}
            priority
            className="h-[34px] w-[34px] shrink-0 object-contain sm:h-[38px] sm:w-[38px]"
          />
          <span className="leading-none">
            <span>Electron</span><span className="text-cyan-300">Market</span>
            <span className="block text-[10px] font-semibold text-blue-200">Global Components Marketplace</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Main navigation">
          {navItems.map((item) => (
            <a key={`${item.label}-${item.href}`} href={item.href} className="text-sm font-medium text-blue-100 hover:text-white">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <button type="button" className="public-header-control inline-flex h-8 items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 text-xs font-medium text-blue-50 hover:bg-white/10">
            {language}
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          {identity?<>{hubNavigation&&<Link href={hubNavigation.href} aria-label={hubNavigation.ariaLabel} className="public-header-control inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-white/30 bg-indigo-950 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-100 hover:text-blue-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-950"><LayoutDashboard size={14} aria-hidden="true"/>{hubNavigation.label}</Link>}<Link href={hubHref} className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-left hover:bg-white/10">{identity.avatarUrl?<img src={identity.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover"/>:<span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600"><User size={16}/></span>}<span className="max-w-36 leading-tight"><strong className="block truncate text-xs text-white">{identity.fullName}</strong><span className="block truncate text-[10px] text-blue-200">{identity.companyName}</span></span></Link><button onClick={signOut} aria-label="Sign out" className="rounded-md border border-white/15 p-2 text-blue-100 hover:bg-white/10"><LogOut size={15}/></button></>:<><Link href="/login" className="public-header-control inline-flex h-8 items-center rounded-md border border-white/15 px-3 text-xs font-medium text-blue-100 hover:bg-white/10 hover:text-white">
            Log in
          </Link>
          <Link href="/register/customer" className="public-header-control inline-flex h-8 items-center rounded-md bg-[#2f80ff] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#4d95ff]">
            Sign up
          </Link></>}
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="public-menu-trigger inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/15 text-white hover:bg-white/10 lg:hidden"
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={open}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-[#020b1f]/95 backdrop-blur-xl lg:hidden">
          <nav className="mx-auto max-w-[1200px] space-y-4 px-4 py-5 sm:px-6 lg:px-8" aria-label="Mobile navigation">
            {navItems.map((item) => (
              <a key={`${item.label}-${item.href}`} href={item.href} className="block text-sm font-medium text-blue-100 hover:text-white">
                {item.label}
              </a>
            ))}
            {identity?<div className="grid gap-3 pt-2">{hubNavigation&&<Link href={hubNavigation.href} aria-label={hubNavigation.ariaLabel} className="inline-flex items-center justify-center gap-2 rounded-md border border-blue-300 bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"><LayoutDashboard size={16} aria-hidden="true"/>{hubNavigation.label}</Link>}<Link href={hubHref} className="rounded-md border border-white/15 bg-white/5 px-4 py-2.5 text-center text-sm font-semibold text-white">{identity.fullName} · Profile</Link><button onClick={signOut} className="rounded-md border border-white/20 px-4 py-2.5 text-sm font-semibold">Sign out</button></div>:<div className="grid grid-cols-2 gap-3 pt-2">
              <Link href="/login" className="site-button rounded-md border border-white/20 px-4 py-2.5 text-center text-sm font-semibold text-blue-50 hover:bg-white/10">
                Log in
              </Link>
              <Link href="/register/customer" className="site-button rounded-md bg-[#2f80ff] px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-[#4d95ff]">
                Sign up
              </Link>
            </div>}
          </nav>
        </div>
      )}
    </header>
  );
}

