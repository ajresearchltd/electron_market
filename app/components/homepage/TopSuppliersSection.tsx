'use client';

import { Star } from 'lucide-react';

const suppliers = [
  { name: 'Tech Electronics Ltd', country: 'Germany', rating: 4.8, products: '50K+' },
  { name: 'Global Components Co', country: 'China', rating: 4.7, products: '120K+' },
  { name: 'Euro Supply Group', country: 'Poland', rating: 4.9, products: '80K+' },
  { name: 'Asia Pacific Dist', country: 'Taiwan', rating: 4.6, products: '95K+' },
];

export default function TopSuppliersSection() {
  return (
    <section id="suppliers" className="bg-white py-16 md:py-20">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">Top Verified Suppliers</h2>
          <p className="mt-4 text-base leading-7 text-slate-600 md:text-lg">
            Source directly from certified suppliers with proven fulfillment history.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {suppliers.map((supplier) => (
            <article key={supplier.name} className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-blue-200 hover:shadow-md">
              <div className="mb-5 flex h-20 items-center justify-center rounded-lg bg-gradient-to-br from-blue-50 to-slate-50 text-sm font-bold uppercase tracking-wide text-blue-700">
                {supplier.name.slice(0, 2)}
              </div>
              <h3 className="text-base font-bold text-slate-950">{supplier.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{supplier.country}</p>
              <div className="mt-4 flex items-center gap-1">
                {[...Array(5)].map((_, index) => (
                  <Star key={index} size={16} className={index < Math.floor(supplier.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'} />
                ))}
                <span className="ml-2 text-sm font-bold text-slate-900">{supplier.rating}</span>
              </div>
              <p className="mt-3 text-sm font-medium text-slate-600">{supplier.products} Products</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
