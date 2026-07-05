'use client';

const steps = [
  { number: '01', title: 'Upload BOM', description: 'Submit your bill of materials and sourcing requirements.' },
  { number: '02', title: 'Smart Matching', description: 'Parts are matched with verified suppliers and alternatives.' },
  { number: '03', title: 'Receive Quotes', description: 'Compare supplier responses, lead times, and pricing.' },
  { number: '04', title: 'Order Confidently', description: 'Choose the best offer and move from RFQ to delivery.' },
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-slate-50 py-16 md:py-20">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">How it works</h2>
          <p className="mt-4 text-base leading-7 text-slate-600 md:text-lg">
            A simple workflow that gets buyers from part list to supplier quotes fast.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <article key={step.number} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-blue-200 hover:shadow-md">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                {step.number}
              </div>
              <h3 className="text-lg font-bold text-slate-950">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
