'use client';

import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { loadHomepageContent } from './homepageContent';
import {openRequestEntry}from'./RequestEntryModal';

const selectFields = 'section_12_title, section_12_deviz, section_12_submit_rfq, section_12_submit_rfq_link';

export default function BottomCTASection() {
  const [title, setTitle] = useState('Ready to source smarter?');
  const [description, setDescription] = useState('Upload your BOM and start receiving quotes from verified suppliers.');
  const [buttonLabel, setButtonLabel] = useState('Upload BOM / Get Quotes');

  useEffect(() => {
    let active = true;
    const loadBottomCta = async () => {
      const row = await loadHomepageContent(selectFields);
      if (!active || !row) return;

      setTitle(row.section_12_title || 'Ready to source smarter?');
      setDescription(row.section_12_deviz || 'Upload your BOM and start receiving quotes from verified suppliers.');
      setButtonLabel(row.section_12_submit_rfq || 'Upload BOM / Get Quotes');
    };

    loadBottomCta();
    return () => { active = false; };
  }, []);

  return (
    <section className="bg-white py-8 text-white md:py-10">
      <div className="mx-auto max-w-[1180px] px-4 text-center sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#061b3d] px-6 py-8 shadow-xl shadow-blue-900/20 md:px-10">
          <img src="/reference/friz_1.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
          <div className="relative z-10">
          <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">{title}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-blue-100">{description}</p>
          <button type="button" onClick={openRequestEntry} className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#2f80ff] px-5 text-sm font-bold text-white shadow-lg shadow-blue-950/20 hover:bg-[#4d95ff]">
            {buttonLabel}
            <ArrowRight size={20} aria-hidden="true" />
          </button>
          </div>
        </div>
      </div>
    </section>
  );
}
