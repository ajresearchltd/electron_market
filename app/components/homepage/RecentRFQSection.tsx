'use client';

// Mock RFQ data - will later map to rfq table
const mockRFQs = [
  {
    id: 1,
    title: 'STM32L476 Microcontroller - 5000 pcs',
    category: 'Microcontrollers',
    quantity: '5,000',
    responses: 8,
    createdAt: '2 hours ago',
  },
  {
    id: 2,
    title: 'HDMI Connectors Type-C - 10000 pcs',
    category: 'Connectors',
    quantity: '10,000',
    responses: 12,
    createdAt: '4 hours ago',
  },
  {
    id: 3,
    title: 'Industrial Temperature Sensors',
    category: 'Sensors',
    quantity: '3,500',
    responses: 5,
    createdAt: '1 day ago',
  },
  {
    id: 4,
    title: '5V/10A Power Supply Module',
    category: 'Power Supply',
    quantity: '2,000',
    responses: 15,
    createdAt: '2 days ago',
  },
];

export default function RecentRFQSection() {
  return (
    <section className="section section-dark">
      <div className="container-max">
        <h2 className="text-3xl md:text-4xl font-bold mb-2">Recent RFQ Requests</h2>
        <p className="text-gray-600 mb-12 max-w-2xl">
          See what other buyers are requesting and find potential opportunities.
        </p>

        {/* RFQ Table - Maps to: rfq table */}
        <div className="overflow-x-auto">
          <table className="w-full bg-white rounded-lg overflow-hidden shadow-md">
            <thead className="bg-blue-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left font-bold text-gray-900">Request Title</th>
                <th className="px-6 py-4 text-left font-bold text-gray-900">Category</th>
                <th className="px-6 py-4 text-left font-bold text-gray-900">Quantity</th>
                <th className="px-6 py-4 text-left font-bold text-gray-900">Responses</th>
                <th className="px-6 py-4 text-left font-bold text-gray-900">Created</th>
              </tr>
            </thead>
            <tbody>
              {mockRFQs.map((rfq, idx) => (
                <tr key={rfq.id} className={`border-b border-gray-100 hover:bg-blue-50 transition ${idx === mockRFQs.length - 1 ? '' : ''}`}>
                  <td className="px-6 py-4 font-medium text-gray-900">{rfq.title}</td>
                  <td className="px-6 py-4 text-gray-600">{rfq.category}</td>
                  <td className="px-6 py-4 text-gray-600">{rfq.quantity}</td>
                  <td className="px-6 py-4">
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                      {rfq.responses}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{rfq.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
