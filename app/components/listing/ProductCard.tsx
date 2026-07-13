import type { PublicProduct } from '../../../lib/product-listings';

export default function ProductCard({ product }: { product: PublicProduct }) {
  return <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="relative aspect-[4/3] bg-slate-100">
      {product.main_image_url ? <img src={product.main_image_url} alt={product.product_name} className="h-full w-full object-contain p-4" /> : <div className="flex h-full items-center justify-center text-sm text-slate-400">No image</div>}
    </div>
    <div className="p-4">
      {product.category && <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{product.category}</p>}
      <h2 className="mt-1 line-clamp-2 text-lg font-bold text-slate-950">{product.product_name}</h2>
      {(product.brand_manufacturer || product.part_number_mpn) && <p className="mt-1 text-sm text-slate-500">{[product.brand_manufacturer, product.part_number_mpn].filter(Boolean).join(' · ')}</p>}
      {product.short_description && <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{product.short_description}</p>}
      <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
        <div>{product.base_price != null && <p className="font-bold text-slate-950">{product.base_currency || ''} {product.base_price}</p>}{product.moq_quantity != null && <p className="text-xs text-slate-500">MOQ {product.moq_quantity} {product.moq_unit || ''}</p>}</div>
        {product.availability && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{product.availability.replaceAll('_', ' ')}</span>}
      </div>
    </div>
  </article>;
}
