'use client';

// Mock industry solutions - will later map to industry_solution table
const solutions = [
  {
    id: 1,
    title: 'Industrial Automation',
    description: 'PLCs, controllers, sensors, and automation components',
    icon: '🤖',
  },
  {
    id: 2,
    title: 'Smart Cities',
    description: 'IoT devices, connectivity solutions, and smart infrastructure',
    icon: '🏙️',
  },
  {
    id: 3,
    title: 'Renewable Energy',
    description: 'Solar inverters, charge controllers, and power management',
    icon: '⚡',
  },
  {
    id: 4,
    title: 'Medical Devices',
    description: 'Diagnostic equipment, monitoring systems, and biomedical components',
    icon: '🏥',
  },
  {
    id: 5,
    title: 'Automotive Electronics',
    description: 'Vehicle control systems, sensors, and communication modules',
    icon: '🚗',
  },
  {
    id: 6,
    title: 'Consumer Electronics',
    description: 'Smart home devices, wearables, and portable electronics',
    icon: '📱',
  },
];

export default function IndustrySolutionsSection() {
  return (
    <section className="py-16 md:py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Industry Solutions</h2>
        <p className="text-gray-600 mb-12 max-w-2xl">
          Specialized sourcing solutions for every industry vertical.
        </p>

        {/* Solutions Grid - Maps to: industry_solution table */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {solutions.map((solution) => (
            <div
              key={solution.id}
              className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg hover:border-blue-300 transition cursor-pointer"
            >
              <div className="text-4xl mb-3">{solution.icon}</div>
              <h3 className="font-bold text-gray-900 mb-2">{solution.title}</h3>
              <p className="text-gray-600 text-sm">{solution.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
