'use client';

import { useEffect, useState } from 'react';
import { Activity, Box, Cpu, Lightbulb, Link2, Settings, Wifi, Zap } from 'lucide-react';
import { createClient } from '../../../lib/supabase/client';

const fallbackCategories = [
  { cat_id: 'fallback-1', pic: null, name: 'Microcontrollers', text: 'MCUs and embedded control components.', icon: Cpu },
  { cat_id: 'fallback-2', pic: null, name: 'Sensors', text: 'Measurement, detection, and monitoring sensors.', icon: Activity },
  { cat_id: 'fallback-3', pic: null, name: 'Power Supply', text: 'Power modules, adapters, and regulators.', icon: Zap },
  { cat_id: 'fallback-4', pic: null, name: 'Connectors', text: 'Board, cable, and industrial connectors.', icon: Link2 },
  { cat_id: 'fallback-5', pic: null, name: 'Industrial Automation', text: 'Automation controls and factory components.', icon: Settings },
  { cat_id: 'fallback-6', pic: null, name: 'IoT & Wireless', text: 'Wireless modules and connected-device parts.', icon: Wifi },
  { cat_id: 'fallback-7', pic: null, name: 'Optoelectronics', text: 'LEDs, displays, and optical components.', icon: Lightbulb },
  { cat_id: 'fallback-8', pic: null, name: 'Passive Components', text: 'Resistors, capacitors, inductors, and more.', icon: Box },
];

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
  const [categories, setCategories] = useState<CategoryRow[]>(fallbackCategories);

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
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950">Shop by Categories</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Explore electronic components across the categories buyers source most often.
            </p>
          </div>
          <a href="#categories" className="hidden text-xs font-semibold text-blue-700 hover:text-blue-800 sm:block">View all categories &rarr;</a>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max gap-3">
            {categories.map((category) => {
              const Icon = category.icon ?? Box;
              const pic = category.pic?.trim();
              const title = category.name || 'Category';

              return (
                <article key={category.cat_id} className="flex h-[150px] w-[136px] flex-shrink-0 flex-col items-center rounded-lg border border-slate-200 bg-white p-2 text-center shadow-sm hover:border-blue-200 hover:shadow-md">
                  <div className="flex h-[92px] w-full items-center justify-center overflow-hidden rounded-md bg-[#f3f7fd] text-blue-600">
                    {pic ? (
                      isImagePath(pic) ? (
                        <img src={pic} alt="" className="h-full w-full object-contain p-2" />
                      ) : (
                        <span className="text-sm font-bold text-blue-700">{pic}</span>
                      )
                    ) : (
                      <Icon size={30} aria-hidden="true" />
                    )}
                  </div>
                  <h3 className="mt-2 line-clamp-2 text-xs font-semibold leading-4 text-blue-950">{title}</h3>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

