'use client';

import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SuppliersNetworkSection() {
  const router = useRouter();

  return (
    <section className="py-16 md:py-20 bg-gradient-to-r from-blue-600 to-blue-800 text-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">For Suppliers: Join Our Network</h2>
          <p className="text-blue-100 mb-8 text-lg">
            Connect with buyers globally and grow your business. Gain access to 50,000+ sourcing opportunities monthly.
          </p>

          {/* Key Points - Maps to: section_6_... fields */}
          <ul className="space-y-3 mb-8">
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <span>Direct access to verified buyers</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <span>Automate quote generation</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <span>Zero commission on first 100 quotes</span>
            </li>
          </ul>

          <button
            onClick={() => router.push('/signup?type=supplier')}
            className="bg-white text-blue-600 font-bold px-6 py-3 rounded-lg hover:bg-gray-100 transition flex items-center gap-2"
          >
            Become a Supplier
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
