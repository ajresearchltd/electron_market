'use client';

import { CheckCircle, Globe2, Headphones, ShieldCheck, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isImagePath, loadHomepageContent } from './homepageContent';

const fallbackBenefits = [
  { title: 'Fast Quotes', description: 'Average supplier responses within 24 hours.', icon: Timer, pic: null as string | null },
  { title: 'Verified Suppliers', description: 'Supplier profiles are reviewed for marketplace quality.', icon: ShieldCheck, pic: null as string | null },
  { title: 'Quality Assured', description: 'Source from partners with documentation and compliance support.', icon: CheckCircle, pic: null as string | null },
  { title: 'Global Reach', description: 'Access sourcing options across 150+ countries.', icon: Globe2, pic: null as string | null },
  { title: '24/7 Support', description: 'Help for urgent RFQs and supplier coordination.', icon: Headphones, pic: null as string | null },
  { title: 'Better Comparisons', description: 'Compare pricing, lead times, and terms in one workflow.', icon: CheckCircle, pic: null as string | null },
];

const selectFields = 'section_5_title, section_5_description, section_5_name_1, section_5_text_1, section_5_pic_1, section_5_name_2, section_5_text_2, section_5_pic_2, section_5_name_3, section_5_text_3, section_5_pic_3, section_5_name_4, section_5_text_4, section_5_pic_4, section_5_name_5, section_5_text_5, section_5_pic_5, section_5_name_6, section_5_text_6, section_5_pic_6';

export default function WhyBuyersSection() {
  const [title, setTitle] = useState('Why buyers choose ElectroMarket');
  const [description, setDescription] = useState('Procurement teams get trusted suppliers, broad coverage, and clean sourcing workflows.');
  const [benefits, setBenefits] = useState(fallbackBenefits);

  useEffect(() => {
    let active = true;
    const loadBenefits = async () => {
      const row = await loadHomepageContent(selectFields);
      if (!active || !row) return;

      setTitle(row.section_5_title || 'Why buyers choose ElectroMarket');
      setDescription(row.section_5_description || 'Procurement teams get trusted suppliers, broad coverage, and clean sourcing workflows.');
      setBenefits(fallbackBenefits.map((benefit, index) => ({
        ...benefit,
        title: row[`section_5_name_${index + 1}`] || benefit.title,
        description: row[`section_5_text_${index + 1}`] || benefit.description,
        pic: row[`section_5_pic_${index + 1}`] || null,
      })));
    };

    loadBenefits();
    return () => { active = false; };
  }, []);

  return (
    <section className="bg-white py-16 md:py-20">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-4xl font-extrabold tracking-tight text-[#0B2A5B] md:text-5xl">{title}</h2>
          <p className="mt-4 text-lg leading-8 text-slate-600 md:text-xl">{description}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;
            const pic = benefit.pic?.trim();
            return (
              <article key={benefit.title} className="rounded-xl border border-slate-200 bg-white p-7 shadow-sm hover:border-blue-200 hover:shadow-md">
                <div className="mb-6 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-lg font-bold text-blue-600">
                  {pic && isImagePath(pic) ? <img src={pic} alt="" className="h-20 w-20 rounded-full object-cover" /> : pic || <Icon size={42} aria-hidden="true" />}
                </div>
                <h3 className="text-xl font-extrabold text-[#0B2A5B]">{benefit.title}</h3>
                <p className="mt-2 text-base leading-7 text-slate-600">{benefit.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}