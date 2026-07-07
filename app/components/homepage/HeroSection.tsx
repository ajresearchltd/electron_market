'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { loadHomepageContent } from './homepageContent';

const fallbackStats = [
  { value: '5,000+', label: 'Verified Suppliers' },
  { value: '200M+', label: 'Components' },
  { value: '150+', label: 'Countries' },
  { value: '24h', label: 'Avg Quote Time' },
];

const selectFields = 'section_1_title_of_site, section_1_subtitle_of_site, section_1_link_to_get_bom, section_1_link_to_supplier, section_1_under_title_1, section_1_under_title_2, section_1_under_title_3, section_1_under_title_4';

const parseStat = (value: string | null | undefined, fallback: { value: string; label: string }) => {
  if (!value) return fallback;
  const parts = value.trim().split(/\s+/);
  if (parts.length <= 1) return { value, label: fallback.label };
  return { value: parts[0], label: parts.slice(1).join(' ') };
};

export default function HeroSection() {
  const [title, setTitle] = useState('Global Marketplace for Electronic Components and Equipment');
  const [subtitle, setSubtitle] = useState('Upload your BOM, get quotes from verified suppliers and source components faster and smarter.');
  const [getBomHref, setGetBomHref] = useState('/create-request');
  const [stats, setStats] = useState(fallbackStats);

  useEffect(() => {
    let active = true;
    const loadHero = async () => {
      const row = await loadHomepageContent(selectFields);
      if (!active || !row) return;

      setTitle(row.section_1_title_of_site || 'Global Marketplace for Electronic Components and Equipment');
      setSubtitle(row.section_1_subtitle_of_site || 'Upload your BOM, get quotes from verified suppliers and source components faster and smarter.');
      setGetBomHref(row.section_1_link_to_get_bom || '/create-request');
      setStats(fallbackStats.map((stat, index) => parseStat(row[`section_1_under_title_${index + 1}`], stat)));
    };

    loadHero();
    return () => { active = false; };
  }, []);

  const fallbackTitle = title === 'Global Marketplace for Electronic Components and Equipment';

  return (
    <section className="relative isolate overflow-hidden bg-[#03142d] text-white">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#020b1f_0%,#061b3d_48%,#03142d_100%)]" />
      <div className="absolute inset-y-0 right-0 hidden w-[60%] md:block">
        <img src="/reference/friz_1.jpg" alt="Electronic circuit board and digital network" className="h-full w-full object-cover object-center opacity-100" />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#020b1f_0%,#061b3d_38%,rgba(6,27,61,0.72)_52%,rgba(6,27,61,0.18)_70%,rgba(6,27,61,0)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_18%_78%,rgba(47,128,255,0.14),transparent_32%)]" />
      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#020b1f] to-transparent" />

      <div className="relative mx-auto grid min-h-[540px] max-w-[1200px] grid-cols-1 items-center gap-8 px-4 py-12 sm:px-6 md:grid-cols-[0.46fr_0.54fr] md:py-14 lg:px-8">
        <div className="relative z-10 max-w-xl">
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-white drop-shadow-2xl md:text-5xl lg:text-6xl">
            {fallbackTitle ? <>Global Marketplace for <span className="text-cyan-300">Electronic Components</span> and Equipment</> : title}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-blue-100 drop-shadow md:text-xl">{subtitle}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={getBomHref} className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#2f80ff] px-6 text-base font-semibold text-white shadow-lg shadow-blue-950/30 hover:bg-[#4d95ff]">
              Upload BOM / Get Quotes
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link href="/register/supplier" className="inline-flex h-12 items-center justify-center rounded-md border border-white/35 bg-white/[0.08] px-6 text-base font-semibold text-white hover:bg-white/[0.15]">
              Register as supplier
            </Link>
          </div>

          <div className="mt-9 grid max-w-xl grid-cols-2 gap-x-8 gap-y-5 border-t border-white/15 pt-7">
            {stats.map((stat) => (
              <div key={`${stat.value}-${stat.label}`}>
                <div className="text-3xl font-extrabold text-white md:text-4xl">{stat.value}</div>
                <div className="mt-1 text-sm font-semibold text-blue-200">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-0 md:hidden">
          <img src="/reference/friz_1.jpg" alt="Electronic circuit board and digital network" className="h-[300px] w-full object-cover object-center opacity-95" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,20,45,0.08)_0%,rgba(3,20,45,0.5)_100%)]" />
        </div>
      </div>
    </section>
  );
}

