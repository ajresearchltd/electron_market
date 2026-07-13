'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '../../../lib/supabase/client';

type ProductRow = {
  product_id: string;
  product_name: string;
  sku_internal: string | null;
  part_number_mpn: string | null;
  base_price: number | null;
  base_currency: string | null;
  stock_quantity: number | null;
  product_status: string | null;
  status: string | null;
  is_active: boolean | null;
  created_date: string | null;
};

type SupplierProfileRow = {
  company_name: string | null;
  company_email: string | null;
};

const formatMoney = (amount: number | null, currency: string | null) => {
  if (amount === null || amount === undefined) return '-';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount);
  } catch {
    return `${currency || 'USD'} ${amount}`;
  }
};

const formatDate = (value: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(date);
};

const humanize = (value: string | null | undefined) => value ? value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) : '-';

export default function SupplierProductsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const loadProducts = async () => {
      setLoading(true);
      setError('');

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !authData.user) {
        setError('You must be signed in as a supplier to view products.');
        setProducts([]);
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('supplier_company_profiles')
        .select('company_name, company_email')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      const supplierProfile = profile as SupplierProfileRow | null;
      const supplierEmail = supplierProfile?.company_email || authData.user.email || '';
      const companyName = supplierProfile?.company_name || '';
      let supplierId = '';

      if (supplierEmail) {
        const { data: supplierByContact } = await supabase.from('suppliers').select('supplier_id').eq('contact_email', supplierEmail).maybeSingle();
        supplierId = supplierByContact?.supplier_id || '';
      }

      if (!supplierId && companyName) {
        const { data: supplierByCompany } = await supabase.from('suppliers').select('supplier_id').eq('company_name', companyName).maybeSingle();
        supplierId = supplierByCompany?.supplier_id || '';
      }

      if (!supplierId) {
        setProducts([]);
        setLoading(false);
        return;
      }

      const { data, error: queryError } = await supabase
        .from('products')
        .select('product_id, product_name, sku_internal, part_number_mpn, base_price, base_currency, stock_quantity, product_status, status, is_active, created_date')
        .eq('supplier_id', supplierId)
        .order('created_date', { ascending: false });

      if (!active) return;
      if (queryError) {
        setError(queryError.message);
        setProducts([]);
      } else {
        setProducts((data ?? []) as ProductRow[]);
      }
      setLoading(false);
    };

    loadProducts();
    return () => {
      active = false;
    };
  }, [supabase]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 text-white lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">Electron Market Supplier</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">My Products</h1>
            <p className="mt-2 text-sm leading-6 text-blue-100">Review product listings connected to your supplier account.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/supplier/dashboard" className="site-button rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Back to Supply Hub</Link>
            <Link href="/supplier/products/new" className="site-button rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Add product</Link>
          </div>
        </div>

        <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-2xl">
          {loading && <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">Loading products...</div>}
          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {!loading && !error && products.length === 0 && <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">No products yet. Add your first product listing.</div>}

          {products.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-blue-600 text-white">
                  <tr>
                    {['Product Name', 'Part Number', 'Price', 'Stock', 'Status', 'Active', 'Created'].map((heading) => (
                      <th key={heading} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                  {products.map((product) => (
                    <tr key={product.product_id} className="hover:bg-blue-50">
                      <td className="px-4 py-3 font-semibold text-slate-950">{product.product_name}</td>
                      <td className="px-4 py-3">{product.sku_internal || product.part_number_mpn || '-'}</td>
                      <td className="px-4 py-3">{formatMoney(product.base_price, product.base_currency)}</td>
                      <td className="px-4 py-3">{product.stock_quantity ?? '-'}</td>
                      <td className="px-4 py-3">{humanize(product.status || product.product_status)}</td>
                      <td className="px-4 py-3">{product.is_active ? 'Yes' : 'No'}</td>
                      <td className="px-4 py-3">{formatDate(product.created_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
