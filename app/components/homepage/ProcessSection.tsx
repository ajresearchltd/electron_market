'use client';

import { ClipboardCheck, DollarSign, Package, Truck } from 'lucide-react';

const steps = [
  { title: 'Request & Quote', description: 'Post your RFQ and receive quotes from verified suppliers.', icon: ClipboardCheck },
  { title: 'Negotiate', description: 'Compare prices, terms, and negotiate the best deal.', icon: DollarSign },
  { title: 'Order', description: 'Place your order and receive shipment confirmation.', icon: Package },
  { title: 'Delivery', description: 'Track shipment and receive your components.', icon: Truck },
];

export default function ProcessSection() {
  return (
    <section className="bg-white py-16 md:py-20">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">The Process: From Request to Delivery</h2>
          <p className="mt-4 text-base leading-7 text-slate-600 md:text-lg">
            A practical workflow for moving from sourcing intent to delivered components.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <article key={step.title} className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm hover:border-blue-200 hover:shadow-md">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <Icon size={28} aria-hidden="true" />
                </div>
                <div className="mx-auto mb-4 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{index + 1}</div>
                <h3 className="text-lg font-bold text-slate-950">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
