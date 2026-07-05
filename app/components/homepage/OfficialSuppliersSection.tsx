'use client';

export default function OfficialSuppliersSection() {
  const suppliers = [
    { name: 'TechCorp International', country: '🇩🇪' },
    { name: 'Global Electronics Ltd', country: '🇨🇳' },
    { name: 'European Components', country: '🇮🇹' },
    { name: 'Asia Tech Distributors', country: '🇰🇷' },
    { name: 'Middle East Supply Co', country: '🇦🇪' },
    { name: 'Americas Electronics Group', country: '🇧🇷' },
  ];

  return (
    <section className="py-16 md:py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Official Suppliers and Manufacturers</h2>
        <p className="text-gray-600 mb-12 max-w-2xl">
          Authorized distributors and manufacturers of leading brands.
        </p>

        {/* Supplier Logos Grid - Maps to: section_7_... fields */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {suppliers.map((supplier, index) => (
            <div
              key={index}
              className="bg-white p-6 rounded-lg border border-gray-200 flex flex-col items-center justify-center h-32 hover:shadow-lg transition"
            >
              <div className="text-3xl mb-2">{supplier.country}</div>
              <p className="text-center text-sm font-medium text-gray-900">{supplier.name}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
