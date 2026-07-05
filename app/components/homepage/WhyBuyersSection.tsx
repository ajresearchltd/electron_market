'use client';

import { CheckCircle, Globe2, Headphones, ShieldCheck, Timer } from 'lucide-react';

const benefits = [
  { title: 'Fast Quotes', description: 'Average supplier responses within 24 hours.', icon: Timer },
  { title: 'Verified Suppliers', description: 'Supplier profiles are reviewed for marketplace quality.', icon: ShieldCheck },
  { title: 'Quality Assured', description: 'Source from partners with documentation and compliance support.', icon: CheckCircle },
  { title: 'Global Reach', description: 'Access sourcing options across 150+ countries.', icon: Globe2 },
  { title: '24/7 Support', description: 'Help for urgent RFQs and supplier coordination.', icon: Headphones },
  { title: 'Better Comparisons', description: 'Compare pricing, lead times, and terms in one workflow.', icon: CheckCircle },
];

export default function WhyBuyersSection() {
  return (
    <section className="bg-white py-16 md:py-20">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">Why buyers choose ElectroMarket</h2>
          <p className="mt-4 text-base leading-7 text-slate-600 md:text-lg">
            Procurement teams get trusted suppliers, broad coverage, and clean sourcing workflows.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <article key={benefit.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-blue-200 hover:shadow-md">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <Icon size={24} aria-hidden="true" />
                </div>
                <h3 className="text-lg font-bold text-slate-950">{benefit.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{benefit.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
