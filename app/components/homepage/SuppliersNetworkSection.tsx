'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isImagePath, loadHomepageContent } from './homepageContent';

const fallbackPoints = ['Direct access to verified buyers', 'Automate quote generation', 'Zero commission on first 100 quotes'];
const fallbackCards = [
  { title: '50K+', text: 'Monthly opportunities', pic: null as string | null },
  { title: '150+', text: 'Buyer countries', pic: null as string | null },
  { title: 'Supplier growth channel', text: 'Receive RFQs, quote faster, and build long-term buyer relationships from one marketplace profile.', pic: null as string | null },
  { title: 'Trusted marketplace', text: 'Build visibility with procurement teams sourcing verified electronic components.', pic: null as string | null },
];

const selectFields = 'section_6_title, section_6_description, section_6_title_1, section_6_text_1, section_6_pic_1, section_6_title_2, section_6_text_2, section_6_pic_2, section_6_title_3, section_6_text_3, section_6_pic_3, section_6_title_4, section_6_text_4, section_6_pic_4, section_6_simple_1, section_6_simple_2, section_6_simple_3, section_6_simple_4';

export default function SuppliersNetworkSection() {
  const [title, setTitle] = useState('For Suppliers: Join Our Network');
  const [description, setDescription] = useState('Connect with buyers globally and grow your business with access to high-intent sourcing opportunities.');
  const [points, setPoints] = useState(fallbackPoints);
  const [cards, setCards] = useState(fallbackCards);

  useEffect(() => {
    let active = true;
    const loadSuppliersNetwork = async () => {
      const row = await loadHomepageContent(selectFields);
      if (!active || !row) return;

      setTitle(row.section_6_title || 'For Suppliers: Join Our Network');
      setDescription(row.section_6_description || 'Connect with buyers globally and grow your business with access to high-intent sourcing opportunities.');
      const dbPoints = [1, 2, 3, 4].map((index) => row[`section_6_simple_${index}`]).filter(Boolean) as string[];
      setPoints(dbPoints.length > 0 ? dbPoints : fallbackPoints);
      setCards(fallbackCards.map((card, index) => ({
        title: row[`section_6_title_${index + 1}`] || card.title,
        text: row[`section_6_text_${index + 1}`] || card.text,
        pic: row[`section_6_pic_${index + 1}`] || null,
      })));
    };

    loadSuppliersNetwork();
    return () => { active = false; };
  }, []);

  return (
    <section className="bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 py-16 text-white md:py-20">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">{title}</h2>
            <p className="mt-4 text-lg leading-8 text-blue-100">{description}</p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {points.map((point) => (
                <li key={point} className="flex items-center gap-3 text-sm font-medium text-blue-50">
                  <CheckCircle size={18} className="shrink-0 text-cyan-300" aria-hidden="true" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            <Link href="/signup?type=supplier" className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-md bg-white px-6 text-base font-bold text-blue-700 shadow-lg shadow-blue-950/20 hover:bg-blue-50">
              Become a Supplier
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-6 shadow-2xl shadow-blue-950/25 backdrop-blur">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {cards.map((card, index) => {
                const pic = card.pic?.trim();
                return (
                  <div key={`${card.title}-${index}`} className={index >= 2 ? 'rounded-xl bg-white p-5 text-slate-900 sm:col-span-2' : 'rounded-xl bg-white/10 p-5'}>
                    {pic && (
                      <div className="mb-3 flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-white/10 text-sm font-bold text-cyan-200">
                        {isImagePath(pic) ? <img src={pic} alt="" className="h-8 w-8 object-contain" /> : pic}
                      </div>
                    )}
                    <div className={index >= 2 ? 'text-sm font-semibold text-blue-700' : 'text-3xl font-bold text-white'}>{card.title}</div>
                    <p className={index >= 2 ? 'mt-2 text-sm leading-6 text-slate-600' : 'mt-1 text-sm text-blue-100'}>{card.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}