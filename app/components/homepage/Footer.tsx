'use client';

import Link from 'next/link';
import { Mail, Phone, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-white py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mb-12">
          {/* Company Info */}
          <div>
            <h3 className="text-2xl font-bold text-blue-400 mb-4">ElectroMarket</h3>
            <p className="text-gray-400 text-sm">
              Global marketplace for electronic components and equipment.
            </p>
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Mail size={16} />
                <span>support@electromarket.com</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Phone size={16} />
                <span>+1 (555) 123-4567</span>
              </div>
            </div>
          </div>

          {/* For Buyers */}
          <div>
            <h4 className="font-bold mb-4">For Buyers</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <Link href="/rfq" className="hover:text-white transition">
                  How it works
                </Link>
              </li>
              <li>
                <Link href="/suppliers" className="hover:text-white transition">
                  Find Suppliers
                </Link>
              </li>
              <li>
                <Link href="/categories" className="hover:text-white transition">
                  Browse Categories
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-white transition">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          {/* For Suppliers */}
          <div>
            <h4 className="font-bold mb-4">For Suppliers</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <Link href="/supplier-signup" className="hover:text-white transition">
                  Join as Supplier
                </Link>
              </li>
              <li>
                <Link href="/supplier-guide" className="hover:text-white transition">
                  Supplier Guide
                </Link>
              </li>
              <li>
                <Link href="/benefits" className="hover:text-white transition">
                  Benefits
                </Link>
              </li>
              <li>
                <Link href="/resources" className="hover:text-white transition">
                  Resources
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-bold mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <Link href="/about" className="hover:text-white transition">
                  About us
                </Link>
              </li>
              <li>
                <Link href="/news" className="hover:text-white transition">
                  News
                </Link>
              </li>
              <li>
                <Link href="/careers" className="hover:text-white transition">
                  Careers
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white transition">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-bold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <Link href="/privacy" className="hover:text-white transition">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/cookies" className="hover:text-white transition">
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link href="/compliance" className="hover:text-white transition">
                  Compliance
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-gray-400">
          <p>&copy; 2024 ElectroMarket. All rights reserved.</p>
          <div className="flex gap-4 mt-4 md:mt-0">
            <a href="#" className="hover:text-white transition">
              Twitter
            </a>
            <a href="#" className="hover:text-white transition">
              LinkedIn
            </a>
            <a href="#" className="hover:text-white transition">
              Facebook
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
