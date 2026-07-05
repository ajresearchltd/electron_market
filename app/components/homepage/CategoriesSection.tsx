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
    <section id="categories" className="bg-white py-16 md:py-20">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">Shop by Categories</h2>
          <p className="mt-4 text-base leading-7 text-slate-600 md:text-lg">
            Explore electronic components across the categories buyers source most often.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => {
            const Icon = category.icon ?? Box;
            const pic = category.pic?.trim();
            const title = category.name || 'Category';

            return (
              <article key={category.cat_id} className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm hover:border-blue-200 hover:shadow-md">
                <div className="mx-auto mb-5 flex h-40 w-40 items-center justify-center overflow-hidden rounded-xl bg-blue-50 text-blue-600">
                  {pic ? (
                    isImagePath(pic) ? (
                      <img src={pic} alt="" className="h-32 w-32 object-contain" />
                    ) : (
                      <span className="text-sm font-bold text-blue-700">{pic}</span>
                    )
                  ) : (
                    <Icon size={40} aria-hidden="true" />
                  )}
                </div>
                <h3 className="text-xl font-bold text-blue-950">{title}</h3>
                {category.text && <p className="mt-2 text-sm leading-6 text-slate-600">{category.text}</p>}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

