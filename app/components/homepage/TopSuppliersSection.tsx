'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadHomepageContent } from './homepageContent';

type Supplier = {
  slug: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  country: string | null;
  specialization: string | null;
};

const isImageUrl = (value: string | null) => Boolean(
  value && (value.startsWith('https://') || value.startsWith('http://') || value.startsWith('/'))
);

export default function TopSuppliersSection() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [title, setTitle] = useState('Top Verified Suppliers');
  const [description, setDescription] = useState('Source directly from certified suppliers with proven fulfillment history.');

  useEffect(() => {
    let active = true;
    fetch('/api/public/suppliers?scope=homepage')
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((body) => { if (active) setSuppliers(body.suppliers ?? []); })
      .catch(() => {});
    loadHomepageContent('section_10_title, section_10_description').then((row) => {
      if (!active || !row) return;
      setTitle(row.section_10_title || 'Top Verified Suppliers');
      setDescription(row.section_10_description || 'Source directly from certified suppliers with proven fulfillment history.');
    });
    return () => { active = false; };
  }, []);

  return (
    <section id="suppliers" className="bg-white py-8 md:py-10">
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {description}
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="min-w-0">
            <div className="category-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-4 touch-pan-x">
              {suppliers.map((supplier) => (
                <Link
                  href={`/suppliers/${encodeURIComponent(supplier.slug)}`}
                  key={supplier.slug}
                  className="group flex min-h-[338px] w-[210px] flex-[0_0_210px] snap-start flex-col overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-md transition hover:-translate-y-1 hover:border-blue-600 hover:bg-blue-600 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:w-[220px] sm:flex-[0_0_220px] lg:w-[calc((100%-2.25rem)/4)] lg:flex-[0_0_calc((100%-2.25rem)/4)]"
                >
                  <div className="flex h-32 w-full flex-none items-center justify-center bg-gradient-to-br from-blue-50 to-slate-50 text-2xl font-bold uppercase text-blue-700 ring-1 ring-inset ring-slate-100 group-hover:bg-white">
                    {isImageUrl(supplier.logoUrl) ? (
                      <img src={supplier.logoUrl!} alt="" className="h-full w-full object-contain p-4" />
                    ) : (
                      supplier.name.slice(0, 2)
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <span className="inline-flex w-fit rounded-full bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700 group-hover:bg-white/15 group-hover:text-white">
                      Verified
                    </span>
                    <h3 className="mt-3 line-clamp-2 text-base font-bold leading-5 text-slate-950 group-hover:text-white">
                      {supplier.name}
                    </h3>
                    {supplier.country && (
                      <p className="mt-1 text-sm text-slate-500 group-hover:text-blue-100">{supplier.country}</p>
                    )}
                    {(supplier.description || supplier.specialization) && (
                      <p className="mt-3 line-clamp-3 text-sm leading-5 text-slate-600 group-hover:text-blue-50">
                        {supplier.description || supplier.specialization}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            <Link href="/suppliers" className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm shadow-blue-900/10 hover:bg-blue-500">
              View all suppliers
            </Link>
          </div>

          <Link href="/suppliers" className="h-[338px] w-full max-w-[420px] justify-self-center overflow-hidden rounded-[20px] border border-slate-200 bg-[#061b3f] shadow-md shadow-blue-950/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 lg:w-[220px] lg:justify-self-end">
            <img src="/reference/veified_suppliers.png" alt="Top Verified Suppliers — view all verified suppliers" className="h-full w-full object-cover object-center" />
          </Link>
        </div>
      </div>
    </section>
  );
}
