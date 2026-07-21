'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Car, Factory, HeartPulse, RadioTower, Zap } from 'lucide-react';
import { createClient } from '../../../lib/supabase/client';
import { loadHomepageContent } from './homepageContent';

type IndustrySolutionRow = {
  ind_id: string;
  title: string | null;
  text: string | null;
  product_summary: string | null;
  pic: string | null;
  icon?: typeof Factory;
};

const isImagePath = (value: string) => value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/');

export default function IndustrySolutionsSection() {
  const [solutions, setSolutions] = useState<IndustrySolutionRow[]>([]);
  const [title, setTitle] = useState('Industry Solutions');
  const [description, setDescription] = useState('Specialized sourcing support for component-heavy industries.');

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    const loadSolutions = async () => {
      const { data, error } = await supabase
        .from('industry_solution')
        .select('ind_id, title, text, pic, product_summary')
        .order('title', { ascending: true });

      if (!active) return;

      if (error) {
        console.warn('industry_solution lookup failed.', error.message);
        return;
      }

      if (!data || data.length === 0) {
        return;
      }

      setSolutions((data as IndustrySolutionRow[]).map((solution) => ({
        ...solution,
      })));
    };

    const loadSectionContent = async () => {
      const row = await loadHomepageContent('section_4_title, section_4_description');
      if (!active || !row) return;
      setTitle(row.section_4_title || 'Industry Solutions');
      setDescription(row.section_4_description || 'Specialized sourcing support for component-heavy industries.');
    };

    loadSolutions();
    loadSectionContent();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="bg-white py-8 md:py-10">
      <div className="mx-auto w-full max-w-[1475px] px-4 sm:px-6 lg:px-8">
        <div className="mb-5">
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {description}
          </p>
        </div>

        <div className="grid grid-cols-2 justify-items-center gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
          {solutions.map((solution) => {
            const Icon = solution.icon ?? Factory;
            const pic = solution.pic?.trim();
            return (
              <Link href={`/industry-solutions/${encodeURIComponent(solution.ind_id)}`} key={solution.ind_id} className="h-full w-full max-w-[220px]">
              <article className="flex min-h-[245px] w-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm hover:border-blue-200 hover:shadow-md">
                <div className="flex h-[165px] w-full flex-none items-center justify-center overflow-hidden bg-blue-50 text-blue-600">
                  {pic ? (
                    isImagePath(pic) ? (
                      <img src={pic} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-blue-700">{pic}</span>
                    )
                  ) : (
                    <Icon size={28} aria-hidden="true" />
                  )}
                </div>
                <div className="flex min-h-0 flex-1 flex-col p-3 pb-3 text-center">
                  <h3 className="break-words text-sm font-bold leading-5 text-blue-700">{solution.title || 'Industry Solution'}</h3>
                  {solution.product_summary && <p className="mt-1.5 break-words pb-3 text-right text-xs font-medium leading-5 text-black">{solution.product_summary}</p>}
                </div>
              </article></Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
