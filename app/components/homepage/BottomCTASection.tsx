'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { loadHomepageContent } from './homepageContent';

const selectFields = 'section_12_title, section_12_deviz, section_12_submit_rfq, section_12_submit_rfq_link';

export default function BottomCTASection() {
  const [title, setTitle] = useState('Ready to source smarter?');
  const [description, setDescription] = useState('Upload your BOM and start receiving quotes from verified suppliers.');
  const [buttonLabel, setButtonLabel] = useState('Upload BOM / Get Quotes');
  const [buttonHref, setButtonHref] = useState('/create-request');

  useEffect(() => {
    let active = true;
    const loadBottomCta = async () => {
      const row = await loadHomepageContent(selectFields);
      if (!active || !row) return;

      setTitle(row.section_12_title || 'Ready to source smarter?');
      setDescription(row.section_12_deviz || 'Upload your BOM and start receiving quotes from verified suppliers.');
      setButtonLabel(row.section_12_submit_rfq || 'Upload BOM / Get Quotes');
      setButtonHref(row.section_12_submit_rfq_link || '/create-request');
    };

    loadBottomCta();
    return () => { active = false; };
  }, []);

  return (
    <section className="bg-blue-600 py-16 text-white md:py-20">
      <div className="mx-auto max-w-[1200px] px-4 text-center sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/15 bg-white/10 px-6 py-10 shadow-xl shadow-blue-900/20 md:px-10">
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">{title}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-blue-100">{description}</p>
          <Link href={buttonHref} className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-md bg-white px-7 text-base font-bold text-blue-700 shadow-lg shadow-blue-950/20 hover:bg-blue-50">
            {buttonLabel}
            <ArrowRight size={20} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}