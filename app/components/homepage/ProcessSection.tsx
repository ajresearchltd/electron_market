'use client';

import { ClipboardCheck, DollarSign, Package, Truck } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { isImagePath, loadHomepageContent } from './homepageContent';

const fallbackSteps = [
  { title: 'Request Quote', description: 'Post your RFQ and receive quotes from verified suppliers.', icon: ClipboardCheck, pic: null as string | null },
  { title: 'Negotiate', description: 'Compare prices, terms, and negotiate the best deal.', icon: DollarSign, pic: null as string | null },
  { title: 'Pay & Order', description: 'Place your order and receive shipment confirmation.', icon: Package, pic: null as string | null },
  { title: 'Delivery', description: 'Track shipment and receive your components.', icon: Truck, pic: null as string | null },
];

const processImages = [
  { src: '/reference/process/request-quote.webp', alt: 'Request a supplier quotation' },
  { src: '/reference/process/negotiate.webp', alt: 'Buyer and supplier negotiation' },
  { src: '/reference/process/pay-order.webp', alt: 'Secure payment and order confirmation' },
  { src: '/reference/process/delivery.webp', alt: 'Global order delivery' },
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" role="region" aria-label="Request to delivery process">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const pic = step.pic?.trim();
            const localImage = processImages[index];
            const imageSrc = pic && isImagePath(pic) ? pic : localImage?.src;
            return (
              <article key={`${step.title}-${index}`} className="group overflow-hidden rounded-xl border border-slate-700 bg-[#071633] text-left shadow-sm transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-blue-400 hover:shadow-xl motion-reduce:transform-none motion-reduce:transition-none">
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-blue-950">
                  {imageSrc ? (
                    imageSrc.startsWith('/') ? (
                      <Image src={imageSrc} alt={localImage?.alt || `${step.title} process step`} fill sizes="(max-width: 639px) 82vw, (max-width: 1023px) 50vw, 25vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none" />
                    ) : (
                      <img src={imageSrc} alt={localImage?.alt || `${step.title} process step`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none" loading="lazy" />
                    )
                  ) : (
                    <div className="flex h-full items-center justify-center text-cyan-300"><Icon size={44} aria-hidden="true" /></div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#071633]/45 via-transparent to-transparent" />
                </div>
                <div className="relative min-h-[132px] p-4 pt-5 text-white">
                  <div className="absolute -top-4 left-4 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#071633] bg-blue-500 text-xs font-bold text-white shadow-md">{index + 1}</div>
                  <h3 className="text-base font-bold text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-5 text-blue-100">{step.description}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
