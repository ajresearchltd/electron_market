import type { ReactNode } from 'react';
import type { PublicProduct } from '../../../lib/product-listings';
import ListingHeader from './ListingHeader';
import ProductCard from './ProductCard';

type User = { email: string; companyName: string; avatarUrl: string | null } | null;
export default function ProductListingPage({ title, products, emptyMessage, user, summary }: { title: string; products: PublicProduct[]; emptyMessage: string; user: User; summary?: ReactNode }) {
  return <main className="min-h-screen bg-slate-50 pt-16 text-slate-950"><ListingHeader title={title} user={user} /><div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{summary}<div className="mb-5 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-blue-600">Electron Market</p><h2 className="mt-2 text-3xl font-bold">{title}</h2></div><p className="text-sm text-slate-500">{products.length} product{products.length === 1 ? '' : 's'}</p></div>{products.length ? <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{products.map(product => <ProductCard key={product.product_id} product={product} />)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center text-slate-600">{emptyMessage}</div>}</div></main>;
}
