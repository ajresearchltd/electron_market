'use client';

import { Building2, Car, Factory, HeartPulse, RadioTower, Zap } from 'lucide-react';

const solutions = [
  { title: 'Industrial Automation', description: 'PLCs, controllers, sensors, and automation components.', icon: Factory },
  { title: 'Smart Cities', description: 'IoT devices, connectivity solutions, and smart infrastructure.', icon: Building2 },
  { title: 'Renewable Energy', description: 'Solar inverters, charge controllers, and power management.', icon: Zap },
  { title: 'Medical Devices', description: 'Diagnostic equipment, monitoring systems, and biomedical components.', icon: HeartPulse },
  { title: 'Automotive Electronics', description: 'Vehicle control systems, sensors, and communication modules.', icon: Car },
  { title: 'Consumer Electronics', description: 'Smart home devices, wearables, and portable electronics.', icon: RadioTower },
];

export default function IndustrySolutionsSection() {
  return (
    <section className="bg-slate-50 py-16 md:py-20">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">Industry Solutions</h2>
          <p className="mt-4 text-base leading-7 text-slate-600 md:text-lg">
            Specialized sourcing support for component-heavy industries.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {solutions.map((solution) => {
            const Icon = solution.icon;
            return (
              <article key={solution.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-blue-200 hover:shadow-md">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Icon size={28} aria-hidden="true" />
                </div>
                <h3 className="text-lg font-bold text-slate-950">{solution.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{solution.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
