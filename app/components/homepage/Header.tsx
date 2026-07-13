'use client';

import Link from 'next/link';
import { ChevronDown, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { loadHomepageContent } from './homepageContent';

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

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#020b1f]/95 text-white shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-300/40 bg-blue-600/20 text-cyan-300">E</span>
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
          <Link href="/login" className="public-header-control inline-flex h-8 items-center rounded-md border border-white/15 px-3 text-xs font-medium text-blue-100 hover:bg-white/10 hover:text-white">
            Log in
          </Link>
          <Link href="/register/customer" className="public-header-control inline-flex h-8 items-center rounded-md bg-[#2f80ff] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#4d95ff]">
            Sign up
          </Link>
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
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Link href="/login" className="site-button rounded-md border border-white/20 px-4 py-2.5 text-center text-sm font-semibold text-blue-50 hover:bg-white/10">
                Log in
              </Link>
              <Link href="/register/customer" className="site-button rounded-md bg-[#2f80ff] px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-[#4d95ff]">
                Sign up
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

