'use client';

import { useEffect, useState } from 'react';
import { Activity, Box, Cpu, Lightbulb, Link2, Settings, Wifi, Zap } from 'lucide-react';
import { createClient } from '../../../lib/supabase/client';

const fallbackCategories = [
  { Cat_ID: 1, Pic: null, Name: 'Microcontrollers', Text: 'MCUs and embedded control components.', icon: Cpu },
  { Cat_ID: 2, Pic: null, Name: 'Sensors', Text: 'Measurement, detection, and monitoring sensors.', icon: Activity },
  { Cat_ID: 3, Pic: null, Name: 'Power Supply', Text: 'Power modules, adapters, and regulators.', icon: Zap },
  { Cat_ID: 4, Pic: null, Name: 'Connectors', Text: 'Board, cable, and industrial connectors.', icon: Link2 },
  { Cat_ID: 5, Pic: null, Name: 'Industrial Automation', Text: 'Automation controls and factory components.', icon: Settings },
  { Cat_ID: 6, Pic: null, Name: 'IoT & Wireless', Text: 'Wireless modules and connected-device parts.', icon: Wifi },
  { Cat_ID: 7, Pic: null, Name: 'Optoelectronics', Text: 'LEDs, displays, and optical components.', icon: Lightbulb },
  { Cat_ID: 8, Pic: null, Name: 'Passive Components', Text: 'Resistors, capacitors, inductors, and more.', icon: Box },
];

type CategoryRow = {
  Cat_ID: number | string;
  Pic: string | null;
  Name: string | null;
  Text: string | null;
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
        .from('Category')
        .select('Cat_ID, Pic, Name, Text')
        .order('Cat_ID', { ascending: true });

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
            const pic = category.Pic?.trim();
            const title = category.Name || 'Category';

            return (
              <article key={category.Cat_ID} className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm hover:border-blue-200 hover:shadow-md">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-blue-600">
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
                <h3 className="text-base font-bold text-slate-950">{title}</h3>
                {category.Text && <p className="mt-2 text-sm leading-6 text-slate-600">{category.Text}</p>}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
