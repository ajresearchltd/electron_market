'use client';

const rfqs = [
  { title: 'STM32L476 Microcontroller - 5000 pcs', category: 'Microcontrollers', quantity: '5,000', responses: 8, createdAt: '2 hours ago' },
  { title: 'HDMI Connectors Type-C - 10000 pcs', category: 'Connectors', quantity: '10,000', responses: 12, createdAt: '4 hours ago' },
  { title: 'Industrial Temperature Sensors', category: 'Sensors', quantity: '3,500', responses: 5, createdAt: '1 day ago' },
  { title: '5V/10A Power Supply Module', category: 'Power Supply', quantity: '2,000', responses: 15, createdAt: '2 days ago' },
];

export default function RecentRFQSection() {
  return (
    <section className="bg-slate-50 py-16 md:py-20">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">Recent RFQ Requests</h2>
          <p className="mt-4 text-base leading-7 text-slate-600 md:text-lg">
            See the types of sourcing requests flowing through the marketplace.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="border-b border-slate-200 bg-blue-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">Request Title</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">Category</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">Quantity</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">Responses</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rfqs.map((rfq) => (
                  <tr key={rfq.title} className="hover:bg-blue-50/60">
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">{rfq.title}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{rfq.category}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{rfq.quantity}</td>
                    <td className="px-6 py-4"><span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">{rfq.responses}</span></td>
                    <td className="px-6 py-4 text-sm text-slate-600">{rfq.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
