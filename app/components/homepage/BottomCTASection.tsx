'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

export default function BottomCTASection() {
  const router = useRouter();

  return (
    <section className="py-16 md:py-20 bg-blue-600 text-white">
      <div className="max-w-7xl mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to source smarter?</h2>
        <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
          Join thousands of buyers and start receiving quotes from verified suppliers within 24 hours.
        </p>

        {/* CTA Button - Maps to: section_12_submit_rfq */}
        <button
          onClick={() => router.push('/create-request')}
          className="bg-white text-blue-600 font-bold px-8 py-4 rounded-lg hover:bg-gray-100 transition inline-flex items-center gap-2 text-lg"
        >
          Upload BOM / Get Quotes
          <ArrowRight size={20} />
        </button>
      </div>
    </section>
  );
}
