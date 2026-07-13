'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import AdminBackButton from '../../../../../components/admin/AdminBackButton';
import { createClient } from '../../../../../../lib/supabase/client';
import { AdminHeader, AdminShell, ErrorList, formatMoney, formatValue, GenericRow, SectionCard } from '../../../../_components/detailShared';

type VendorContactResult = {
  website: string | null;
  contactPage: string | null;
  rfqPage: string | null;
  emails: string[];
  phone: string | null;
  salesContactNames: string;
  country: string | null;
  city: string | null;
  address: string | null;
  locationSourceUrl: string | null;
  sourceUrls: string[];
  confidence: number | null;
  status: string;
  error: string | null;
  notes: string | null;
};

type ExternalVendorRow = {
  id: string;
  seller_name: string | null;
  official_company_name: string | null;
  normalized_seller_name: string | null;
  official_website_url: string | null;
  website_domain: string | null;
  vendor_country: string | null;
  vendor_city: string | null;
  vendor_address: string | null;
  contact_status: string | null;
  verification_status: string | null;
  confidence: number | null;
  notes: string | null;
  last_contact_checked_at: string | null;
  last_verified_at: string | null;
};

const getSummary = (row: GenericRow | null) => {
  const summary = row?.response_summary_json;
  return summary && typeof summary === 'object' && !Array.isArray(summary) ? summary as GenericRow : {};
};

const arrayFromJson = (value: unknown) => Array.isArray(value) ? value.map(String).filter(Boolean) : [];

const contactFromOffer = (offer: GenericRow | null): VendorContactResult => {
  const raw = offer?.vendor_contact_raw_json;
  const rawObject = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as GenericRow : {};
  return {
    website: String(offer?.vendor_website_url || '') || null,
    contactPage: String(offer?.vendor_contact_page_url || '') || null,
    rfqPage: String(offer?.vendor_rfq_page_url || '') || null,
    emails: [offer?.vendor_email_1, offer?.vendor_email_2, offer?.vendor_email_3].map((value) => String(value || '')).filter(Boolean),
    phone: String(offer?.vendor_phone || '') || null,
    salesContactNames: String(offer?.vendor_sales_contact_names || '') || '',
    country: String(offer?.vendor_country || '') || null,
    city: String(offer?.vendor_city || '') || null,
    address: String(offer?.vendor_address || '') || null,
    locationSourceUrl: String(offer?.vendor_location_source_url || '') || null,
    sourceUrls: arrayFromJson(offer?.vendor_contact_source_urls),
    confidence: offer?.vendor_contact_confidence === null || offer?.vendor_contact_confidence === undefined ? null : Number(offer.vendor_contact_confidence),
    status: String(offer?.vendor_contact_status || 'not_checked'),
    error: String(offer?.vendor_contact_error || '') || null,
    notes: String(rawObject.notes || '') || null,
  };
};

const contactFromCentralPayload = (value: GenericRow, fallback: VendorContactResult): VendorContactResult => ({
  website: String(value.website || '') || fallback.website,
  contactPage: String(value.contactPage || '') || fallback.contactPage,
  rfqPage: String(value.rfqPage || '') || fallback.rfqPage,
  emails: Array.isArray(value.emails) ? value.emails.map(String).filter(Boolean).slice(0, 3) : fallback.emails,
  phone: String(value.phone || '') || fallback.phone,
  salesContactNames: String(value.salesContactNames || '') || fallback.salesContactNames,
  country: String(value.country || '') || fallback.country,
  city: String(value.city || '') || fallback.city,
  address: String(value.address || '') || fallback.address,
  locationSourceUrl: String(value.locationSourceUrl || '') || fallback.locationSourceUrl,
  sourceUrls: Array.isArray(value.sourceUrls) ? Array.from(new Set([...value.sourceUrls.map(String).filter(Boolean), ...fallback.sourceUrls])) : fallback.sourceUrls,
  confidence: value.confidence === null || value.confidence === undefined ? fallback.confidence : Number(value.confidence),
  status: String(value.status || fallback.status || 'not_checked'),
  error: String(value.error || '') || fallback.error,
  notes: String(value.notes || '') || fallback.notes,
});

