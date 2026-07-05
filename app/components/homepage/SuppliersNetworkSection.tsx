'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle } from 'lucide-react';

const points = ['Direct access to verified buyers', 'Automate quote generation', 'Zero commission on first 100 quotes'];

export default function SuppliersNetworkSection() {
  return (
    <section className="bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 py-16 text-white md:py-20">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">For Suppliers: Join Our Network</h2>
            <p className="mt-4 text-lg leading-8 text-blue-100">
              Connect with buyers globally and grow your business with access to high-intent sourcing opportunities.
            </p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {points.map((point) => (
                <li key={point} className="flex items-center gap-3 text-sm font-medium text-blue-50">
                  <CheckCircle size={18} className="shrink-0 text-cyan-300" aria-hidden="true" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            <Link href="/signup?type=supplier" className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-md bg-white px-6 text-base font-bold text-blue-700 shadow-lg shadow-blue-950/20 hover:bg-blue-50">
              Become a Supplier
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-6 shadow-2xl shadow-blue-950/25 backdrop-blur">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-white/10 p-5">
                <div className="text-3xl font-bold text-white">50K+</div>
                <p className="mt-1 text-sm text-blue-100">Monthly opportunities</p>
              </div>
              <div className="rounded-xl bg-white/10 p-5">
                <div className="text-3xl font-bold text-white">150+</div>
                <p className="mt-1 text-sm text-blue-100">Buyer countries</p>
              </div>
              <div className="col-span-2 rounded-xl bg-white p-5 text-slate-900">
                <p className="text-sm font-semibold text-blue-700">Supplier growth channel</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Receive RFQs, quote faster, and build long-term buyer relationships from one marketplace profile.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
