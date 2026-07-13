'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import AdminBackButton from '../../../components/admin/AdminBackButton';
import { createClient } from '../../../../lib/supabase/client';
import { AdminHeader, AdminShell, ErrorList, formatMoney, formatValue, GenericRow, SectionCard, humanize } from '../../_components/detailShared';

const getSummary = (row: GenericRow | null) => {
  const summary = row?.response_summary_json;
  return summary && typeof summary === 'object' && !Array.isArray(summary) ? summary as GenericRow : {};
};

const numberOrNull = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const sortOffers = (rows: GenericRow[]) => [...rows].sort((a, b) => {
  const priceA = numberOrNull(a.unit_price);
  const priceB = numberOrNull(b.unit_price);
  if (priceA !== null && priceB === null) return -1;
  if (priceA === null && priceB !== null) return 1;
  if (priceA !== null && priceB !== null && priceA !== priceB) return priceA - priceB;

  const stockA = numberOrNull(a.available_quantity) ?? -1;
  const stockB = numberOrNull(b.available_quantity) ?? -1;
  if (stockA !== stockB) return stockB - stockA;

  return String(a.seller_name || '').localeCompare(String(b.seller_name || ''));
});

export default function AdminOctopartRequestDetailPage() {
  const params = useParams<{ requestId: string }>();
  const requestId = params.requestId;
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [requestRow, setRequestRow] = useState<GenericRow | null>(null);
  const [offers, setOffers] = useState<GenericRow[]>([]);

  useEffect(() => {
    const loadRequest = async () => {
      setLoading(true);
      const nextErrors: string[] = [];
      const [requestResult, offersResult] = await Promise.all([
        supabase.from('octopart_requests').select('*').eq('id', requestId).maybeSingle(),
        supabase.from('octopart_request_offers').select('*').eq('octopart_request_id', requestId).order('created_at', { ascending: true }),
      ]);

      if (requestResult.error) nextErrors.push(`octopart_requests: ${requestResult.error.message}`);
      if (offersResult.error) nextErrors.push(`octopart_request_offers: ${offersResult.error.message}`);

      setRequestRow((requestResult.data ?? null) as GenericRow | null);
      setOffers((offersResult.data ?? []) as GenericRow[]);
      setErrors(nextErrors);
      setLoading(false);
    };

    loadRequest();
  }, [requestId, supabase]);

  const summary = getSummary(requestRow);
  const sortedOffers = useMemo(() => sortOffers(offers), [offers]);
  const bestOffer = sortedOffers.find((offer) => numberOrNull(offer.unit_price) !== null) ?? null;
  const title = requestRow ? `Request #${formatValue(requestRow.request_number)}` : 'Octopart Request Details';
  const subtitle = requestRow ? String(requestRow.part_number || '') : '';
  const requestInfoCards: Array<[string, unknown]> = [
    ['Request No', requestRow?.request_number],
    ['Created At', requestRow?.created_at],
    ['Normalized Part Number', requestRow?.normalized_part_number],
    ['Source Provider', humanize(requestRow?.source_provider)],
    ['Request Status', humanize(requestRow?.request_status)],
    ['Chat Session ID', requestRow?.chat_session_id],
    ['User ID', requestRow?.user_id],
    ...(requestRow?.error_message ? [['Error Message', requestRow.error_message] as [string, unknown]] : []),
  ];

  const offerDetailHref = (offer: GenericRow) => `/admin/octopart-requests/${requestId}/offers/${String(offer.id || '')}`;
  const datasheetUrl = typeof summary.datasheet_url === 'string' && summary.datasheet_url.trim() ? summary.datasheet_url.trim() : '';
  const sourceUrl = typeof (summary.source_url || summary.octopart_url) === 'string' ? String(summary.source_url || summary.octopart_url).trim() : '';

  return (
    <AdminShell>
      <AdminHeader eyebrow="Market Data" title={title} subtitle={subtitle} status={String(requestRow?.request_status || '')} action={<AdminBackButton fallbackHref="/admin/octopart-requests" />} />
      <div className="mx-auto grid w-full max-w-7xl gap-6 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
        {loading && <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">Loading Octopart request...</div>}
        <ErrorList errors={errors} />

        <SectionCard title="Request Information">
          <div className="w-full min-w-0 max-w-full">
            <div className="grid w-full min-w-0 max-w-full grid-cols-1 gap-3 sm:grid-cols-2">
              {requestInfoCards.map(([label, value]) => (
                <div key={String(label)} className="min-w-0 max-w-full rounded-lg bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-1 break-words text-sm font-bold text-slate-900">{formatValue(value)}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid w-full min-w-0 max-w-full grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="min-w-0 max-w-full">
                <p className="mb-2 text-sm font-bold text-blue-900">Request Payload</p>
                <pre className="max-h-32 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-3 text-xs leading-5 text-blue-50">
                  {JSON.stringify(requestRow?.request_payload_json ?? {}, null, 2)}
                </pre>
              </div>
              <div className="min-w-0 max-w-full">
                <p className="mb-2 text-sm font-bold text-blue-900">Response Summary JSON</p>
                <pre className="max-h-32 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-3 text-xs leading-5 text-blue-50">
                  {JSON.stringify(requestRow?.response_summary_json ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Normalized Response">
          <div className="grid max-w-full grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="min-w-0 max-w-full rounded-lg bg-white p-3"><p className="text-xs font-semibold uppercase text-slate-500">Manufacturer</p><p className="mt-1 break-words font-bold">{formatValue(summary.manufacturer)}</p></div>
            <div className="min-w-0 max-w-full rounded-lg bg-white p-3"><p className="text-xs font-semibold uppercase text-slate-500">Part Number</p><p className="mt-1 break-words font-bold">{formatValue(summary.part_number)}</p></div>
            <div className="min-w-0 max-w-full rounded-lg bg-white p-3"><p className="text-xs font-semibold uppercase text-slate-500">Offers Count</p><p className="mt-1 break-words font-bold">{formatValue(summary.offers_count ?? offers.length)}</p></div>
            {sourceUrl && (
              <div className="min-w-0 max-w-full rounded-lg bg-white p-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Source</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900" title={sourceUrl}>{sourceUrl}</p>
                  <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-800 hover:text-white active:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 transition-colors duration-150">Open</a>
                </div>
              </div>
            )}
          </div>
          <p className="mt-4 max-w-full break-words rounded-lg bg-white p-3 text-sm leading-6 text-slate-700">{formatValue(summary.description)}</p>
          {datasheetUrl && (
            <div className="mt-4 min-w-0 rounded-lg bg-white p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Datasheet URL</p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900" title={datasheetUrl}>{datasheetUrl}</p>
                <a href={datasheetUrl} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 hover:text-white active:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 transition-colors duration-150">Open Datasheet</a>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Offers / Results">
          <p className="mb-4 rounded-lg border border-blue-100 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
            Octopart/Nexar may return multiple offers for the same Part Number from different distributors, warehouses, packaging types, MOQ levels and price breaks. Click a seller to view all offers from that vendor, or click View Details to inspect one offer inside Electron Market.
          </p>

          <div className="mb-4 rounded-xl border border-blue-100 bg-white p-4">
            <h3 className="text-base font-bold text-blue-900">Best Offer</h3>
            {bestOffer ? (
              <div className="mt-3 grid gap-3 md:grid-cols-5">
                <div><p className="text-xs font-semibold uppercase text-slate-500">Seller</p><p className="mt-1 font-bold">{formatValue(bestOffer.seller_name)}</p></div>
                <div><p className="text-xs font-semibold uppercase text-slate-500">Stock</p><p className="mt-1 font-bold">{formatValue(bestOffer.available_quantity)}</p></div>
                <div><p className="text-xs font-semibold uppercase text-slate-500">Price</p><p className="mt-1 font-bold">{formatMoney(bestOffer.unit_price, bestOffer.currency)}</p></div>
                <div><p className="text-xs font-semibold uppercase text-slate-500">Lead Time</p><p className="mt-1 font-bold">{bestOffer.lead_time_days ? `${bestOffer.lead_time_days} days` : '-'}</p></div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Details</p>
                  <Link href={offerDetailHref(bestOffer)} className="mt-1 inline-flex rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 hover:text-white active:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 transition-colors duration-150">View Details</Link>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-600">Best offer cannot be calculated because price data is missing.</p>
            )}
          </div>

          <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-[940px] text-left text-sm">
              <thead className="bg-blue-600 text-white">
                <tr>{['Seller', 'Part Number', 'Manufacturer', 'Stock', 'Price', 'Currency', 'Lead Time', 'Details'].map((heading) => <th key={heading} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">{heading}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {sortedOffers.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">No offers saved for this request.</td></tr>
                ) : sortedOffers.map((offer, index) => {
                  const sellerName = String(offer.seller_name || 'Unknown Seller');
                  const href = `/admin/octopart-requests/${requestId}/vendors/${encodeURIComponent(sellerName)}`;
                  return (
                    <tr key={String(offer.id ?? index)} className="hover:bg-blue-50/50">
                      <td className="px-4 py-3">
                        <Link href={href} className="font-semibold text-blue-700 hover:text-blue-800">{sellerName}</Link>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{formatValue(offer.part_number)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatValue(offer.manufacturer)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatValue(offer.available_quantity)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatMoney(offer.unit_price, offer.currency)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatValue(offer.currency)}</td>
                      <td className="px-4 py-3 text-slate-700">{offer.lead_time_days ? `${offer.lead_time_days} days` : '-'}</td>
                      <td className="px-4 py-3">
                        <Link href={offerDetailHref(offer)} className="inline-flex rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 hover:text-white active:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 transition-colors duration-150">View Details</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Raw Octopart / Nexar Response">
          <pre className="max-h-80 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-4 text-xs leading-6 text-blue-50">
            {JSON.stringify(requestRow?.raw_response_json ?? {}, null, 2)}
          </pre>
        </SectionCard>
      </div>
    </AdminShell>
  );
}
