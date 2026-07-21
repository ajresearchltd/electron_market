'use client';

import { ReactNode, useEffect, useId, useRef, useState } from 'react';

export type ConversionSuccess = {
  destinationLabel: string;
  destinationNumber: string;
  procurementNumber: string;
  convertedPositions?: number;
  remainingPositions?: number;
  navigationUrl?: string;
};

type Props = {
  open: boolean;
  title: string;
  sourceLabel: string;
  destinationLabel: string;
  sourceNumber: string;
  procurementNumber: string;
  dirty: boolean;
  pending: boolean;
  errors?: string[];
  success?: ConversionSuccess | null;
  children: ReactNode;
  onClose: () => void;
  onReset: () => void;
  onConvert: () => void;
  convertLabel?: string;
  convertDisabled?: boolean;
};

export default function DocumentConversionModal(props: Props) {
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const requestClose = () => {
    if (props.pending) return;
    if (props.dirty && !props.success) setConfirmDiscard(true);
    else props.onClose();
  };

  useEffect(() => {
    if (!props.open) return;
    const origin = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
      if (event.key !== 'Tab' || !dialog.current) return;
      const focusable = [...dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      origin?.focus();
    };
  }, [props.open, props.dirty, props.pending, props.success]);

  if (!props.open) return null;
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/75 p-2 backdrop-blur-sm sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget) requestClose(); }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} className="flex max-h-[90vh] w-full max-w-[1200px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <header className="flex flex-none items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6">
        <div><h2 id={titleId} className="text-xl font-bold text-blue-950 sm:text-2xl">{props.title}</h2><div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{props.sourceLabel}</span><span aria-hidden="true">→</span><span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-800">{props.destinationLabel}</span><span className="font-mono text-slate-700">{props.procurementNumber}</span><span className="text-slate-500">Source: {props.sourceNumber}</span></div></div>
        <button ref={closeButton} type="button" onClick={requestClose} disabled={props.pending} aria-label="Close conversion form" className="rounded-lg border border-slate-300 px-3 py-2 font-bold disabled:opacity-50">Close</button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        {props.errors?.length ? <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p className="font-bold">{props.errors.length} field{props.errors.length === 1 ? '' : 's'} require attention</p><ul className="mt-2 list-disc pl-5">{props.errors.map(error => <li key={error}>{error}</li>)}</ul></div> : null}
        {props.success ? <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950"><h3 className="text-xl font-bold">Conversion completed</h3><p className="mt-2">{props.success.destinationLabel} <b>{props.success.destinationNumber}</b> was created for Procurement Number <b>{props.success.procurementNumber}</b>.</p>{props.success.convertedPositions != null && <p className="mt-1">Converted positions: {props.success.convertedPositions}{props.success.remainingPositions != null ? ` · Remaining: ${props.success.remainingPositions}` : ''}</p>}{props.success.navigationUrl && <a href={props.success.navigationUrl} className="mt-4 inline-flex rounded-lg bg-blue-700 px-4 py-2 font-bold text-white">Open created document</a>}</section> : props.children}
      </div>
      <footer className="flex flex-none flex-wrap justify-end gap-3 border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
        <button type="button" onClick={requestClose} disabled={props.pending} className="rounded-lg border border-slate-300 px-4 py-2 font-bold disabled:opacity-50">{props.success ? 'Close' : 'Cancel'}</button>
        {!props.success && <><button type="button" onClick={props.onReset} disabled={props.pending || !props.dirty} className="rounded-lg border border-slate-300 px-4 py-2 font-bold disabled:opacity-50">Reset changes</button><button type="button" onClick={props.onConvert} disabled={props.pending || props.convertDisabled} className="rounded-lg bg-blue-700 px-5 py-2 font-bold text-white disabled:opacity-50">{props.pending ? 'Saving…' : props.convertLabel || 'Save'}</button></>}
      </footer>
    </div>
    {confirmDiscard && <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 p-4"><div role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl"><h3 className="text-lg font-bold text-slate-950">Discard unsaved conversion changes?</h3><div className="mt-5 flex justify-end gap-3"><button autoFocus type="button" onClick={() => setConfirmDiscard(false)} className="rounded-lg border px-4 py-2 font-bold">Continue editing</button><button type="button" onClick={() => { setConfirmDiscard(false); props.onClose(); }} className="rounded-lg bg-red-700 px-4 py-2 font-bold text-white">Discard changes</button></div></div></div>}
  </div>;
}
