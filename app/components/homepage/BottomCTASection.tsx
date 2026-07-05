'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function BottomCTASection() {
  return (
    <section className="bg-blue-600 py-16 text-white md:py-20">
      <div className="mx-auto max-w-[1200px] px-4 text-center sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/15 bg-white/10 px-6 py-10 shadow-xl shadow-blue-900/20 md:px-10">
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">Ready to source smarter?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-blue-100">
            Upload your BOM and start receiving quotes from verified suppliers.
          </p>
          <Link href="/create-request" className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-md bg-white px-7 text-base font-bold text-blue-700 shadow-lg shadow-blue-950/20 hover:bg-blue-50">
            Upload BOM / Get Quotes
            <ArrowRight size={20} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
