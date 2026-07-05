'use client';

const suppliers = [
  { name: 'TechCorp International', country: 'DE' },
  { name: 'Global Electronics Ltd', country: 'CN' },
  { name: 'European Components', country: 'IT' },
  { name: 'Asia Tech Distributors', country: 'KR' },
  { name: 'Middle East Supply Co', country: 'AE' },
  { name: 'Americas Electronics Group', country: 'BR' },
];

export default function OfficialSuppliersSection() {
  return (
    <section className="bg-slate-50 py-16 md:py-20">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">Official Suppliers and Manufacturers</h2>
          <p className="mt-4 text-base leading-7 text-slate-600 md:text-lg">
            Authorized distributors and manufacturers supporting verified sourcing requests.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((supplier) => (
            <article key={supplier.name} className="flex min-h-36 items-center gap-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-blue-200 hover:shadow-md">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-lg font-bold text-blue-700">
                {supplier.country}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-950">{supplier.name}</h3>
                <p className="mt-1 text-sm text-slate-500">Authorized marketplace partner</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
