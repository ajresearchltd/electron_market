'use client';

import { Star } from 'lucide-react';

// Mock customer reviews - will later map to customer_say table
const reviews = [
  {
    id: 1,
    name: 'John Chen',
    company: 'TechStart Industries',
    rating: 5,
    text: 'ElectroMarket saved us 40% on component sourcing. Highly recommended!',
    avatar: '👨‍💼',
  },
  {
    id: 2,
    name: 'Maria Garcia',
    company: 'Innovation Labs',
    rating: 5,
    text: 'The fastest quotes I\'ve ever received. Their supplier network is incredible.',
    avatar: '👩‍💼',
  },
  {
    id: 3,
    name: 'Ahmed Hassan',
    company: 'Middle East Electronics',
    rating: 5,
    text: 'Professional service, reliable suppliers, and transparent pricing. Perfect!',
    avatar: '👨‍💼',
  },
  {
    id: 4,
    name: 'Sophie Dubois',
    company: 'European Manufacturing',
    rating: 4,
    text: 'Great platform for finding quality components. Support team is very helpful.',
    avatar: '👩‍💼',
  },
];

export default function CustomerReviewsSection() {
  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Customer Reviews</h2>
        <p className="text-gray-600 mb-12 max-w-2xl">
          Hear from procurement professionals who use ElectroMarket daily.
        </p>

        {/* Reviews Grid - Maps to: customer_say table */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reviews.map((review) => (
            <div key={review.id} className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <div className="flex items-start gap-4 mb-4">
                <div className="text-4xl">{review.avatar}</div>
                <div>
                  <h3 className="font-bold text-gray-900">{review.name}</h3>
                  <p className="text-gray-600 text-sm">{review.company}</p>
                </div>
              </div>

              <div className="flex gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={16}
                    className={i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                  />
                ))}
              </div>

              <p className="text-gray-700">{review.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
