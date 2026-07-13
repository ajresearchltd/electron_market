'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '../../lib/supabase/client';

type MarketingDiscount = {
  id: string;
  company_name: string | null;
  title: string;
  subtitle: string | null;
  image_url: string;
  discount_text: string;
  sort_order: number;
};

export default function SpecialOffersPage() {
  const [discounts, setDiscounts] = useState<MarketingDiscount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const loadDiscounts = async () => {
      setLoading(true);
      setError('');

      const supabase = createClient();
      const { data, error: queryError } = await supabase
        .from('homepage_marketing_discounts')
        .select('id, company_name, title, subtitle, image_url, discount_text, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (!active) return;

      if (queryError) {
        setError(queryError.message);
        setDiscounts([]);
      } else {
        setDiscounts((data ?? []) as MarketingDiscount[]);
      }

      setLoading(false);
    };

    loadDiscounts();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 text-white md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">Electron Market</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">All Special Offers</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">Browse active promotional component offers and discount goods.</p>
          </div>
          <Link href="/" className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Back to homepage
          </Link>
        </div>

        <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-xl">
          {loading && <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">Loading special offers...</div>}
          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {!loading && !error && discounts.length === 0 && <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">No special offers available.</div>}

          {discounts.length > 0 && (
            <div className="grid grid-cols-1 justify-items-center gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {discounts.map((item) => (
                <Link href={`/special-offers/${encodeURIComponent(item.id)}`} key={item.id} className="group block w-full max-w-[226px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:border-blue-200 hover:shadow-md">
                  <div className="relative aspect-square overflow-hidden bg-slate-950">
                    <img src={item.image_url} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    <div className="absolute right-[-42px] top-7 w-[9.5rem] rotate-45 bg-yellow-400 py-1.5 text-center text-xs font-black uppercase tracking-wide text-slate-950 shadow-md">
                      {item.discount_text}
                    </div>
                  </div>
                  <div className="p-4">
                    {item.company_name && <p className="mb-1.5 line-clamp-1 text-xs font-semibold uppercase tracking-wide text-blue-600">{item.company_name}</p>}
                    <h2 className="line-clamp-1 text-lg font-bold text-slate-950">{item.title}</h2>
                    {item.subtitle && <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-slate-600">{item.subtitle}</p>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
