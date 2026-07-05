'use client';

import { Building2, Clock3, Globe2, Package } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isImagePath, loadHomepageContent } from './homepageContent';

const fallbackNumbers = [
  { label: 'Active Suppliers', value: '5,000+', icon: Building2, pic: null as string | null },
  { label: 'Components Listed', value: '200M+', icon: Package, pic: null as string | null },
  { label: 'Countries Served', value: '150+', icon: Globe2, pic: null as string | null },
  { label: 'Avg Quote Time', value: '24h', icon: Clock3, pic: null as string | null },
];

const selectFields = 'section_11_title, section_11_description, section_11_pic_1, section_11_digit_1, section_11_text_1, section_11_pic_2, section_11_digit_2, section_11_text_2, section_11_pic_3, section_11_digit_3, section_11_text_3, section_11_pic_4, section_11_digit_4, section_11_text_4, section_11_pic_5, section_11_digit_5, section_11_text_5, section_11_pic_6, section_11_digit_6, section_11_text_6';

export default function NumbersSection() {
  const [title, setTitle] = useState('ElectroMarket in Numbers');
  const [description, setDescription] = useState('The scale and reach behind our global component marketplace.');
  const [numbers, setNumbers] = useState(fallbackNumbers);

  useEffect(() => {
    let active = true;
    const loadNumbers = async () => {
      const row = await loadHomepageContent(selectFields);
      if (!active || !row) return;

      setTitle(row.section_11_title || 'ElectroMarket in Numbers');
      setDescription(row.section_11_description || 'The scale and reach behind our global component marketplace.');
      const dbNumbers = [1, 2, 3, 4, 5, 6].map((index) => {
        const fallback = fallbackNumbers[index - 1];
        if (!fallback && !row[`section_11_digit_${index}`] && !row[`section_11_text_${index}`] && !row[`section_11_pic_${index}`]) return null;
        return {
          value: row[`section_11_digit_${index}`] || fallback?.value || '',
          label: row[`section_11_text_${index}`] || fallback?.label || '',
          icon: fallback?.icon || Building2,
          pic: row[`section_11_pic_${index}`] || null,
        };
      }).filter(Boolean) as typeof fallbackNumbers;
      setNumbers(dbNumbers.length > 0 ? dbNumbers : fallbackNumbers);
    };

    loadNumbers();
    return () => { active = false; };
  }, []);

  return (
    <section className="bg-gradient-to-br from-slate-900 to-blue-900 py-16 text-white md:py-20">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">{title}</h2>
          <p className="mt-4 text-lg leading-8 text-blue-100 md:text-xl">{description}</p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {numbers.map((item, index) => {
            const Icon = item.icon;
            const pic = item.pic?.trim();
            return (
              <article key={`${item.label}-${index}`} className="rounded-xl border border-white/10 bg-white/10 p-7 text-center shadow-lg shadow-blue-950/20">
                <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-white/10 text-cyan-300">
                  {pic && isImagePath(pic) ? <img src={pic} alt="" className="h-20 w-20 rounded-full object-cover" /> : pic || <Icon size={44} aria-hidden="true" />}
                </div>
                <div className="text-5xl font-extrabold text-white md:text-6xl">{item.value}</div>
                <p className="mt-3 text-base font-semibold text-blue-100 md:text-lg">{item.label}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}