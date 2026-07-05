'use client';

import { Check } from 'lucide-react';

// Mock benefits data - will later map to section_5_... fields
const benefits = [
  { id: 1, title: 'Fast Quotes', description: 'Average response in 24 hours' },
  { id: 2, title: 'Verified Suppliers', description: 'All suppliers thoroughly vetted' },
  { id: 3, title: 'Best Pricing', description: 'Compare prices from multiple suppliers' },
  { id: 4, title: 'Quality Assured', description: 'Certification and compliance guaranteed' },
  { id: 5, title: 'Global Reach', description: 'Suppliers in 150+ countries' },
  { id: 6, title: '24/7 Support', description: 'Round-the-clock customer support' },
];

export default function WhyBuyersSection() {
  return (
    <section className="section bg-white">
      <div className="container-max">
        <h2 className="text-3xl md:text-4xl font-bold mb-2">Why buyers choose ElectroMarket</h2>
        <p className="text-gray-600 mb-12 max-w-2xl">
          Join thousands of procurement professionals who trust our platform.
        </p>

        {/* Benefits Grid - Maps to: section_5_... fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {benefits.map((benefit) => (
            <div key={benefit.id} className="flex gap-4">
              <Check size={24} className="text-green-500 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-gray-900 mb-1">{benefit.title}</h3>
                <p className="text-gray-600 text-sm">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
