'use client';

import { Star } from 'lucide-react';

// Mock suppliers data - will later map to verified_supplier table
const mockSuppliers = [
  {
    id: 1,
    name: 'Tech Electronics Ltd',
    country: '🇩🇪 Germany',
    rating: 4.8,
    products: '50K+',
  },
  {
    id: 2,
    name: 'Global Components Co',
    country: '🇨🇳 China',
    rating: 4.7,
    products: '120K+',
  },
  {
    id: 3,
    name: 'Euro Supply Group',
    country: '🇵🇱 Poland',
    rating: 4.9,
    products: '80K+',
  },
  {
    id: 4,
    name: 'Asia Pacific Dist',
    country: '🇹🇼 Taiwan',
    rating: 4.6,
    products: '95K+',
  },
];

export default function TopSuppliersSection() {
  return (
    <section id="suppliers" className="section section-dark">
      <div className="container-max">
        <h2 className="text-3xl md:text-4xl font-bold mb-2">Top Verified Suppliers</h2>
        <p className="text-gray-600 mb-12 max-w-2xl">
          Source directly from our network of certified suppliers worldwide.
        </p>

        {/* Suppliers Grid - Maps to: verified_supplier table */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {mockSuppliers.map((supplier) => (
            <div key={supplier.id} className="card p-6 hover:shadow-xl transition">
              <div className="h-20 bg-gradient-to-br from-blue-100 to-blue-50 rounded-lg mb-4 flex items-center justify-center text-gray-400 font-medium">
                Logo
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{supplier.name}</h3>
              <p className="text-gray-600 text-sm mb-4">{supplier.country}</p>
              <div className="flex items-center gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={16}
                    className={i < Math.floor(supplier.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                  />
                ))}
                <span className="text-sm font-bold text-gray-900 ml-2">{supplier.rating}</span>
              </div>
              <p className="text-sm text-gray-600 font-medium">{supplier.products} Products</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
