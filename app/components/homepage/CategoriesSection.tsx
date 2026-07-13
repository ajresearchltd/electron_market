'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, Box, Cpu, Lightbulb, Link2, Settings, Wifi, Zap } from 'lucide-react';
import { createClient } from '../../../lib/supabase/client';

type CategoryRow = {
  cat_id: string;
  pic: string | null;
  name: string | null;
  text: string | null;
  icon?: typeof Cpu;
};

const isImagePath = (value: string) => {
  return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/');
};

export default function CategoriesSection() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);

  useEffect(() => {
    let active = true;

    const loadCategories = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('category')
        .select('cat_id, pic, name, text')
        .order('name', { ascending: true });

      if (!active || error || !data || data.length === 0) {
        return;
      }

      setCategories(data);
    };

    loadCategories();

    return () => {
      active = false;
    };
  }, []);

  return (
    <section id="categories" className="bg-white py-8 md:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950">Shop by Categories</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Explore electronic components across the categories buyers source most often.
            </p>
          </div>
          <a href="#categories" className="hidden text-xs font-semibold text-blue-700 hover:text-blue-800 sm:block">View all categories &rarr;</a>
        </div>

        <div className="pb-2">
          <div className="flex flex-wrap justify-center gap-5">
            {categories.map((category) => {
              const Icon = category.icon ?? Box;
              const pic = category.pic?.trim();
              const title = category.name || 'Category';

              return (
                <Link href={`/categories/${encodeURIComponent(category.cat_id)}`} key={category.cat_id}>
                <article className="flex h-[210px] w-[190px] flex-shrink-0 flex-col items-center rounded-lg border border-slate-200 bg-white p-3 text-center shadow-sm hover:border-blue-200 hover:shadow-md">
                  <div className="flex h-[130px] w-full items-center justify-center overflow-hidden rounded-md bg-[#f3f7fd] text-blue-600">
                    {pic ? (
                      isImagePath(pic) ? (
                        <img src={pic} alt="" className="h-full w-full object-contain p-3" />
                      ) : (
                        <span className="text-lg font-bold text-blue-700">{pic}</span>
                      )
                    ) : (
                      <Icon size={42} aria-hidden="true" />
                    )}
                  </div>
                  <h3 className="mt-3 line-clamp-2 text-base font-semibold leading-5 text-blue-950">{title}</h3>
                </article></Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

