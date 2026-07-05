'use client';

// Mock numbers - will later map to section_11_... fields
const numbers = [
  { label: 'Active Suppliers', value: '5,000+', icon: '🏢' },
  { label: 'Components Listed', value: '200M+', icon: '📦' },
  { label: 'Countries Served', value: '150+', icon: '🌍' },
  { label: 'Avg Quote Time', value: '24h', icon: '⏱️' },
];

export default function NumbersSection() {
  return (
    <section className="py-16 md:py-20 bg-gradient-to-br from-slate-900 to-blue-900 text-white">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-center">ElectroMarket in Numbers</h2>
        <p className="text-blue-100 mb-12 max-w-2xl mx-auto text-center">
          The scale and reach of our global marketplace.
        </p>

        {/* Numbers Grid - Maps to: section_11_... fields */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {numbers.map((item, index) => (
            <div key={index} className="text-center">
              <div className="text-4xl mb-2">{item.icon}</div>
              <div className="text-4xl md:text-5xl font-bold mb-2">{item.value}</div>
              <p className="text-blue-100">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
