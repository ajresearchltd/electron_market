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
    <section className="bg-[#f5f8fc] py-8 md:py-10">
      <div className="mx-auto max-w-[1180px] rounded-xl bg-gradient-to-br from-slate-950 to-blue-900 px-4 py-7 text-white shadow-sm sm:px-6 lg:px-8">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-blue-100">{description}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {numbers.map((item, index) => {
            const Icon = item.icon;
            const pic = item.pic?.trim();
            return (
              <article key={`${item.label}-${index}`} className="rounded-lg border border-white/10 bg-white/10 p-4 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white/10 text-cyan-300">
                  {pic && isImagePath(pic) ? <img src={pic} alt="" className="h-8 w-8 rounded-full object-cover" /> : pic || <Icon size={22} aria-hidden="true" />}
                </div>
                <div className="text-2xl font-extrabold text-white md:text-3xl">{item.value}</div>
                <p className="mt-1 text-xs font-semibold text-blue-100">{item.label}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
