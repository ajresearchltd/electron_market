'use client';

import { useEffect, useState } from 'react';
import { loadHomepageContent } from './homepageContent';

const rfqs = [
  { title: 'STM32L476 Microcontroller - 5000 pcs', category: 'Microcontrollers', quantity: '5,000', responses: 8, createdAt: '2 hours ago' },
  { title: 'HDMI Connectors Type-C - 10000 pcs', category: 'Connectors', quantity: '10,000', responses: 12, createdAt: '4 hours ago' },
  { title: 'Industrial Temperature Sensors', category: 'Sensors', quantity: '3,500', responses: 5, createdAt: '1 day ago' },
  { title: '5V/10A Power Supply Module', category: 'Power Supply', quantity: '2,000', responses: 15, createdAt: '2 days ago' },
];

export default function RecentRFQSection() {
  const [title, setTitle] = useState('Recent RFQ Requests');
  const [description, setDescription] = useState('See the types of sourcing requests flowing through the marketplace.');

  useEffect(() => {
    let active = true;
    loadHomepageContent('section_9_title, section_9_description').then((row) => {
      if (!active || !row) return;
      setTitle(row.section_9_title || 'Recent RFQ Requests');
      setDescription(row.section_9_description || 'See the types of sourcing requests flowing through the marketplace.');
    });
    return () => { active = false; };
  }, []);

  return (
    <section className="bg-[#f5f8fc] py-8 md:py-10">
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8">
        <div className="mb-5">
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {description}
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-700">Request Title</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-700">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-700">Quantity</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-700">Responses</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-700">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rfqs.map((rfq) => (
                  <tr key={rfq.title} className="hover:bg-blue-50/60">
                    <td className="px-4 py-3 text-sm font-semibold text-blue-800">{rfq.title}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{rfq.category}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{rfq.quantity}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">{rfq.responses}</span></td>
                    <td className="px-4 py-3 text-sm text-slate-600">{rfq.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl bg-[#061b3d] p-5 text-white shadow-sm">
            <div className="relative h-full min-h-[220px]">
              <img src="/reference/friz_1.jpg" alt="" className="absolute inset-0 h-full w-full rounded-lg object-cover opacity-35" />
              <div className="relative z-10 flex h-full flex-col justify-between">
                <div>
                  <h3 className="text-xl font-bold">Global Logistics Support</h3>
                  <p className="mt-3 max-w-xs text-sm leading-6 text-blue-100">We help move RFQs from request to supplier response and final delivery.</p>
                </div>
                <a href="/create-request" className="mt-6 inline-flex w-fit rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">Learn more</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
