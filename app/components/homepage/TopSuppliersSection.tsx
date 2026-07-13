'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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

const isImagePath = (value: string) => {
  return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/');
};

export default function TopSuppliersSection() {
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);

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
          console.warn('Top Verified Suppliers query failed.', error.message);
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
    <section id="suppliers" className="bg-white py-8 md:py-10">
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8">
        <div className="mb-5">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950">Top Verified Suppliers</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Source directly from certified suppliers with proven fulfillment history.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {suppliers.map((supplier) => {
                const name = supplier.name || 'Verified Supplier';
                const pic = supplier.pic?.trim();
                const supplierId = String(supplier.supplier_id ?? '').trim();
                if (!supplierId) return null;

                return (
                  <Link href={`/suppliers/${encodeURIComponent(supplierId)}`} key={supplierId} className="group flex min-h-[118px] cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all duration-200 hover:border-blue-600 hover:bg-blue-600 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
                    <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-blue-50 to-slate-50 text-sm font-bold uppercase tracking-wide text-blue-700 ring-1 ring-slate-100 transition-colors duration-200 group-hover:bg-white group-hover:from-white group-hover:to-white">
                      {pic && isImagePath(pic) ? (
                        <img src={pic} alt="" className="h-full w-full object-contain p-2" />
                      ) : (
                        pic || name.slice(0, 2)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-bold text-slate-950 transition-colors duration-200 group-hover:text-white">{name}</h3>
                      {supplier.country && <p className="mt-1 text-xs text-slate-500 transition-colors duration-200 group-hover:text-blue-100">{supplier.country}</p>}
                      {supplier.rating && (
                        <div className="mt-2 flex items-center gap-1">
                          {[...Array(5)].map((_, index) => (
                            <Star key={index} size={12} className={index < Math.floor(supplier.rating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'} />
                          ))}
                          <span className="ml-1 text-xs font-bold text-slate-900 group-hover:text-white">{supplier.rating}</span>
                        </div>
                      )}
                      {supplier.delivery_product && <p className="mt-2 line-clamp-2 text-xs font-medium leading-4 text-slate-600 group-hover:text-blue-50">{supplier.delivery_product}</p>}
                      {supplier.products && <p className="mt-2 text-xs font-medium text-slate-600 group-hover:text-blue-100">{supplier.products} Products</p>}
                    </div>
                  </Link>
                );
              })}
            </div>

            <a href="#suppliers" className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm shadow-blue-900/10 hover:bg-blue-500">
              View all suppliers
            </a>
          </div>

          <aside className="flex h-[300px] max-w-[420px] items-center justify-center justify-self-center overflow-hidden rounded-2xl border border-blue-100 bg-[#f4f8ff] p-4 shadow-md shadow-blue-950/5 lg:justify-self-end">
            <img src="/reference/ver_pro.png" alt="Top verified suppliers" className="max-h-full w-full rounded-xl object-contain" />
          </aside>
        </div>
      </div>
    </section>
  );
}
