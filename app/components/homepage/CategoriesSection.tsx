'use client';

// Mock categories data - will later map to category table
const mockCategories = [
  { id: 1, name: 'Microcontrollers', icon: '🔌' },
  { id: 2, name: 'Sensors', icon: '📊' },
  { id: 3, name: 'Power Supply', icon: '⚡' },
  { id: 4, name: 'Connectors', icon: '🔗' },
  { id: 5, name: 'Industrial Automation', icon: '🤖' },
  { id: 6, name: 'IoT & Wireless', icon: '📡' },
  { id: 7, name: 'Optoelectronics', icon: '💡' },
  { id: 8, name: 'Passive Components', icon: '🔸' },
];

export default function CategoriesSection() {
  return (
    <section id="categories" className="section bg-white">
      <div className="container-max">
        <h2 className="text-3xl md:text-4xl font-bold mb-2">Shop by Categories</h2>
        <p className="text-gray-600 mb-12 max-w-2xl">
          Explore our extensive collection of electronic components across all major categories.
        </p>

        {/* Categories Grid - Maps to: category table + section_2_... fields */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {mockCategories.map((category) => (
            <div
              key={category.id}
              className="card p-6 hover:shadow-lg transition cursor-pointer bg-gradient-to-br from-white to-blue-50"
            >
              <div className="h-16 flex items-center justify-center mb-4">
                <span className="text-4xl">{category.icon}</span>
              </div>
              <h3 className="font-bold text-gray-900 text-center text-sm md:text-base">{category.name}</h3>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
