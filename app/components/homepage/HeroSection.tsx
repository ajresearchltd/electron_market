'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

export default function HeroSection() {
  const router = useRouter();

  return (
    <section className="hero-gradient text-white py-16 md:py-24">
      <div className="container-max">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="max-w-xl">
            {/* Main Title */}
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Global Marketplace for <span className="hero-accent">Electronic Components</span> and Equipment
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-base text-blue-100 mb-10 leading-relaxed">
              Upload your BOM, get quotes from verified suppliers and source components faster and smarter.
            </p>

            {/* Call-to-Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <button
                onClick={() => router.push('/create-request')}
                className="bg-white text-blue-900 font-bold px-6 py-3 rounded-lg hover:bg-blue-50 transition flex items-center justify-center gap-2 shadow-lg"
              >
                Upload BOM / Get Quotes
                <ArrowRight size={18} />
              </button>
              <button
                onClick={() => router.push('/suppliers')}
                className="border-2 border-white text-white font-bold px-6 py-3 rounded-lg hover:bg-white/10 transition"
              >
                Find Suppliers
              </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-2 gap-8 pt-8 border-t border-blue-700/50">
              <div>
                <div className="text-3xl md:text-4xl font-bold">5,000+</div>
                <div className="text-blue-200 text-sm mt-1">Verified Suppliers</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold">200M+</div>
                <div className="text-blue-200 text-sm mt-1">Components</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold">150+</div>
                <div className="text-blue-200 text-sm mt-1">Countries</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold">24h</div>
                <div className="text-blue-200 text-sm mt-1">Avg Quote Time</div>
              </div>
            </div>
          </div>

          {/* Right Visual Area - CSS Gradient Cards */}
          <div className="hidden md:flex items-center justify-center">
            <div className="relative w-full h-96">
              {/* Floating Card 1 */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-2xl shadow-2xl transform rotate-12 opacity-90"></div>
              
              {/* Floating Card 2 */}
              <div className="absolute top-20 left-0 w-32 h-32 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-2xl shadow-2xl transform -rotate-6 opacity-80"></div>
              
              {/* Floating Card 3 */}
              <div className="absolute bottom-0 right-10 w-36 h-36 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-2xl transform rotate-3 opacity-85"></div>
              
              {/* Central Circuit Board Design */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64">
                <svg viewBox="0 0 200 200" className="w-full h-full opacity-50">
                  <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  <circle cx="100" cy="100" r="60" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  <circle cx="100" cy="100" r="40" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
                  <line x1="100" y1="20" x2="100" y2="180" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  <line x1="20" y1="100" x2="180" y2="100" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
