'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function Header() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 hero-gradient border-b border-blue-900/30">
      <div className="container-max">
        <div className="py-4 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="text-2xl font-bold text-white hover:text-blue-200 transition">
            ElectroMarket
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-blue-100 hover:text-white text-sm font-medium transition">
              How it works
            </a>
            <a href="#suppliers" className="text-blue-100 hover:text-white text-sm font-medium transition">
              Suppliers
            </a>
            <a href="#categories" className="text-blue-100 hover:text-white text-sm font-medium transition">
              Categories
            </a>
            <a href="#resources" className="text-blue-100 hover:text-white text-sm font-medium transition">
              Resources
            </a>
            <a href="#about" className="text-blue-100 hover:text-white text-sm font-medium transition">
              About us
            </a>
          </nav>

          {/* Right Actions */}
          <div className="hidden md:flex items-center gap-4">
            <select className="text-sm text-white bg-blue-800/40 border border-blue-700 rounded px-3 py-1.5 hover:bg-blue-800/60 transition">
              <option>EN</option>
              <option>ES</option>
              <option>FR</option>
            </select>
            <Link
              href="/login"
              className="text-sm font-medium text-blue-100 hover:text-white transition"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Sign up
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-white"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <nav className="md:hidden bg-blue-900/80 backdrop-blur border-t border-blue-800 p-4 space-y-4">
          <a href="#how-it-works" className="block text-blue-100 hover:text-white transition">
            How it works
          </a>
          <a href="#suppliers" className="block text-blue-100 hover:text-white transition">
            Suppliers
          </a>
          <a href="#categories" className="block text-blue-100 hover:text-white transition">
            Categories
          </a>
          <a href="#resources" className="block text-blue-100 hover:text-white transition">
            Resources
          </a>
          <a href="#about" className="block text-blue-100 hover:text-white transition">
            About us
          </a>
          <div className="flex gap-2 pt-2">
            <Link href="/login" className="flex-1 text-sm font-medium border border-blue-400 text-blue-100 px-4 py-2 rounded-lg text-center hover:bg-blue-800/50 transition">
              Log in
            </Link>
            <Link href="/signup" className="flex-1 text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-lg text-center hover:bg-blue-700 transition">
              Sign up
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
