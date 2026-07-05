'use client';

import { Building2, Clock3, Globe2, Package } from 'lucide-react';

const numbers = [
  { label: 'Active Suppliers', value: '5,000+', icon: Building2 },
  { label: 'Components Listed', value: '200M+', icon: Package },
  { label: 'Countries Served', value: '150+', icon: Globe2 },
  { label: 'Avg Quote Time', value: '24h', icon: Clock3 },
];

export default function NumbersSection() {
  return (
    <section className="bg-gradient-to-br from-slate-900 to-blue-900 py-16 text-white md:py-20">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">ElectroMarket in Numbers</h2>
          <p className="mt-4 text-base leading-7 text-blue-100 md:text-lg">
            The scale and reach behind our global component marketplace.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {numbers.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label} className="rounded-xl border border-white/10 bg-white/10 p-6 text-center shadow-lg shadow-blue-950/20">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-cyan-300">
                  <Icon size={24} aria-hidden="true" />
                </div>
                <div className="text-4xl font-bold text-white md:text-5xl">{item.value}</div>
                <p className="mt-2 text-sm font-medium text-blue-100">{item.label}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
