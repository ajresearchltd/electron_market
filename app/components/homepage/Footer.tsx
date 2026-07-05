'use client';

import Link from 'next/link';
import { Mail, Phone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isImagePath, loadHomepageContent } from './homepageContent';

const fallbackColumns = [
  { title: 'For Buyers', links: [{ label: 'How it works', href: '#how-it-works' }, { label: 'Find Suppliers', href: '#suppliers' }, { label: 'Browse Categories', href: '#categories' }, { label: 'Help Center', href: '#' }] },
  { title: 'For Suppliers', links: [{ label: 'Join as Supplier', href: '/signup?type=supplier' }, { label: 'Supplier Guide', href: '#' }, { label: 'Benefits', href: '#' }, { label: 'Resources', href: '#' }] },
  { title: 'Company', links: [{ label: 'About us', href: '#about' }, { label: 'News', href: '#' }, { label: 'Careers', href: '#' }, { label: 'Contact', href: '#' }] },
];

const selectFields = 'section_12_title, section_12_deviz, section_12_logo, section_12_pic_card_1, section_12_pic_card_1_link, section_12_pic_card_2, section_12_pic_card_2_link, section_12_pic_card_3, section_12_pic_card_3_link, section_12_pic_card_4, section_12_pic_card_4_link, section_12_pic_card_5, section_12_pic_card_5_link, section_12_pic_card_6, section_12_pic_card_6_link, section_12_how_it_work, section_12_how_it_work_link, section_12_submit_rfq, section_12_submit_rfq_link, section_12_find_supplier, section_12_find_supplier_link, section_12_help_center, section_12_help_center_link, section_12_join_as_supplier, section_12_join_as_supplier_link, section_12_supplier_guide, section_12_supplier_guide_link, section_12_benefit, section_12_benefit_link, section_12_resources, section_12_resources_link, section_12_about_us, section_12_about_us_link, section_12_news, section_12_news_link, section_12_careers, section_12_careers_link, section_12_partners, section_12_partners_link, section_12_contact_us, section_12_contact_us_link';

type FooterLink = { label: string; href: string };
type FooterColumn = { title: string; links: FooterLink[] };
type FooterCard = { pic: string; href: string };

export default function Footer() {
  const [title, setTitle] = useState('ElectroMarket');
  const [description, setDescription] = useState('Global marketplace for electronic components and equipment.');
  const [logo, setLogo] = useState<string | null>(null);
  const [columns, setColumns] = useState<FooterColumn[]>(fallbackColumns);
  const [cards, setCards] = useState<FooterCard[]>([]);

  useEffect(() => {
    let active = true;
    const loadFooter = async () => {
      const row = await loadHomepageContent(selectFields);
      if (!active || !row) return;

      setTitle(row.section_12_title || 'ElectroMarket');
      setDescription(row.section_12_deviz || 'Global marketplace for electronic components and equipment.');
      setLogo(row.section_12_logo || null);
      setColumns([
        {
          title: 'For Buyers',
          links: [
            { label: row.section_12_how_it_work || 'How it works', href: row.section_12_how_it_work_link || '#how-it-works' },
            { label: row.section_12_submit_rfq || 'Submit RFQ', href: row.section_12_submit_rfq_link || '/create-request' },
            { label: row.section_12_find_supplier || 'Find Suppliers', href: row.section_12_find_supplier_link || '#suppliers' },
            { label: row.section_12_help_center || 'Help Center', href: row.section_12_help_center_link || '#' },
          ],
        },
        {
          title: 'For Suppliers',
          links: [
            { label: row.section_12_join_as_supplier || 'Join as Supplier', href: row.section_12_join_as_supplier_link || '/signup?type=supplier' },
            { label: row.section_12_supplier_guide || 'Supplier Guide', href: row.section_12_supplier_guide_link || '#' },
            { label: row.section_12_benefit || 'Benefits', href: row.section_12_benefit_link || '#' },
            { label: row.section_12_resources || 'Resources', href: row.section_12_resources_link || '#' },
          ],
        },
        {
          title: 'Company',
          links: [
            { label: row.section_12_about_us || 'About us', href: row.section_12_about_us_link || '#about' },
            { label: row.section_12_news || 'News', href: row.section_12_news_link || '#' },
            { label: row.section_12_careers || 'Careers', href: row.section_12_careers_link || '#' },
            { label: row.section_12_partners || 'Partners', href: row.section_12_partners_link || '#' },
            { label: row.section_12_contact_us || 'Contact', href: row.section_12_contact_us_link || '#' },
          ],
        },
      ]);
      setCards([1, 2, 3, 4, 5, 6].map((index) => ({
        pic: row[`section_12_pic_card_${index}`] || '',
        href: row[`section_12_pic_card_${index}_link`] || '#',
      })).filter((card) => card.pic));
    };

    loadFooter();
    return () => { active = false; };
  }, []);

  return (
    <footer id="about" className="bg-slate-950 py-12 text-white md:py-16">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-3">
              {logo && isImagePath(logo) ? <img src={logo} alt="" className="h-10 w-10 object-contain" /> : null}
              <h3 className="text-2xl font-bold text-blue-400">{title}</h3>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-400">{description}</p>
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
            {cards.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {cards.map((card, index) => (
                  <a key={`${card.pic}-${index}`} href={card.href} className="flex h-10 w-14 items-center justify-center rounded-md border border-white/10 bg-white/5 p-1 hover:bg-white/10">
                    {isImagePath(card.pic) ? <img src={card.pic} alt="" className="h-full w-full object-contain" /> : <span className="text-xs font-semibold text-slate-300">{card.pic}</span>}
                  </a>
                ))}
              </div>
            )}
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h4 className="font-bold text-white">{column.title}</h4>
              <ul className="mt-4 space-y-2 text-sm text-slate-400">
                {column.links.map((link) => (
                  <li key={`${column.title}-${link.label}`}>
                    <Link href={link.href} className="hover:text-white">{link.label}</Link>
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