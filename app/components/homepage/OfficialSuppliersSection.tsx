'use client';

import { useEffect, useState } from 'react';
import { isImagePath, loadHomepageContent } from './homepageContent';

const fallbackSuppliers = [
  { name: 'TechCorp International', text: 'Authorized marketplace partner', pic: 'DE' },
  { name: 'Global Electronics Ltd', text: 'Authorized marketplace partner', pic: 'CN' },
  { name: 'European Components', text: 'Authorized marketplace partner', pic: 'IT' },
  { name: 'Asia Tech Distributors', text: 'Authorized marketplace partner', pic: 'KR' },
  { name: 'Middle East Supply Co', text: 'Authorized marketplace partner', pic: 'AE' },
];

const selectFields = 'section_7_title, section_7_description, section_7_title_1, section_7_text_1, section_7_pic_1, section_7_title_2, section_7_text_2, section_7_pic_2, section_7_title_3, section_7_text_3, section_7_pic_3, section_7_title_4, section_7_text_4, section_7_pic_4, section_7_title_5, section_7_text_5, section_7_pic_5';

export default function OfficialSuppliersSection() {
  const [title, setTitle] = useState('Official Suppliers and Manufacturers');
  const [description, setDescription] = useState('Authorized distributors and manufacturers supporting verified sourcing requests.');
  const [suppliers, setSuppliers] = useState(fallbackSuppliers);

  useEffect(() => {
    let active = true;
    const loadOfficialSuppliers = async () => {
      const row = await loadHomepageContent(selectFields);
      if (!active || !row) return;

      setTitle(row.section_7_title || 'Official Suppliers and Manufacturers');
      setDescription(row.section_7_description || 'Authorized distributors and manufacturers supporting verified sourcing requests.');
      setSuppliers(fallbackSuppliers.map((supplier, index) => ({
        name: row[`section_7_title_${index + 1}`] || supplier.name,
        text: row[`section_7_text_${index + 1}`] || supplier.text,
        pic: row[`section_7_pic_${index + 1}`] || supplier.pic,
      })));
    };

    loadOfficialSuppliers();
    return () => { active = false; };
  }, []);

  return (
    <section className="bg-white py-8 md:py-10">
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8">
        <div className="mb-5">
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {suppliers.map((supplier) => {
            const pic = supplier.pic?.trim();
            return (
              <article key={supplier.name} className="flex min-h-[150px] flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-200 hover:shadow-md">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-blue-50 text-sm font-bold text-blue-700">
                  {pic && isImagePath(pic) ? <img src={pic} alt="" className="h-8 w-8 object-contain" /> : pic}
                </div>
                <div className="mt-3">
                  <h3 className="text-sm font-bold text-slate-950">{supplier.name}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{supplier.text}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