const numberOrNull = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const sortVendorOffers = (rows: GenericRow[]) => [...rows].sort((a, b) => {
  const priceA = numberOrNull(a.unit_price);
  const priceB = numberOrNull(b.unit_price);
  if (priceA !== null && priceB === null) return -1;
  if (priceA === null && priceB !== null) return 1;
  if (priceA !== null && priceB !== null && priceA !== priceB) return priceA - priceB;

  const stockA = numberOrNull(a.available_quantity) ?? -1;
  const stockB = numberOrNull(b.available_quantity) ?? -1;
  if (stockA !== stockB) return stockB - stockA;

  const leadA = numberOrNull(a.lead_time_days) ?? Number.MAX_SAFE_INTEGER;
  const leadB = numberOrNull(b.lead_time_days) ?? Number.MAX_SAFE_INTEGER;
  return leadA - leadB;
});

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export default function AdminOctopartVendorOffersPage() {
  const params = useParams<{ requestId: string; sellerKey: string }>();
  const requestId = params.requestId;
  const sellerName = safeDecode(params.sellerKey || '');
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [requestRow, setRequestRow] = useState<GenericRow | null>(null);
  const [offers, setOffers] = useState<GenericRow[]>([]);
  const [contact, setContact] = useState<VendorContactResult | null>(null);
  const [centralVendor, setCentralVendor] = useState<ExternalVendorRow | null>(null);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactError, setContactError] = useState('');
  const [contactWarning, setContactWarning] = useState('');

  useEffect(() => {
    const loadVendorOffers = async () => {
      setLoading(true);
      const nextErrors: string[] = [];
      const [requestResult, offersResult] = await Promise.all([
        supabase.from('octopart_requests').select('*').eq('id', requestId).maybeSingle(),
        supabase
          .from('octopart_request_offers')
          .select('*')
          .eq('octopart_request_id', requestId)
          .eq('seller_name', sellerName),
      ]);

      if (requestResult.error) nextErrors.push(`octopart_requests: ${requestResult.error.message}`);
      if (offersResult.error) nextErrors.push(`octopart_request_offers: ${offersResult.error.message}`);

      setRequestRow((requestResult.data ?? null) as GenericRow | null);
      const offerRows = sortVendorOffers((offersResult.data ?? []) as GenericRow[]);
      setOffers(offerRows);
      let nextContact = contactFromOffer(offerRows.find((offer) => String(offer.vendor_contact_status || 'not_checked') !== 'not_checked') ?? offerRows[0] ?? null);

      const resolveResponse = await fetch('/api/admin/external-vendors/resolve-seller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, seller_name: sellerName }),
      });
      const resolvePayload = await resolveResponse.json().catch(() => ({}));

      if (resolveResponse.ok && resolvePayload.ok && resolvePayload.vendor) {
        const vendor = resolvePayload.vendor as ExternalVendorRow;
        setCentralVendor(vendor);
        if (resolvePayload.contact) {
          nextContact = contactFromCentralPayload(resolvePayload.contact as GenericRow, nextContact);
        }
        if (resolvePayload.warning) nextErrors.push(`External Vendor Directory: ${resolvePayload.warning}`);
      } else {
        setCentralVendor(null);
        if (resolvePayload.error) nextErrors.push(`External Vendor Directory: ${resolvePayload.error}`);
      }
      setContact(nextContact);
      setErrors(nextErrors);
      setLoading(false);
    };

    loadVendorOffers();
  }, [requestId, sellerName, supabase]);

  const summary = getSummary(requestRow);
  const totalStock = offers.reduce((total, offer) => total + (numberOrNull(offer.available_quantity) ?? 0), 0);
  const pricedOffers = offers.filter((offer) => numberOrNull(offer.unit_price) !== null);
  const lowestPriceOffer = pricedOffers[0] ?? null;
  const fastestLeadTime = offers
    .map((offer) => numberOrNull(offer.lead_time_days))
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b)[0] ?? null;
  const hasSavedContact = contact && contact.status !== 'not_checked';
  const contactUrlCards: Array<[string, string | null]> = contact ? [
    ['Website', contact.website],
    ['Contact Page', contact.contactPage],
    ['RFQ / Quote Page', contact.rfqPage],
  ] : [];
  const visibleContactUrlCards = contactUrlCards.filter(([, value]) => value && value.trim());
  const contactCards: Array<[string, unknown]> = contact ? [
    ['Email 1', contact.emails[0]],
    ['Email 2', contact.emails[1]],
    ['Email 3', contact.emails[2]],
    ['Phone', contact.phone],
    ['Sales Contact Names', contact.salesContactNames],
    ['Confidence', contact.confidence !== null ? `${Math.round(contact.confidence * 100)}%` : null],
    ['Status', contact.status],
  ] : [];
  const visibleContactCards = contactCards.filter(([, value]) => value !== null && value !== undefined && value !== '');
  const locationCards: Array<[string, unknown]> = contact ? [
    ['Country', contact.country],
    ['City', contact.city],
    ['Address', contact.address],
  ] : [];
  const visibleLocationCards = locationCards.filter(([, value]) => value !== null && value !== undefined && value !== '');

  const findContact = async () => {
    if (contactLoading) return;
    setContactLoading(true);
    setContactError('');
    setContactWarning('');

    const response = await fetch('/api/admin/octopart-vendor-contact-discovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_id: requestId,
        seller_name: sellerName,
      }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload.ok) {
      const message = payload.error || 'Vendor contact discovery failed.';
      setContactError(message);
      setContact((current) => current ? { ...current, status: 'error', error: message } : current);
      setContactLoading(false);
      return;
    }

    const next = payload.contact ?? {};
    const vendor = payload.vendor ?? null;
    const locationSaveWarning = typeof payload.warning === 'string' && payload.warning ? payload.warning : '';
    const emailValues = Array.isArray(next.emails) ? next.emails.map((email: any) => typeof email === 'string' ? email : email?.value).filter(Boolean) : [];
    const phoneValues = Array.isArray(next.phones) ? next.phones.map((phone: any) => typeof phone === 'string' ? phone : phone?.value).filter(Boolean) : [];
    const salesNames = Array.isArray(next.sales_contact_names) ? next.sales_contact_names.map((person: any) => typeof person === 'string' ? person : person?.value).filter(Boolean) : [];
    setContact({
      website: next.official_website_url ?? null,
      contactPage: next.contact_page_url ?? null,
      rfqPage: next.rfq_page_url ?? null,
      emails: emailValues,
      phone: phoneValues[0] ?? next.phone ?? null,
      salesContactNames: salesNames.join(', '),
      country: locationSaveWarning ? null : next.country ?? null,
      city: locationSaveWarning ? null : next.city ?? null,
      address: locationSaveWarning ? null : next.address ?? null,
      locationSourceUrl: locationSaveWarning ? null : next.location_source_url ?? null,
      sourceUrls: Array.isArray(next.source_urls) ? next.source_urls : [],
      confidence: typeof next.confidence === 'number' ? next.confidence : null,
      status: next.status || 'needs_review',
      error: null,
      notes: next.notes ?? null,
    });
    if (vendor?.id) setCentralVendor(vendor);
    setContactWarning(locationSaveWarning ? 'Location fields were not saved. Run database helper if location data is required.' : '');
    setContactLoading(false);
  };

  const markVerified = async () => {
    if (!centralVendor?.id) return;
    const response = await fetch(`/api/admin/external-vendors/${centralVendor.id}/verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verification_status: 'verified' }),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok && payload.vendor) setCentralVendor(payload.vendor);
  };

  return (
    <AdminShell>
      <AdminHeader
        eyebrow="Vendor Offers"
        title={sellerName || 'Vendor Offers'}
        subtitle="Full Octopart/Nexar offers from this seller for the selected request."
        status={String(requestRow?.request_status || '')}
        action={<AdminBackButton fallbackHref={`/admin/octopart-requests/${requestId}`} />}
      />
      <div className="mx-auto grid max-w-7xl gap-6 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
        {loading && <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">Loading vendor offers...</div>}
        <ErrorList errors={errors} />

        <SectionCard title="Vendor Request Summary">
          <div className="grid gap-3 md:grid-cols-5">
            <div className="rounded-lg bg-white p-3"><p className="text-xs font-semibold uppercase text-slate-500">Request No</p><p className="mt-1 font-bold">{formatValue(requestRow?.request_number)}</p></div>
            <div className="rounded-lg bg-white p-3"><p className="text-xs font-semibold uppercase text-slate-500">Part Number</p><p className="mt-1 font-bold">{formatValue(requestRow?.part_number || summary.part_number)}</p></div>
            <div className="rounded-lg bg-white p-3"><p className="text-xs font-semibold uppercase text-slate-500">Manufacturer</p><p className="mt-1 font-bold">{formatValue(summary.manufacturer || offers[0]?.manufacturer)}</p></div>
            <div className="rounded-lg bg-white p-3"><p className="text-xs font-semibold uppercase text-slate-500">Seller Name</p><p className="mt-1 font-bold">{formatValue(sellerName)}</p></div>
            <div className="rounded-lg bg-white p-3"><p className="text-xs font-semibold uppercase text-slate-500">Offers Count</p><p className="mt-1 font-bold">{offers.length}</p></div>
          </div>
        </SectionCard>

        <SectionCard title="Vendor Offer Metrics">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg bg-white p-3"><p className="text-xs font-semibold uppercase text-slate-500">Total Offers</p><p className="mt-1 text-lg font-bold">{offers.length}</p></div>
            <div className="rounded-lg bg-white p-3"><p className="text-xs font-semibold uppercase text-slate-500">Total Stock</p><p className="mt-1 text-lg font-bold">{totalStock || '-'}</p></div>
            <div className="rounded-lg bg-white p-3"><p className="text-xs font-semibold uppercase text-slate-500">Lowest Price</p><p className="mt-1 text-lg font-bold">{lowestPriceOffer ? formatMoney(lowestPriceOffer.unit_price, lowestPriceOffer.currency) : '-'}</p></div>
            <div className="rounded-lg bg-white p-3"><p className="text-xs font-semibold uppercase text-slate-500">Fastest Lead Time</p><p className="mt-1 text-lg font-bold">{fastestLeadTime !== null ? `${fastestLeadTime} days` : '-'}</p></div>
          </div>
        </SectionCard>

        <SectionCard title="Vendor Offers">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-[840px] text-left text-sm">
              <thead className="bg-blue-600 text-white">
                <tr>
                  {['Part Number', 'Manufacturer', 'Stock', 'Price', 'Currency', 'Lead Time', 'Details'].map((heading) => (
                    <th key={heading} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {offers.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">No offers found for this seller and request.</td></tr>
                ) : offers.map((offer, index) => {
                  const rowId = String(offer.id ?? index);
                  return (
                    <tr key={rowId} className="hover:bg-blue-50/50">
                      <td className="px-4 py-3 text-slate-700">{formatValue(offer.part_number)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatValue(offer.manufacturer)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatValue(offer.available_quantity)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatMoney(offer.unit_price, offer.currency)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatValue(offer.currency)}</td>
                      <td className="px-4 py-3 text-slate-700">{offer.lead_time_days ? `${offer.lead_time_days} days` : '-'}</td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/octopart-requests/${requestId}/offers/${String(offer.id || '')}`} className="inline-flex rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 hover:text-white active:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 transition-colors duration-150">View Details</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Vendor Contact / Ordering Method">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm leading-6 text-slate-700">
                Use AI web search to discover official public ordering, RFQ, sales, or customer service contacts for this vendor.
              </p>
              {centralVendor && <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-blue-700">Loaded from External Vendor Directory</p>}
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">No email is sent automatically.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {centralVendor?.id && (
                <Link href={`/admin/external-vendors/${centralVendor.id}`} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 hover:text-white active:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 transition-colors duration-150">Open Vendor Profile</Link>
              )}
              {centralVendor?.id && centralVendor.verification_status !== 'verified' && (
                <button type="button" onClick={markVerified} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 hover:text-white active:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 transition-colors duration-150">Mark as Verified</button>
              )}
              <button
                type="button"
                onClick={findContact}
                disabled={contactLoading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 hover:text-white active:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {contactLoading ? 'Searching...' : hasSavedContact ? 'REFRESH CONTACT' : 'FIND CONTACT'}
              </button>
            </div>
          </div>

          {contactLoading && <div className="mt-4 rounded-lg border border-blue-100 bg-white px-4 py-3 text-sm font-medium text-blue-800">Searching contact information with AI...</div>}
          {(contactError || (contact?.status === 'error' && contact?.error)) && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{contactError || contact?.error}</div>}
          {contactWarning && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{contactWarning}</div>}
          {(!contact || contact.status === 'not_checked') && !contactLoading && !contactError && <div className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">No contact information has been found yet.</div>}

          {contact && contact.status !== 'not_checked' && (
            <div className="mt-4 space-y-4">
              {contact.status === 'not_found' && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">No reliable vendor contact was found. Manual review required.</div>}
              {contact.status === 'partial' && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Partial contact information found. Please review before using it for RFQ.</div>}

              {visibleContactUrlCards.length > 0 && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {visibleContactUrlCards.map(([label, url]) => {
                    const fullUrl = url || '';
                    return (
                      <div key={label} className="rounded-lg bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                            <p className="mt-1 truncate text-sm font-medium text-slate-900" title={fullUrl}>{fullUrl}</p>
                          </div>
                          <a
                            href={fullUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-800 hover:text-white active:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 transition-colors duration-150"
                          >
                            Open
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {visibleContactCards.length > 0 && (
                <div className="grid gap-3 md:grid-cols-3">
                  {centralVendor && (
                    <>
                      <div className="min-w-0 rounded-lg bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Verification Status</p>
                        <p className="mt-1 break-words text-sm font-bold text-slate-900">{formatValue(centralVendor.verification_status)}</p>
                      </div>
                      <div className="min-w-0 rounded-lg bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last Contact Checked</p>
                        <p className="mt-1 break-words text-sm font-bold text-slate-900">{formatValue(centralVendor.last_contact_checked_at)}</p>
                      </div>
                      <div className="min-w-0 rounded-lg bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last Verified</p>
                        <p className="mt-1 break-words text-sm font-bold text-slate-900">{formatValue(centralVendor.last_verified_at)}</p>
                      </div>
                    </>
                  )}
                  {visibleContactCards.map(([label, value]) => (
                    <div key={label} className="min-w-0 rounded-lg bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                      <p className="mt-1 break-words text-sm font-bold text-slate-900">{formatValue(value)}</p>
                    </div>
                  ))}
                </div>
              )}

              {(contact.notes || visibleLocationCards.length > 0) && (
                <div className="grid gap-3 md:grid-cols-2">
                  {contact.notes && (
                    <div className="min-w-0 rounded-lg bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</p>
                      <p className="mt-1 break-words text-sm font-bold text-slate-900">{contact.notes}</p>
                    </div>
                  )}

                  {visibleLocationCards.length > 0 && (
                    <div className="min-w-0 rounded-lg bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Company Location</p>
                          <div className="mt-2 space-y-2">
                            {visibleLocationCards.map(([label, value]) => (
                              <div key={label}>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                                <p className="mt-0.5 break-words text-sm font-bold text-slate-900">{formatValue(value)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        {contact.locationSourceUrl && (
                          <a
                            href={contact.locationSourceUrl}
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
                </div>
              )}

              {contact.sourceUrls.length > 0 && (
                <div className="rounded-lg bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Source URLs</p>
                  <div className="mt-2 flex flex-col gap-2">
                    {contact.sourceUrls.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="break-all text-sm font-semibold text-blue-700 hover:text-blue-800">
                        {url}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </SectionCard>
      </div>
    </AdminShell>
  );
}
