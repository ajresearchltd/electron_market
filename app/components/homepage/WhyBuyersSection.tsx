'use client';

import { useEffect, useRef, useState } from 'react';
import type { WhyBuyersCardDetail } from '../../../lib/homepage/why-buyers-details';
import { isImagePath, loadHomepageContent, loadWhyBuyersCardDetails, loadWhyBuyersCardVisibility } from './homepageContent';
import WhyBuyersDetailsModal from './WhyBuyersDetailsModal';

type Benefit={cardNumber:number;title:string;description:string;pic:string|null;detail?:WhyBuyersCardDetail};
const fallbackBenefits:Benefit[] = [
  { cardNumber:1,title: 'Fast Quotes', description: 'Average supplier responses within 24 hours.', pic: null },
  { cardNumber:2,title: 'Verified Suppliers', description: 'Supplier profiles are reviewed for marketplace quality.', pic: null },
  { cardNumber:3,title: 'Quality Assured', description: 'Source from partners with documentation and compliance support.', pic: null },
  { cardNumber:4,title: 'Global Reach', description: 'Access sourcing options across 150+ countries.', pic: null },
  { cardNumber:5,title: '24/7 Support', description: 'Help for urgent RFQs and supplier coordination.', pic: null },
  { cardNumber:6,title: 'Better Comparisons', description: 'Compare pricing, lead times, and terms in one workflow.', pic: null },
];

const selectFields = 'section_5_title, section_5_description, section_5_name_1, section_5_text_1, section_5_pic_1, section_5_name_2, section_5_text_2, section_5_pic_2, section_5_name_3, section_5_text_3, section_5_pic_3, section_5_name_4, section_5_text_4, section_5_pic_4, section_5_name_5, section_5_text_5, section_5_pic_5, section_5_name_6, section_5_text_6, section_5_pic_6';

function BenefitPhoto({ src, title }: { src: string | null; title: string }) {
  const [failed, setFailed] = useState(false);
  const canRender = Boolean(src && isImagePath(src) && !failed);
  return <div className="relative min-h-[180px] w-full overflow-hidden rounded-lg bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100">
    {canRender ? <img src={src!} alt="" onError={() => setFailed(true)} className="h-[180px] w-full object-cover object-center transition-transform duration-300 ease-out group-hover:scale-[1.04] group-focus-visible:scale-[1.04] group-focus-within:scale-[1.04]" /> : <div role="img" aria-label={`Photo placeholder for ${title}`} className="flex h-[180px] items-center justify-center" ><div className="h-20 w-28 rounded-2xl border border-blue-200/70 bg-white/55 shadow-inner"><div className="mx-auto mt-5 h-3 w-16 rounded-full bg-blue-200/70"/><div className="mx-auto mt-3 h-3 w-10 rounded-full bg-indigo-200/70"/></div></div>}
  </div>;
}

export default function WhyBuyersSection() {
  const [title, setTitle] = useState('Why buyers choose ElectroMarket');
  const [description, setDescription] = useState('Procurement teams get trusted suppliers, broad coverage, and clean sourcing workflows.');
  const [benefits, setBenefits] = useState(fallbackBenefits);
  const [cardVisibility, setCardVisibility] = useState<boolean[]>(Array<boolean>(6).fill(true));
  const [selectedCard, setSelectedCard] = useState<Benefit|null>(null);
  const cardRefs = useRef<Record<number, HTMLElement | null>>({});

  useEffect(() => {
    let active = true;
    const loadBenefits = async () => {
      const [row, visibility] = await Promise.all([loadHomepageContent(selectFields), loadWhyBuyersCardVisibility()]);
      if (active) setCardVisibility(visibility);
      if (!active || !row) return;

      setTitle(row.section_5_title || 'Why buyers choose ElectroMarket');
      setDescription(row.section_5_description || 'Procurement teams get trusted suppliers, broad coverage, and clean sourcing workflows.');
      const details = await loadWhyBuyersCardDetails(String(row.homepage_content_id));
      if (!active) return;
      for (const benefit of fallbackBenefits) {
        if (!details.some((detail) => detail.cardNumber === benefit.cardNumber)) console.info('Why Buyers popup detail row is absent.', { homepageContentId: String(row.homepage_content_id), cardNumber: benefit.cardNumber, absent: true });
      }
      setBenefits(fallbackBenefits.map((benefit, index) => ({
        ...benefit,
        title: row[`section_5_name_${index + 1}`] || benefit.title,
        description: row[`section_5_text_${index + 1}`] || benefit.description,
        pic: row[`section_5_pic_${index + 1}`] || null,
        detail: details.find((detail) => detail.cardNumber === benefit.cardNumber),
      })));
    };

    loadBenefits();
    return () => { active = false; };
  }, []);

  const visibleBenefits = benefits.filter((_, index) => cardVisibility[index]);
  if (visibleBenefits.length === 0) return null;

  return (
    <section className="bg-white py-8 md:py-10">
      <div className="mx-auto w-full max-w-[1475px] px-4 sm:px-6 lg:px-8">
        <div className="mb-5">
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
        </div>

        <div className="category-scrollbar flex w-full flex-nowrap items-stretch gap-3 overflow-x-auto overflow-y-hidden pb-3 [scroll-snap-type:x_proximity]" role="region" aria-label="Buyer benefits" tabIndex={0}>
          {visibleBenefits.map((benefit) => {
            const pic = benefit.pic?.trim();
            return (
              <article ref={node=>{cardRefs.current[benefit.cardNumber]=node}} key={benefit.cardNumber} role="button" aria-label={`Open details for ${benefit.title}`} tabIndex={0} onClick={()=>setSelectedCard(benefit)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setSelectedCard(benefit)}}} className="group flex min-h-[330px] min-w-[min(80vw,320px)] flex-[0_0_min(80vw,320px)] snap-start cursor-pointer flex-col rounded-xl border border-slate-200 bg-white p-3 pb-3 text-left shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:border-blue-200 hover:bg-indigo-950 hover:shadow-xl focus-within:-translate-y-1 focus-within:border-blue-200 focus-within:bg-indigo-950 focus-within:shadow-xl focus-visible:-translate-y-1 focus-visible:border-blue-200 focus-visible:bg-indigo-950 focus-visible:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 xl:min-w-0 xl:flex-1 xl:basis-0">
                <h3 className="mb-3 min-h-10 break-words text-left text-sm font-bold leading-5 text-slate-950 transition-colors duration-300 group-hover:text-white group-focus-visible:text-white group-focus-within:text-white">{benefit.title}</h3>
                <BenefitPhoto src={pic || null} title={benefit.title} />
                <p className="mt-3 break-words pb-0 text-left text-[13px] leading-5 text-slate-600 transition-colors duration-300 group-hover:text-blue-50 group-focus-visible:text-blue-50 group-focus-within:text-blue-50">{benefit.description}</p>
              </article>
            );
          })}
        </div>
      </div>
      {selectedCard&&<WhyBuyersDetailsModal card={selectedCard} onClose={()=>{const cardNumber=selectedCard.cardNumber;setSelectedCard(null);requestAnimationFrame(()=>cardRefs.current[cardNumber]?.focus())}}/>}
    </section>
  );
}
