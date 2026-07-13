'use client';

import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import AdminBackButton from '../../../../../components/admin/AdminBackButton';
import { createClient } from '../../../../../../lib/supabase/client';
import { AdminHeader, AdminShell, ErrorList, formatMoney, formatValue, GenericRow, SectionCard } from '../../../../_components/detailShared';

const getSummary = (row: GenericRow | null) => {
  const summary = row?.response_summary_json;
  return summary && typeof summary === 'object' && !Array.isArray(summary) ? summary as GenericRow : {};
};

const getRawOffer = (offer: GenericRow | null) => {
  const raw = offer?.raw_offer_json;
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as GenericRow : {};
};

const pickRawValue = (raw: GenericRow, keys: string[]) => {
  for (const key of keys) {
    const value = raw[key];
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return null;
};

const arrayFromJson = (value: unknown) => Array.isArray(value) ? value.map(String).filter(Boolean) : [];

export default function AdminOctopartOfferDetailPage() {
  const params = useParams<{ requestId: string; offerId: string }>();
  const requestId = params.requestId;
  const offerId = params.offerId;
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [requestRow, setRequestRow] = useState<GenericRow | null>(null);
  const [offer, setOffer] = useState<GenericRow | null>(null);

  useEffect(() => {
    const loadOffer = async () => {
      setLoading(true);
      const nextErrors: string[] = [];
      const [requestResult, offerResult] = await Promise.all([
        supabase.from('octopart_requests').select('*').eq('id', requestId).maybeSingle(),
        supabase
          .from('octopart_request_offers')
          .select('*')
          .eq('id', offerId)
          .eq('octopart_request_id', requestId)
          .maybeSingle(),
      ]);

      if (requestResult.error) nextErrors.push(`octopart_requests: ${requestResult.error.message}`);
      if (offerResult.error) nextErrors.push(`octopart_request_offers: ${offerResult.error.message}`);

      setRequestRow((requestResult.data ?? null) as GenericRow | null);
      setOffer((offerResult.data ?? null) as GenericRow | null);
      setErrors(nextErrors);
      setLoading(false);
    };

    loadOffer();
  }, [requestId, offerId, supabase]);

  const summary = getSummary(requestRow);
  const rawOffer = getRawOffer(offer);
  const title = offer ? 'Octopart Offer Details' : 'Offer Details';
  const subtitle = [offer?.seller_name, offer?.part_number || requestRow?.part_number].filter(Boolean).map(String).join(' | ');
  const commercialDetails: Array<[string, unknown]> = [
    ['Stock / Available Quantity', offer?.available_quantity],
    ['Price', formatMoney(offer?.unit_price, offer?.currency)],
    ['Currency', offer?.currency],
    ['Lead Time', offer?.lead_time_days ? `${offer.lead_time_days} days` : null],
    ['MOQ', pickRawValue(rawOffer, ['moq', 'minimumOrderQuantity', 'minimum_order_quantity'])],
    ['Packaging', pickRawValue(rawOffer, ['packaging', 'packageType', 'package_type'])],
    ['Factory Lead Days', pickRawValue(rawOffer, ['factoryLeadDays', 'factory_lead_days'])],
    ['Seller Country', pickRawValue(rawOffer, ['sellerCountry', 'seller_country', 'country'])],
  ];
  const offerSummaryCards: Array<[string, unknown]> = [
    ['Seller Name', offer?.seller_name],
    ['Part Number', offer?.part_number],
    ['Manufacturer', offer?.manufacturer],
    ['Description', offer?.description],
    ['Available Quantity', offer?.available_quantity],
    ['Unit Price', formatMoney(offer?.unit_price, offer?.currency)],
    ['Currency', offer?.currency],
    ['Lead Time Days', offer?.lead_time_days],
    ['Datasheet URL', offer?.datasheet_url],
    ['Product URL', offer?.product_url],
    ['Source URL', offer?.source_url],
  ];
  const contactSourceUrls = arrayFromJson(offer?.vendor_contact_source_urls);
  const vendorContactCards: Array<[string, unknown]> = [
    ['Website', offer?.vendor_website_url],
    ['Contact Page', offer?.vendor_contact_page_url],
    ['RFQ Page', offer?.vendor_rfq_page_url],
    ['Email 1', offer?.vendor_email_1],
    ['Email 2', offer?.vendor_email_2],
    ['Email 3', offer?.vendor_email_3],
    ['Phone', offer?.vendor_phone],
    ['Sales Contact Names', offer?.vendor_sales_contact_names],
    ['Contact Status', offer?.vendor_contact_status],
    ['Confidence', offer?.vendor_contact_confidence === null || offer?.vendor_contact_confidence === undefined ? null : `${Math.round(Number(offer.vendor_contact_confidence) * 100)}%`],
    ['Checked At', offer?.vendor_contact_checked_at],
    ['Contact Error', offer?.vendor_contact_error],
  ];
  const vendorLocationCards: Array<[string, unknown]> = [
    ['Vendor Country', offer?.vendor_country],
    ['Vendor City', offer?.vendor_city],
    ['Vendor Address', offer?.vendor_address],
  ];
  const visibleVendorLocationCards = vendorLocationCards.filter(([, value]) => value !== null && value !== undefined && value !== '');

  return (
    <AdminShell>
      <AdminHeader eyebrow="Market Data" title={title} subtitle={subtitle} status={String(requestRow?.request_status || '')} action={<AdminBackButton fallbackHref={`/admin/octopart-requests/${requestId}`} />} />
      <div className="mx-auto grid max-w-7xl gap-6 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
        {loading && <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">Loading offer details...</div>}
        <ErrorList errors={errors} />

        <SectionCard title="Offer Header">
          <div className="grid gap-3 md:grid-cols-5">
            <div className="rounded-lg bg-white p-3"><p className="text-xs font-semibold uppercase text-slate-500">Request No</p><p className="mt-1 font-bold">{formatValue(requestRow?.request_number)}</p></div>
            <div className="rounded-lg bg-white p-3"><p className="text-xs font-semibold uppercase text-slate-500">Part Number</p><p className="mt-1 font-bold">{formatValue(offer?.part_number || requestRow?.part_number || summary.part_number)}</p></div>
            <div className="rounded-lg bg-white p-3"><p className="text-xs font-semibold uppercase text-slate-500">Seller</p><p className="mt-1 font-bold">{formatValue(offer?.seller_name)}</p></div>
            <div className="rounded-lg bg-white p-3"><p className="text-xs font-semibold uppercase text-slate-500">Manufacturer</p><p className="mt-1 font-bold">{formatValue(offer?.manufacturer || summary.manufacturer)}</p></div>
            <div className="rounded-lg bg-white p-3"><p className="text-xs font-semibold uppercase text-slate-500">Offer ID</p><p className="mt-1 break-all font-bold">{formatValue(offer?.id)}</p></div>
          </div>
        </SectionCard>

        <SectionCard title="Offer Summary">
          <div className="grid gap-3 md:grid-cols-3">
            {offerSummaryCards.map(([label, value]) => (
              <div key={String(label)} className="min-w-0 rounded-lg bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 break-words text-sm font-bold text-slate-900">{formatValue(value)}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Commercial Details">
          <div className="grid gap-3 md:grid-cols-4">
            {commercialDetails.map(([label, value]) => (
              <div key={label} className="rounded-lg bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 break-words text-sm font-bold text-slate-900">{formatValue(value)}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Vendor Contact / Ordering Method">
          <div className="grid gap-3 md:grid-cols-3">
            {vendorContactCards.map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-lg bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 break-words text-sm font-bold text-slate-900">{formatValue(value)}</p>
              </div>
            ))}
          </div>
          {visibleVendorLocationCards.length > 0 && (
            <div className="mt-4 rounded-lg bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vendor Location</p>
                  <div className="mt-2 grid gap-3 md:grid-cols-3">
                    {visibleVendorLocationCards.map(([label, value]) => (
                      <div key={label} className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                        <p className="mt-0.5 break-words text-sm font-bold text-slate-900">{formatValue(value)}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {offer?.vendor_location_source_url && (
                  <a
                    href={String(offer.vendor_location_source_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center justify-center rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-800 hover:text-white active:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 transition-colors duration-150"
                  >
                    Open Source
                  </a>
                )}
              </div>
            </div>
          )}
          <div className="mt-4 rounded-lg bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contact Source URLs</p>
            {contactSourceUrls.length > 0 ? (
              <div className="mt-2 flex flex-col gap-2">
                {contactSourceUrls.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="break-all text-sm font-semibold text-blue-700 hover:text-blue-800">
                    {url}
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-sm font-bold text-slate-900">-</p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Raw Offer Data">
          <pre className="max-h-96 max-w-full overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-4 text-xs leading-6 text-blue-50">
            {JSON.stringify(offer?.raw_offer_json ?? {}, null, 2)}
          </pre>
        </SectionCard>
      </div>
    </AdminShell>
  );
}
