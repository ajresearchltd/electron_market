'use client';

import Link from 'next/link';
import { ChevronDown, Menu, X } from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Suppliers', href: '#suppliers' },
  { label: 'Categories', href: '#categories' },
  { label: 'Resources', href: '#resources' },
  { label: 'About us', href: '#about' },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#071f49] text-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-xl font-bold tracking-tight text-white">
          ElectroMarket
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Main navigation">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className="text-sm font-medium text-blue-100 hover:text-white">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <button type="button" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 text-sm font-medium text-blue-50 hover:bg-white/10">
            EN
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          <Link href="/login" className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-blue-100 hover:text-white">
            Log in
          </Link>
          <Link href="/signup" className="inline-flex h-9 items-center rounded-md bg-[#2f80ff] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#4d95ff]">
            Sign up
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/15 text-white hover:bg-white/10 lg:hidden"
          aria-label="Toggle navigation menu"
          aria-expanded={open}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-[#071f49] lg:hidden">
          <nav className="mx-auto max-w-[1200px] space-y-4 px-4 py-5 sm:px-6 lg:px-8" aria-label="Mobile navigation">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="block text-sm font-medium text-blue-100 hover:text-white">
                {item.label}
              </a>
            ))}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Link href="/login" className="rounded-md border border-white/20 px-4 py-2.5 text-center text-sm font-semibold text-blue-50 hover:bg-white/10">
                Log in
              </Link>
              <Link href="/signup" className="rounded-md bg-[#2f80ff] px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-[#4d95ff]">
                Sign up
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
