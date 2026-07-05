'use client';

import { Truck, ClipboardCheck, DollarSign, Package } from 'lucide-react';

// Mock process steps - will later map to section_8_... fields
const processSteps = [
  {
    icon: ClipboardCheck,
    title: 'Request & Quote',
    description: 'Post your RFQ and receive quotes from verified suppliers',
  },
  {
    icon: DollarSign,
    title: 'Negotiate',
    description: 'Compare prices, terms, and negotiate the best deal',
  },
  {
    icon: Package,
    title: 'Order',
    description: 'Place your order and receive shipment confirmation',
  },
  {
    icon: Truck,
    title: 'Delivery',
    description: 'Track shipment and receive your components',
  },
];

export default function ProcessSection() {
  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">The Process: From Request to Delivery</h2>
        <p className="text-gray-600 mb-12 max-w-2xl">
          A streamlined sourcing workflow designed for efficiency.
        </p>

        {/* Process Steps - Maps to: section_8_... fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {processSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon size={32} className="text-blue-600" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-600 text-sm">{step.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
