'use client';

import { CheckCircle, Brain } from 'lucide-react';

// Mock process steps - will later map to section_3_... and section_4_... fields
const steps = [
  { id: 1, title: 'Upload BOM', description: 'Submit your bill of materials' },
  { id: 2, title: 'AI Analysis', description: 'Smart component matching' },
  { id: 3, title: 'Suppliers Quote', description: 'Instant supplier responses' },
  { id: 4, title: 'Compare & Order', description: 'Select best offers' },
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-16 md:py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">How it works</h2>
        <p className="text-gray-600 mb-12 max-w-2xl">
          Our streamlined process gets you quotes in hours, not days.
        </p>

        <div className="grid md:grid-cols-3 gap-12">
          {/* Steps - Maps to: section_3_... and section_4_... fields */}
          <div className="md:col-span-2">
            <div className="space-y-8">
              {steps.map((step, index) => (
                <div key={step.id} className="flex gap-6">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                      {step.id}
                    </div>
                    {index < steps.length - 1 && (
                      <div className="w-1 h-16 bg-blue-200 mt-2"></div>
                    )}
                  </div>
                  <div className="pt-1">
                    <h3 className="text-xl font-bold text-gray-900">{step.title}</h3>
                    <p className="text-gray-600 mt-1">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI-Powered Card */}
          <div className="md:col-span-1">
            <div className="bg-white p-8 rounded-lg border-2 border-blue-600 h-full flex flex-col justify-center">
              <Brain size={40} className="text-blue-600 mb-4" />
              <h3 className="text-2xl font-bold mb-2">AI-Powered</h3>
              <p className="text-gray-600">
                BOM Analysis with instant supplier matching
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
