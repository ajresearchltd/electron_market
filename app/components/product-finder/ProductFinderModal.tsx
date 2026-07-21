'use client';

import { useEffect, useRef } from 'react';
import ProductFinderPanel from './ProductFinderPanel';

type Mode = 'admin' | 'customer' | 'supplier';

export default function ProductFinderModal({ open, mode, onClose }: { open: boolean; mode: Mode; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !dialog.current) return;
      const focusable = [...dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose, open]);

  return <div className={open ? 'fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/75 p-2 sm:p-4' : 'hidden'} aria-hidden={!open}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={`${mode}-product-finder-modal-title`} className="flex h-[96vh] max-h-[96vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl bg-slate-100 shadow-2xl">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b bg-[#071b3a] px-4 py-3 text-white sm:px-5">
        <div><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Electron Market</p><h2 id={`${mode}-product-finder-modal-title`} className="text-xl font-bold">Product AI Finder</h2></div>
        <button ref={closeButton} type="button" onClick={onClose} className="rounded-lg border border-white/30 px-4 py-2 text-sm font-bold hover:bg-white/10">Close</button>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden p-2 sm:p-4">{open && <ProductFinderPanel mode={mode}/>}</div>
    </div>
  </div>;
}
