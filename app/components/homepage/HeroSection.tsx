'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const stats = [
  { value: '5,000+', label: 'Verified Suppliers' },
  { value: '200M+', label: 'Components' },
  { value: '150+', label: 'Countries' },
  { value: '24h', label: 'Avg Quote Time' },
];

export default function HeroSection() {
  return (
    <section className="overflow-hidden bg-[radial-gradient(circle_at_82%_30%,rgba(56,189,248,0.28),transparent_34%),linear-gradient(135deg,#061b3f_0%,#082a63_50%,#071632_100%)] text-white">
      <div className="mx-auto grid min-h-[640px] max-w-[1200px] grid-cols-1 items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.05fr_0.95fr] md:py-20 lg:px-8">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-white md:text-5xl lg:text-6xl">
            Global Marketplace for <span className="text-cyan-300">Electronic Components</span> and Equipment
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-blue-100 md:text-xl">
            Upload your BOM, get quotes from verified suppliers and source components faster and smarter.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/create-request" className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#2f80ff] px-6 text-base font-semibold text-white shadow-lg shadow-blue-950/30 hover:bg-[#4d95ff]">
              Upload BOM / Get Quotes
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link href="#suppliers" className="inline-flex h-12 items-center justify-center rounded-md border border-white/35 bg-white/[0.08] px-6 text-base font-semibold text-white hover:bg-white/[0.15]">
              Find Suppliers
            </Link>
          </div>

          <div className="mt-12 grid max-w-xl grid-cols-2 gap-x-8 gap-y-6 border-t border-white/15 pt-8">
            {stats.map((stat) => (
              <div key={stat.label}>
                <div className="text-3xl font-bold text-white md:text-4xl">{stat.value}</div>
                <div className="mt-1 text-sm font-medium text-blue-200">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="hidden md:flex md:justify-end">
          <div className="relative h-[420px] w-full max-w-[460px]">
            <div className="absolute inset-8 rounded-full border border-white/10 bg-blue-400/10 shadow-[0_0_90px_rgba(59,130,246,0.3)]" />
            <div className="absolute right-6 top-8 h-36 w-36 rotate-12 rounded-xl border border-cyan-200/30 bg-gradient-to-br from-cyan-300/90 to-blue-500/80 shadow-2xl" />
            <div className="absolute left-6 top-28 h-28 w-28 -rotate-6 rounded-xl border border-white/25 bg-gradient-to-br from-sky-300/85 to-cyan-500/75 shadow-2xl" />
            <div className="absolute bottom-8 right-20 h-32 w-32 rotate-3 rounded-xl border border-blue-200/25 bg-gradient-to-br from-blue-400/85 to-indigo-600/75 shadow-2xl" />
            <svg viewBox="0 0 240 240" className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 opacity-70" aria-hidden="true">
              <circle cx="120" cy="120" r="92" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
              <circle cx="120" cy="120" r="62" fill="none" stroke="rgba(125,211,252,0.34)" strokeWidth="1.5" />
              <circle cx="120" cy="120" r="28" fill="rgba(59,130,246,0.18)" stroke="rgba(255,255,255,0.28)" strokeWidth="2" />
              <path d="M120 28v64M120 148v64M28 120h64M148 120h64M76 76l30 30M134 134l30 30M164 76l-30 30M106 134l-30 30" stroke="rgba(186,230,253,0.42)" strokeWidth="2" strokeLinecap="round" />
              <circle cx="120" cy="28" r="5" fill="#38bdf8" />
              <circle cx="212" cy="120" r="5" fill="#60a5fa" />
              <circle cx="120" cy="212" r="5" fill="#38bdf8" />
              <circle cx="28" cy="120" r="5" fill="#60a5fa" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
