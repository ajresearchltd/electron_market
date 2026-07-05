'use client';

import Link from 'next/link';
import { Mail, Phone } from 'lucide-react';

const columns = [
  { title: 'For Buyers', links: ['How it works', 'Find Suppliers', 'Browse Categories', 'Pricing'] },
  { title: 'For Suppliers', links: ['Join as Supplier', 'Supplier Guide', 'Benefits', 'Resources'] },
  { title: 'Company', links: ['About us', 'News', 'Careers', 'Contact'] },
  { title: 'Legal', links: ['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'Compliance'] },
];

export default function Footer() {
  return (
    <footer id="about" className="bg-slate-950 py-12 text-white md:py-16">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div>
            <h3 className="text-2xl font-bold text-blue-400">ElectroMarket</h3>
            <p className="mt-4 text-sm leading-6 text-slate-400">
              Global marketplace for electronic components and equipment.
            </p>
            <div className="mt-5 space-y-3">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Mail size={16} aria-hidden="true" />
                <span>support@electromarket.com</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Phone size={16} aria-hidden="true" />
                <span>+1 (555) 123-4567</span>
              </div>
            </div>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h4 className="font-bold text-white">{column.title}</h4>
              <ul className="mt-4 space-y-2 text-sm text-slate-400">
                {column.links.map((link) => (
                  <li key={link}>
                    <Link href="#" className="hover:text-white">{link}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-sm text-slate-400 md:flex-row">
          <p>&copy; 2024 ElectroMarket. All rights reserved.</p>
          <div className="flex gap-5">
            <a href="#" className="hover:text-white">Twitter</a>
            <a href="#" className="hover:text-white">LinkedIn</a>
            <a href="#" className="hover:text-white">Facebook</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
