'use client';

import { useState } from 'react';
import { validatePublicEnquiry } from '../../../lib/public-request/policy';

export type GeneralGoodsFormValue = Record<string, string>;

const fields = [
  ['productName', 'Product or category name'],
  ['description', 'Detailed request description'],
  ['quantity', 'Estimated quantity'],
  ['estimatedBudget', 'Estimated budget (USD)', 'number'],
  ['country', 'Required delivery country'],
  ['timeframe', 'Required delivery date or timeframe'],
  ['brand', 'Manufacturer / brand (optional)'],
] as const;

const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const primaryClass = 'rounded-lg border border-white/40 bg-indigo-950 px-4 py-2 font-bold text-white shadow hover:bg-blue-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50';

export default function GeneralGoodsRequestForm({ form, setForm, onSubmit, busy, displayMode = 'modal' }: {
  form: GeneralGoodsFormValue;
  setForm: (value: GeneralGoodsFormValue) => void;
  onSubmit: () => void;
  busy: boolean;
  displayMode?: 'modal' | 'inline';
}) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const submit = () => {
    const errors: Record<string, string> = {};
    if (!form.productName?.trim()) errors.productName = 'Product or category name is required.';
    if (!form.description?.trim()) errors.description = 'Detailed request description is required.';
    if (!form.quantity?.trim()) errors.quantity = 'Estimated quantity is required.';
    if (Number(form.estimatedBudget) < 7500) errors.estimatedBudget = 'Estimated budget must be at least USD 7,500.';
    if (!form.country?.trim()) errors.country = 'Required delivery country is required.';
    if (!form.timeframe?.trim()) errors.timeframe = 'Required delivery date or timeframe is required.';
    setFieldErrors(errors);
    if (!validatePublicEnquiry('general_goods', form) && Object.keys(errors).length === 0) onSubmit();
  };
  return <div className={displayMode === 'inline' ? 'w-full' : 'mx-auto max-w-2xl'}>
    <h3 className="text-xl font-bold text-blue-950">Consumer, Medical or General Goods</h3>
    <p className="mt-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">This service is intended for wholesale orders with an estimated value of at least USD 7,500.</p>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      {fields.map(([key, label, type]) => <label key={key} className={`block text-sm font-bold ${key === 'description' ? 'sm:col-span-2' : ''}`}>
        {label}
        {key === 'description'
          ? <textarea required rows={4} aria-invalid={Boolean(fieldErrors[key])} aria-describedby={fieldErrors[key] ? `${key}-error` : undefined} value={form[key] || ''} onChange={event => setForm({ ...form, [key]: event.target.value })} className={inputClass} />
          : <input required={key !== 'brand'} min={key === 'estimatedBudget' ? 7500 : undefined} type={type || 'text'} aria-invalid={Boolean(fieldErrors[key])} aria-describedby={fieldErrors[key] ? `${key}-error` : undefined} value={form[key] || ''} onChange={event => setForm({ ...form, [key]: event.target.value })} className={inputClass} />}
        {fieldErrors[key] && <span id={`${key}-error`} className="mt-1 block text-xs font-semibold text-red-700">{fieldErrors[key]}</span>}
      </label>)}
    </div>
    <button type="button" onClick={submit} disabled={busy} className={`${primaryClass} mt-6 w-full`}>{busy ? 'Submitting…' : 'Submit request'}</button>
  </div>;
}
