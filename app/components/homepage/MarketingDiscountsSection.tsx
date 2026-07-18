'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '../../../lib/supabase/client';

type MarketingDiscount = {
  id: string;
  company_name: string | null;
  title: string;
  subtitle: string | null;
  image_url: string;
  discount_text: string;
  sort_order: number;
};

export default function MarketingDiscountsSection() {
  const [discounts, setDiscounts] = useState<MarketingDiscount[]>([]);

  useEffect(() => {
    let active = true;

    const loadDiscounts = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('homepage_marketing_discounts')
        .select('id, company_name, title, subtitle, image_url, discount_text, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(5);

      if (!active) {
        return;
      }

      if (error || !data || data.length === 0) {
        if (error) {
          console.warn('Marketing discounts fallback active. Supabase select failed for homepage_marketing_discounts.', error.message);
        }
        return;
      }

      setDiscounts(data.slice(0, 5));
    };

    loadDiscounts();

    return () => {
      active = false;
    };
  }, []);

  return (
    <section id="special-offers" className="bg-[#f5f8fc] py-9 md:py-12">
      <div className="mx-auto w-full max-w-[1472px] px-4 sm:px-6 lg:px-8">
        <div className="mb-6 text-center">
          <h2 className="text-[1.625rem] font-bold tracking-tight text-slate-950">Special Offers</h2>
          <p className="mx-auto mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Featured discounts and promotional component offers
          </p>
        </div>

        <div className="mx-auto grid w-full grid-cols-1 justify-items-center gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {discounts.map((item) => (
            <Link href={`/special-offers/${encodeURIComponent(item.id)}`} key={item.id} className="group block h-full w-full max-w-[260px]">
            <article className="flex min-h-[368px] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:border-blue-200 hover:shadow-md">
              <div className="relative h-[260px] flex-none overflow-hidden bg-slate-950">
                <img src={item.image_url} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                <div className="absolute right-[-42px] top-7 w-[9.5rem] rotate-45 bg-yellow-400 py-1.5 text-center text-xs font-black uppercase tracking-wide text-slate-950 shadow-md">
                  {item.discount_text}
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col px-[18px] pb-3 pt-[18px]">
                {item.company_name && <p className="mb-1.5 line-clamp-1 text-xs font-semibold uppercase tracking-wide text-blue-600">{item.company_name}</p>}
                <h3 className="break-words text-lg font-bold text-slate-950">{item.title}</h3>
                {item.subtitle && <p className="mt-1.5 break-words text-sm leading-6 text-slate-600">{item.subtitle}</p>}
              </div>
            </article></Link>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <Link href="/special-offers" className="inline-flex rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
            All special offer now
          </Link>
        </div>
      </div>
    </section>
  );
}
