'use client';

import { useEffect, useState } from 'react';
import { isImagePath, loadHomepageContent } from './homepageContent';

type Step = { number: string; pic: string | null; title: string; description: string };

const fallbackSteps: Step[] = [
  { number: '01', pic: null, title: 'Upload BOM', description: 'Submit your bill of materials and sourcing requirements.' },
  { number: '02', pic: null, title: 'Smart Matching', description: 'Parts are matched with verified suppliers and alternatives.' },
  { number: '03', pic: null, title: 'Receive Quotes', description: 'Compare supplier responses, lead times, and pricing.' },
  { number: '04', pic: null, title: 'Order Confidently', description: 'Choose the best offer and move from RFQ to delivery.' },
];
const selectFields = 'section_2_title_1, section_2_title_2, section_2_pic_1, section_2_name_1, section_2_text_1, section_2_pic_2, section_2_name_2, section_2_text_2, section_2_pic_3, section_2_name_3, section_2_text_3, section_2_pic_4, section_2_name_4, section_2_text_4, section_2_link_button';

export default function HowItWorksSection() {
  const [title, setTitle] = useState('How it works');
  const [description, setDescription] = useState('A simple workflow that gets buyers from part list to supplier quotes fast.');
  const [steps, setSteps] = useState<Step[]>(fallbackSteps);

  useEffect(() => {
    let active = true;
    const loadHowItWorks = async () => {
      const row = await loadHomepageContent(selectFields);
      if (!active || !row) return;
      setTitle(row.section_2_title_1 || 'How it works');
      setDescription(row.section_2_title_2 || 'A simple workflow that gets buyers from part list to supplier quotes fast.');
      setSteps(fallbackSteps.map((step, index) => ({
        number: step.number,
        pic: row[`section_2_pic_${index + 1}`],
        title: row[`section_2_name_${index + 1}`] || step.title,
        description: row[`section_2_text_${index + 1}`] || step.description,
      })));
    };
    loadHowItWorks();
    return () => { active = false; };
  }, []);

  return (
    <section id="how-it-works" className="bg-slate-50 py-16 md:py-20">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">{title}</h2>
          <p className="mt-4 text-base leading-7 text-slate-600 md:text-lg">{description}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => {
            const pic = step.pic?.trim();
            return (
              <article key={step.number} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-blue-200 hover:shadow-md">
                <div className="mb-5 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-blue-600 text-sm font-bold text-white">
                  {pic && isImagePath(pic) ? <img src={pic} alt="" className="h-8 w-8 object-contain" /> : pic || step.number}
                </div>
                <h3 className="text-lg font-bold text-slate-950">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

