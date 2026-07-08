'use client';

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

const fallbackDiscounts: MarketingDiscount[] = [
  { id: 'fallback-1', company_name: 'ElectroMarket Deals', title: 'Microcontrollers', subtitle: 'Bulk MCU sourcing deals', image_url: '/reference/ai_bom.png', discount_text: '15% OFF', sort_order: 1 },
  { id: 'fallback-2', company_name: 'Power Partner', title: 'Power Modules', subtitle: 'Compact power solutions', image_url: '/reference/friz_1.jpg', discount_text: '20% OFF', sort_order: 2 },
  { id: 'fallback-3', company_name: 'Sensor Hub', title: 'Sensors', subtitle: 'Motion and monitoring parts', image_url: '/reference/ver_pro.png', discount_text: '10% OFF', sort_order: 3 },
  { id: 'fallback-4', company_name: 'Connector Source', title: 'Connectors', subtitle: 'Board and cable inventory', image_url: '/reference/friz_1.jpg', discount_text: '25% OFF', sort_order: 4 },
  { id: 'fallback-5', company_name: 'Industrial Supply', title: 'Industrial Boards', subtitle: 'Factory-ready controller stock', image_url: '/reference/ai_bom.png', discount_text: '12% OFF', sort_order: 5 },
  { id: 'fallback-6', company_name: 'Wireless Lab', title: 'Wireless Modules', subtitle: 'IoT and RF component offers', image_url: '/reference/ver_pro.png', discount_text: '18% OFF', sort_order: 6 },
];

export default function MarketingDiscountsSection() {
  const [discounts, setDiscounts] = useState<MarketingDiscount[]>(fallbackDiscounts);

  useEffect(() => {
    let active = true;

    const loadDiscounts = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('homepage_marketing_discounts')
        .select('id, company_name, title, subtitle, image_url, discount_text, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(6);

      if (!active) {
        return;
      }

      if (error || !data || data.length === 0) {
        if (error) {
          console.warn('Marketing discounts fallback active. Supabase select failed for homepage_marketing_discounts.', error.message);
        }
        return;
      }

      setDiscounts(data);
    };

    loadDiscounts();

    return () => {
      active = false;
    };
  }, []);

  return (
    <section id="special-offers" className="bg-[#f5f8fc] py-8 md:py-10">
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8">
        <div className="mb-5">
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">Special Offers</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Featured discounts and promotional component offers
          </p>
        </div>

        <div className="mx-auto flex max-w-[1120px] flex-wrap justify-center gap-3">
          {discounts.map((item) => (
            <article key={item.id} className="group w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm hover:border-blue-200 hover:shadow-md sm:w-[calc(50%-0.375rem)] lg:w-[calc(33.333%-0.5rem)] xl:w-[174px]">
              <div className="relative aspect-square overflow-hidden bg-slate-950">
                <img src={item.image_url} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                <div className="absolute right-[-38px] top-5 w-32 rotate-45 bg-yellow-400 py-1 text-center text-[11px] font-black uppercase tracking-wide text-slate-950 shadow-md">
                  {item.discount_text}
                </div>
              </div>
              <div className="p-3">
                {item.company_name && <p className="mb-1 line-clamp-1 text-[11px] font-semibold uppercase tracking-wide text-blue-600">{item.company_name}</p>}
                <h3 className="line-clamp-1 text-sm font-bold text-slate-950">{item.title}</h3>
                {item.subtitle && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{item.subtitle}</p>}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
