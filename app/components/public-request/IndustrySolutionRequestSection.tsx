'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { EMAIL_OTP_LENGTH } from '../../../lib/public-request/policy';
import GeneralGoodsRequestForm, { type GeneralGoodsFormValue } from './GeneralGoodsRequestForm';

type State = 'loading' | 'email_entry' | 'code_entry' | 'request_form' | 'success';
type Identity = { kind: 'authenticated'; email: string } | { kind: 'guest'; verified: boolean; email?: string };
const emptyOtp = () => Array.from({ length: EMAIL_OTP_LENGTH }, () => '');
const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const buttonClass = 'rounded-lg bg-indigo-950 px-4 py-2.5 font-bold text-white shadow hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50';

export default function IndustrySolutionRequestSection({ industrySolutionId, industrySolutionTitle }: { industrySolutionId: string; industrySolutionTitle: string }) {
  const [state, setState] = useState<State>('loading');
  const [email, setEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [digits, setDigits] = useState(emptyOtp);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resultId, setResultId] = useState('');
  const [submissionKey, setSubmissionKey] = useState('');
  const [form, setForm] = useState<GeneralGoodsFormValue>({ productName: industrySolutionTitle });
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    fetch('/api/public/request-access/session', { cache: 'no-store' }).then(response => response.json()).then(async (identity: Identity) => {
      if (identity.kind === 'authenticated') {
        await fetch('/api/public/request-access/sourcing-context', { method: 'POST' });
        setEmail(identity.email || '');
        setState('request_form');
      } else {
        setEmail(identity.email || '');
        setState('email_entry');
      }
    }).catch(() => { setError('Secure request access could not be loaded.'); setState('email_entry'); });
  }, []);

  useEffect(() => { if (!cooldown) return; const timer = setInterval(() => setCooldown(value => Math.max(0, value - 1)), 1000); return () => clearInterval(timer); }, [cooldown]);

  const sendCode = async () => {
    if (busy) return;
    setBusy(true); setError('');
    const normalized = email.trim().toLowerCase();
    const response = await fetch('/api/public/request-access/send-code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: normalized, authIntent: 'industry_solution_request' }) });
    const data = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) { setError(data.error || 'We could not send the verification code. Please try again.'); return; }
    setEmail(normalized); setMaskedEmail(data.maskedEmail || normalized); setChallengeId(data.challengeId || ''); setCooldown(data.cooldownSeconds || 60); setDigits(emptyOtp()); setState('code_entry');
    requestAnimationFrame(() => refs.current[0]?.focus());
  };

  const setDigit = (index: number, value: string) => {
    const characters = value.replace(/\D/g, '');
    if (characters.length > 1) {
      const pasted = characters.slice(0, EMAIL_OTP_LENGTH).split('');
      setDigits(Array.from({ length: EMAIL_OTP_LENGTH }, (_, digitIndex) => pasted[digitIndex] || ''));
      refs.current[Math.min(EMAIL_OTP_LENGTH - 1, Math.max(0, pasted.length - 1))]?.focus(); return;
    }
    const next = [...digits]; next[index] = characters; setDigits(next);
    if (characters && index < EMAIL_OTP_LENGTH - 1) refs.current[index + 1]?.focus();
  };

  const verifyCode = async () => {
    if (busy) return;
    if (digits.join('').length !== EMAIL_OTP_LENGTH) { setError('Enter the complete eight-digit verification code.'); return; }
    setBusy(true); setError('');
    const response = await fetch('/api/public/request-access/verify-code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code: digits.join(''), challengeId, authIntent: 'industry_solution_request' }) });
    const data = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) { setError(data.error || 'The verification code is invalid or has expired.'); return; }
    if (data.authIntent !== 'industry_solution_request' || data.nextStep !== 'request_form') { setError('Sourcing access could not be resumed. Please try again.'); return; }
    setState('request_form'); window.dispatchEvent(new Event('electron-market:auth-changed'));
  };

  const submit = async () => {
    if (busy) return;
    const key = submissionKey || crypto.randomUUID(); if (!submissionKey) setSubmissionKey(key);
    setBusy(true); setError('');
    const response = await fetch('/api/public/request-access/enquiries', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'general_goods', payload: form, submissionIdempotencyKey: key, context: { source: 'industry_solution_detail', industrySolutionId } }) });
    const data = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) { setError(data.error || 'Request could not be submitted.'); return; }
    setResultId(data.requestNumber || data.id); setState('success');
  };

  const changeEmail = () => { setDigits(emptyOtp()); setChallengeId(''); setMaskedEmail(''); setCooldown(0); setError(''); setState('email_entry'); };
  const another = () => { setForm({ productName: industrySolutionTitle }); setSubmissionKey(''); setResultId(''); setError(''); setState('request_form'); };

  return <section className="mt-8 rounded-2xl border border-sky-200 bg-[#EAF6FF] p-5 shadow-sm sm:p-8" aria-labelledby="industry-request-heading">
    <h2 id="industry-request-heading" className="text-2xl font-bold text-slate-950">Request products for this industry solution</h2>
    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Describe the products, equipment or complete solution you need. Electron Market will source suitable offers from its global supplier network.</p>
    <div className="mt-6">
      {state === 'loading' && <p className="py-8 text-center text-slate-600">Loading secure request access…</p>}
      {state === 'email_entry' && <div className="max-w-xl rounded-xl bg-white/80 p-4 sm:p-5"><h3 className="text-lg font-bold text-blue-950">Verify your email to submit a sourcing request</h3><p className="mt-2 text-sm text-slate-700">Enter your email address and we will send you a secure eight-digit verification code.</p><label className="mt-4 block text-sm font-bold">Email<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className={inputClass} /></label><button type="button" onClick={sendCode} disabled={busy || !email.trim()} className={`${buttonClass} mt-5 w-full sm:w-auto`}>{busy ? 'Sending…' : 'Send code'}</button></div>}
      {state === 'code_entry' && <div className="max-w-xl rounded-xl bg-white/80 p-4 sm:p-5"><h3 className="text-lg font-bold text-blue-950">Enter verification code</h3><p className="mt-2 text-sm text-slate-700">We sent an eight-digit code to <strong>{maskedEmail}</strong>.</p><div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-8" role="group" aria-label="Enter the eight-digit verification code">{digits.map((value, index) => <input key={index} ref={node => { refs.current[index] = node; }} value={value} inputMode="numeric" autoComplete={index === 0 ? 'one-time-code' : 'off'} pattern="[0-9]*" maxLength={1} aria-label={`Verification code digit ${index + 1} of ${EMAIL_OTP_LENGTH}`} onChange={event => setDigit(index, event.target.value)} onPaste={event => { event.preventDefault(); setDigit(0, event.clipboardData.getData('text')); }} onKeyDown={event => { if (event.key === 'Backspace' && !value && index > 0) refs.current[index - 1]?.focus(); if (event.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus(); if (event.key === 'ArrowRight' && index < EMAIL_OTP_LENGTH - 1) refs.current[index + 1]?.focus(); }} className="h-12 min-w-0 rounded-lg border border-slate-300 bg-white text-center text-xl font-bold focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />)}</div><button type="button" onClick={verifyCode} disabled={busy || digits.join('').length !== EMAIL_OTP_LENGTH} className={`${buttonClass} mt-5 w-full`}>{busy ? 'Verifying…' : 'Verify'}</button><div className="mt-4 flex justify-between gap-4 text-sm"><button type="button" onClick={changeEmail} className="font-semibold text-blue-700">Change email</button><button type="button" onClick={sendCode} disabled={cooldown > 0 || busy} className="font-semibold text-blue-700 disabled:text-slate-400">{cooldown ? `Resend in ${cooldown}s` : 'Resend code'}</button></div></div>}
      {state === 'request_form' && <GeneralGoodsRequestForm form={form} setForm={setForm} onSubmit={submit} busy={busy} displayMode="inline" />}
      {state === 'success' && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6"><h3 className="text-xl font-bold text-emerald-800">Your sourcing request has been submitted successfully.</h3><p className="mt-2 text-emerald-800">Preliminary Order: <strong>{resultId}</strong></p><div className="mt-5 flex flex-col gap-3 sm:flex-row"><Link href="/customer/requests" className={buttonClass}>View Preliminary Orders</Link><button type="button" onClick={another} className="rounded-lg border border-emerald-700 px-4 py-2.5 font-bold text-emerald-800">Submit another request</button></div></div>}
      {error && <p className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </div>
  </section>;
}
