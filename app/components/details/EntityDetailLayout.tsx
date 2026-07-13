import Link from 'next/link';
import type { ReactNode } from 'react';
import ListingHeader from '../listing/ListingHeader';

type User = { email: string; companyName: string; avatarUrl: string | null } | null;
type Info = { label: string; value: string | number | null | undefined };
const validImage = (value?: string | null) => Boolean(value && !value.startsWith('blob:') && (value.startsWith('/') || value.startsWith('http://') || value.startsWith('https://')));

export default function EntityDetailLayout({ entityType, title, subtitle, description, image, imageFit = 'contain', badges = [], information = [], user, children }: { entityType: string; title: string; subtitle?: string | null; description?: string | null; image?: string | null; imageFit?: 'contain' | 'cover'; badges?: string[]; information?: Info[]; user: User; children?: ReactNode }) {
  const info = information.filter((item) => item.value !== null && item.value !== undefined && String(item.value).trim());
  return <main className="min-h-screen bg-slate-50 pt-16 text-slate-950">
    <ListingHeader title={title} user={user} />
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/" className="text-sm font-semibold text-blue-700 hover:text-blue-900">← Back to home</Link>
      <section className="mt-5 grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
        <div className="flex min-h-72 items-center justify-center bg-slate-100 p-6 sm:min-h-96">
          {validImage(image) ? <img src={image!} alt={`${title} ${entityType}`} className={`h-full max-h-[440px] w-full ${imageFit === 'cover' ? 'object-cover' : 'object-contain'}`} /> : <div className="flex h-32 w-32 items-center justify-center rounded-3xl bg-white text-4xl font-bold text-blue-700 shadow-sm">{title.slice(0, 2).toUpperCase()}</div>}
        </div>
        <div className="flex flex-col justify-center p-6 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-blue-600">{entityType}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          {badges.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{badges.map((badge) => <span key={badge} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{badge}</span>)}</div>}
          {subtitle && <p className="mt-5 whitespace-pre-line text-lg leading-8 text-slate-600">{subtitle}</p>}
          {description && description !== subtitle && <p className="mt-5 whitespace-pre-line text-sm leading-7 text-slate-600">{description}</p>}
        </div>
      </section>
      {info.length > 0 && <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Additional Information</h2><dl className="mt-5 grid gap-4 sm:grid-cols-2">{info.map((item) => <div key={item.label} className="rounded-xl bg-slate-50 p-4"><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{item.label}</dt><dd className="mt-1 whitespace-pre-line break-words text-sm text-slate-900">{item.value}</dd></div>)}</dl></section>}
      {children}
    </div>
  </main>;
}
