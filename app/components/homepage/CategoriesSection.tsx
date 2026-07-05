'use client';

import { Activity, Box, Cpu, Lightbulb, Link2, Settings, Wifi, Zap } from 'lucide-react';

const categories = [
  { name: 'Microcontrollers', icon: Cpu },
  { name: 'Sensors', icon: Activity },
  { name: 'Power Supply', icon: Zap },
  { name: 'Connectors', icon: Link2 },
  { name: 'Industrial Automation', icon: Settings },
  { name: 'IoT & Wireless', icon: Wifi },
  { name: 'Optoelectronics', icon: Lightbulb },
  { name: 'Passive Components', icon: Box },
];

export default function CategoriesSection() {
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
            const Icon = category.icon;
            return (
              <article key={category.name} className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm hover:border-blue-200 hover:shadow-md">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <Icon size={28} aria-hidden="true" />
                </div>
                <h3 className="text-base font-bold text-slate-950">{category.name}</h3>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
