'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { safeWhyBuyersCtaUrl, type WhyBuyersCardDetail } from '../../../lib/homepage/why-buyers-details';
import { isImagePath } from './homepageContent';

type Card = { cardNumber: number; title: string; description: string; pic: string | null; detail?: WhyBuyersCardDetail };

function DetailImage({ src, alt, className }: { src: string | null; alt: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || !isImagePath(src) || failed) return null;
  return <img src={src} alt={alt} onError={() => setFailed(true)} className={className} />;
}

type Slide = { src: string; alt: string };
function ImageSlideshow({ images }: { images: Slide[] }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (images.length < 2 || paused) return;
    const timer = window.setInterval(() => setCurrent(index => (index + 1) % images.length), 5000);
    return () => window.clearInterval(timer);
  }, [images.length, paused]);
  useEffect(() => { if (current >= images.length) setCurrent(0); }, [current, images.length]);
  if (!images.length) return null;
  const show = (index: number) => setCurrent((index + images.length) % images.length);
  const image = images[current];
  return <section aria-label="Image slideshow" className="relative mx-auto aspect-square w-full max-w-[560px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}>
    <div className="flex h-full w-full items-center justify-center">
      <DetailImage key={image.src} src={image.src} alt={image.alt} className="h-full w-full object-contain object-center" />
    </div>
    {images.length > 1 && <>
      <button type="button" onClick={() => show(current - 1)} aria-label="Previous image" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-blue-950/90 px-3 py-2 text-xl font-bold text-white shadow-lg transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">‹</button>
      <button type="button" onClick={() => show(current + 1)} aria-label="Next image" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-blue-950/90 px-3 py-2 text-xl font-bold text-white shadow-lg transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">›</button>
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-blue-950/80 px-3 py-2" aria-label={`Image ${current + 1} of ${images.length}`}>
        {images.map((slide, index) => <button key={slide.src} type="button" onClick={() => show(index)} aria-label={`Show image ${index + 1}`} aria-current={index === current ? 'true' : undefined} className={`h-2.5 w-2.5 rounded-full border border-white ${index === current ? 'bg-white' : 'bg-white/35'}`} />)}
      </div>
    </>}
  </section>;
}

function PlainTextBody({ text }: { text: string }) {
  const paragraphs = text.split(/\r?\n\s*\r?\n/).map(part => part.trim()).filter(Boolean);
  return <div className="space-y-4 break-words text-[15px] leading-7 text-slate-700">
    {paragraphs.map((paragraph, index) => <p key={index} className="whitespace-pre-line">{paragraph}</p>)}
  </div>;
}

export default function WhyBuyersDetailsModal({ card, onClose }: { card: Card; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const detail = card.detail;
  const title = detail?.modalTitle || card.title;
  const subtitle = detail?.modalSubtitle || card.description;
  const images = [
    card.pic && isImagePath(card.pic) ? { src: card.pic, alt: `${card.title} card image` } : null,
    detail?.mainImagePath && isImagePath(detail.mainImagePath) ? { src: detail.mainImagePath, alt: detail.mainImageAlt || `${title} main image` } : null,
    detail?.additionalImage1Path && isImagePath(detail.additionalImage1Path) ? { src: detail.additionalImage1Path, alt: detail.additionalImage1Alt || `${title} detail image 1` } : null,
    detail?.additionalImage2Path && isImagePath(detail.additionalImage2Path) ? { src: detail.additionalImage2Path, alt: detail.additionalImage2Alt || `${title} detail image 2` } : null,
  ].filter((image, index, all): image is Slide => Boolean(image) && all.findIndex(candidate => candidate?.src === image?.src) === index);
  const cta = safeWhyBuyersCtaUrl(detail?.buttonUrl);
  const showCta = Boolean(detail?.buttonText && cta);

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab' && dialog.current) {
        const nodes = [...dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')];
        if (!nodes.length) return;
        const first = nodes[0], last = nodes.at(-1)!;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = overflow; };
  }, [onClose]);

  const ctaClass = 'inline-flex justify-center rounded-lg border border-blue-950 bg-blue-950 px-6 py-3 text-center font-bold text-white shadow-md transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2';
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/75 p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={`why-buyers-modal-title-${card.cardNumber}`} aria-describedby={subtitle ? `why-buyers-modal-subtitle-${card.cardNumber}` : undefined} className="flex max-h-[90vh] w-[min(960px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-white px-5 py-4 sm:px-6">
        <div className="min-w-0"><h2 id={`why-buyers-modal-title-${card.cardNumber}`} className="break-words text-2xl font-bold leading-tight text-blue-950 sm:text-3xl">{title}</h2>{subtitle && <p id={`why-buyers-modal-subtitle-${card.cardNumber}`} className="mt-2 break-words text-sm leading-6 text-slate-600 sm:text-base">{subtitle}</p>}</div>
        <button ref={closeButton} type="button" aria-label="Close Why Buyers details" onClick={onClose} className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 font-bold text-blue-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">Close</button>
      </header>
      <div className="overflow-x-hidden overflow-y-auto p-5 sm:p-6">
        <ImageSlideshow images={images} />
        {detail?.summaryText && <section className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950"><h3 className="font-bold">Summary</h3><p className="mt-2 whitespace-pre-line break-words text-sm leading-6">{detail.summaryText}</p></section>}
        {detail?.bodyText && <section className="mt-5"><h3 className="mb-3 text-lg font-bold text-blue-950">Detailed information</h3><PlainTextBody text={detail.bodyText} /></section>}
        {showCta && <div className="mt-6 flex justify-center">{cta!.external ? <a href={cta!.href} target="_blank" rel="noopener noreferrer" className={ctaClass}>{detail!.buttonText}</a> : <Link href={cta!.href} className={ctaClass}>{detail!.buttonText}</Link>}</div>}
      </div>
    </div>
  </div>;
}
