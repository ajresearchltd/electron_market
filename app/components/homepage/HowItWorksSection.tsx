'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, ClipboardCheck, SearchCheck, Truck, UploadCloud } from 'lucide-react';
import { isImagePath, loadHomepageContent } from './homepageContent';

type Step = { number: string; pic: string | null; title: string; description: string };

const fallbackSteps: Step[] = [
  { number: '01', pic: null, title: 'Upload BOM', description: 'Submit your bill of materials and sourcing requirements.' },
  { number: '02', pic: null, title: 'Smart Matching', description: 'Parts are matched with verified suppliers and alternatives.' },
  { number: '03', pic: null, title: 'Receive Quotes', description: 'Compare supplier responses, lead times, and pricing.' },
  { number: '04', pic: null, title: 'Order Confidently', description: 'Choose the best offer and move from RFQ to delivery.' },
];
const stepIcons = [UploadCloud, SearchCheck, ClipboardCheck, Truck];
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
    <section id="how-it-works" className="bg-[#f3f7fd] py-8 md:py-10">
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-6 rounded-2xl border border-blue-100 bg-[#eef6ff] p-4 shadow-sm sm:p-5 lg:grid-cols-[1.55fr_0.85fr] lg:p-6">
          <div>
            <div className="mb-5">
              <h2 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
            </div>

            <div className="homepage-mobile-horizontal-scroll category-scrollbar grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" role="region" aria-label="How it works steps" tabIndex={0}>
              {steps.map((step, index) => {
                const pic = step.pic?.trim();
                const StepIcon = stepIcons[index] || UploadCloud;
                return (
                  <div key={step.number} className="homepage-mobile-horizontal-card relative">
                    <article className="h-full rounded-xl border border-blue-100 bg-white p-4 text-center shadow-sm hover:border-blue-200 hover:shadow-md">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                        {pic && isImagePath(pic) ? <img src={pic} alt="" className="h-11 w-11 object-contain" /> : pic ? <span className="text-sm font-bold">{pic}</span> : <StepIcon size={30} aria-hidden="true" />}
                      </div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-blue-600">Step {step.number}</p>
                      <h3 className="mt-1 text-sm font-bold text-slate-950">{step.title}</h3>
                      <p className="mt-2 text-xs leading-5 text-slate-600">{step.description}</p>
                    </article>
                    {index < steps.length - 1 && (
                      <div className="pointer-events-none absolute right-[-20px] top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-blue-100 bg-white text-blue-500 shadow-sm lg:flex">
                        <ArrowRight size={16} aria-hidden="true" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <a href="#" className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm shadow-blue-900/10 hover:bg-blue-500">
              Learn more
            </a>
          </div>

          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-md shadow-blue-950/5">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-slate-950">AI-Powered BOM Analysis</h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">Upload a parts list and let intelligent matching speed up supplier discovery.</p>
            </div>
            <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-slate-950/95 p-3">
              <img src="/reference/ai_bom.png" alt="AI-powered BOM analysis" className="max-h-full w-full object-contain" />
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

