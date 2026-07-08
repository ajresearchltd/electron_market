'use client';

import { ClipboardCheck, DollarSign, Package, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isImagePath, loadHomepageContent } from './homepageContent';

const fallbackSteps = [
  { title: 'Request & Quote', description: 'Post your RFQ and receive quotes from verified suppliers.', icon: ClipboardCheck, pic: null as string | null },
  { title: 'Negotiate', description: 'Compare prices, terms, and negotiate the best deal.', icon: DollarSign, pic: null as string | null },
  { title: 'Order', description: 'Place your order and receive shipment confirmation.', icon: Package, pic: null as string | null },
  { title: 'Delivery', description: 'Track shipment and receive your components.', icon: Truck, pic: null as string | null },
];

const selectFields = 'section_8_title, section_8_description, section_8_title_1, section_8_text_1, section_8_pic_1, section_8_title_2, section_8_text_2, section_8_pic_2, section_8_title_3, section_8_text_3, section_8_pic_3, section_8_title_4, section_8_text_4, section_8_pic_4, section_8_title_5, section_8_text_5, section_8_pic_5, section_8_title_6, section_8_text_6, section_8_pic_6';

export default function ProcessSection() {
  const [title, setTitle] = useState('The Process: From Request to Delivery');
  const [description, setDescription] = useState('A practical workflow for moving from sourcing intent to delivered components.');
  const [steps, setSteps] = useState(fallbackSteps);

  useEffect(() => {
    let active = true;
    const loadProcess = async () => {
      const row = await loadHomepageContent(selectFields);
      if (!active || !row) return;

      setTitle(row.section_8_title || 'The Process: From Request to Delivery');
      setDescription(row.section_8_description || 'A practical workflow for moving from sourcing intent to delivered components.');
      const dbSteps = [1, 2, 3, 4, 5, 6].map((index) => {
        const fallback = fallbackSteps[index - 1];
        if (!fallback && !row[`section_8_title_${index}`] && !row[`section_8_text_${index}`] && !row[`section_8_pic_${index}`]) return null;
        return {
          title: row[`section_8_title_${index}`] || fallback?.title || `Step ${index}`,
          description: row[`section_8_text_${index}`] || fallback?.description || '',
          icon: fallback?.icon || ClipboardCheck,
          pic: row[`section_8_pic_${index}`] || null,
        };
      }).filter(Boolean) as typeof fallbackSteps;
      setSteps(dbSteps.length > 0 ? dbSteps : fallbackSteps);
    };

    loadProcess();
    return () => { active = false; };
  }, []);

  return (
    <section className="bg-[#f5f8fc] py-8 md:py-10">
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8">
        <div className="mb-5">
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const pic = step.pic?.trim();
            return (
              <article key={`${step.title}-${index}`} className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm hover:border-blue-200 hover:shadow-md">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-blue-600">
                  {pic && isImagePath(pic) ? <img src={pic} alt="" className="h-10 w-10 rounded-full object-cover" /> : pic || <Icon size={24} aria-hidden="true" />}
                </div>
                <div className="mx-auto mb-3 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">{index + 1}</div>
                <h3 className="text-sm font-bold text-slate-950">{step.title}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-600">{step.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
