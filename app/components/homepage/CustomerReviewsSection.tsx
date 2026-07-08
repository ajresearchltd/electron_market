'use client';

import { Star } from 'lucide-react';

const reviews = [
  { name: 'John Chen', company: 'TechStart Industries', rating: 5, text: 'ElectroMarket saved us weeks of sourcing time and helped compare supplier options clearly.', initials: 'JC' },
  { name: 'Maria Garcia', company: 'Innovation Labs', rating: 5, text: 'The RFQ process is fast, organized, and much easier than emailing suppliers one by one.', initials: 'MG' },
  { name: 'Ahmed Hassan', company: 'Middle East Electronics', rating: 5, text: 'Reliable suppliers, transparent communication, and useful quote comparisons.', initials: 'AH' },
  { name: 'Sophie Dubois', company: 'European Manufacturing', rating: 4, text: 'A practical platform for component sourcing when timelines are tight.', initials: 'SD' },
];

export default function CustomerReviewsSection() {
  return (
    <section className="bg-white py-8 md:py-10">
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8">
        <div className="mb-5 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">What Our Customers Say</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Procurement teams use ElectroMarket to simplify sourcing and supplier comparison.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {reviews.map((review) => (
            <article key={review.name} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-200 hover:shadow-md">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                  {review.initials}
                </div>
                <div>
                  <h3 className="font-bold text-slate-950">{review.name}</h3>
                  <p className="text-sm text-slate-500">{review.company}</p>
                </div>
              </div>
              <div className="mb-3 flex gap-1">
                {[...Array(5)].map((_, index) => (
                  <Star key={index} size={16} className={index < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'} />
                ))}
              </div>
              <p className="text-sm leading-6 text-slate-700">"{review.text}"</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
