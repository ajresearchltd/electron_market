'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { createClient } from '../../../lib/supabase/client';

type SupplierRow = {
  supplier_id: string;
  name: string | null;
  pic: string | null;
  delivery_product: string | null;
  country?: string;
  rating?: number;
  products?: string;
};

const fallbackSuppliers: SupplierRow[] = [
  { supplier_id: 'fallback-1', name: 'Tech Electronics Ltd', pic: null, delivery_product: 'Industrial control modules and embedded components.', country: 'Germany', rating: 4.8, products: '50K+' },
  { supplier_id: 'fallback-2', name: 'Global Components Co', pic: null, delivery_product: 'Semiconductors, connectors, and passive components.', country: 'China', rating: 4.7, products: '120K+' },
  { supplier_id: 'fallback-3', name: 'Euro Supply Group', pic: null, delivery_product: 'Power electronics, sensors, and automation parts.', country: 'Poland', rating: 4.9, products: '80K+' },
  { supplier_id: 'fallback-4', name: 'Asia Pacific Dist', pic: null, delivery_product: 'Wireless modules, displays, and optoelectronics.', country: 'Taiwan', rating: 4.6, products: '95K+' },
];

const isImagePath = (value: string) => {
  return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/');
};

export default function TopSuppliersSection() {
  const [suppliers, setSuppliers] = useState<SupplierRow[]>(fallbackSuppliers);

  useEffect(() => {
    let active = true;

    const loadSuppliers = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('verified_supplier')
        .select('supplier_id, name, pic, delivery_product')
        .order('name', { ascending: true })
        .limit(4);

      if (!active) {
        return;
      }

      if (error || !data || data.length === 0) {
        if (error) {
          console.warn('Top Verified Suppliers fallback active. Supabase select failed for verified_supplier.', error.message);
        }
        return;
      }

      setSuppliers(data);
    };

    loadSuppliers();

    return () => {
      active = false;
    };
  }, []);

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
          {suppliers.map((supplier) => {
            const name = supplier.name || 'Verified Supplier';
            const pic = supplier.pic?.trim();

            return (
              <article key={supplier.supplier_id} className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-blue-200 hover:shadow-md">
                <div className="mb-5 flex h-20 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-blue-50 to-slate-50 text-sm font-bold uppercase tracking-wide text-blue-700">
                  {pic && isImagePath(pic) ? (
                    <img src={pic} alt="" className="h-16 w-16 object-contain" />
                  ) : (
                    pic || name.slice(0, 2)
                  )}
                </div>
                <h3 className="text-base font-bold text-slate-950">{name}</h3>
                {supplier.country && <p className="mt-1 text-sm text-slate-500">{supplier.country}</p>}
                {supplier.rating && (
                  <div className="mt-4 flex items-center gap-1">
                    {[...Array(5)].map((_, index) => (
                      <Star key={index} size={16} className={index < Math.floor(supplier.rating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'} />
                    ))}
                    <span className="ml-2 text-sm font-bold text-slate-900">{supplier.rating}</span>
                  </div>
                )}
                {supplier.delivery_product && <p className="mt-3 text-sm font-medium leading-6 text-slate-600">{supplier.delivery_product}</p>}
                {supplier.products && <p className="mt-3 text-sm font-medium text-slate-600">{supplier.products} Products</p>}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
