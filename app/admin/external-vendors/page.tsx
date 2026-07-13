'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AdminBackButton from '../../components/admin/AdminBackButton';
import { createClient } from '../../../lib/supabase/client';
import { AdminHeader, AdminShell, ErrorList, formatValue, GenericRow, SectionCard } from '../_components/detailShared';
import HubButton from '../../components/ui/HubButton';

export default function AdminExternalVendorsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [vendors, setVendors] = useState<GenericRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('');
  const [contactStatus, setContactStatus] = useState('');
  const [linkedOfferCounts, setLinkedOfferCounts] = useState<Record<string, number>>({});
  const [backfillMessage, setBackfillMessage] = useState('');
  const [backfillLoading, setBackfillLoading] = useState(false);

  const loadVendors = async () => {
    const [vendorResult, offersResult] = await Promise.all([
      supabase
        .from('external_vendors')
        .select('*')
        .order('updated_at', { ascending: false }),
      supabase
        .from('octopart_request_offers')
        .select('external_vendor_id')
        .not('external_vendor_id', 'is', null),
    ]);
    setErrors([vendorResult.error, offersResult.error].filter(Boolean).map((error) => error!.message));
    const counts: Record<string, number> = {};
    ((offersResult.data ?? []) as GenericRow[]).forEach((offer) => {
      const vendorId = String(offer.external_vendor_id || '');
      if (vendorId) counts[vendorId] = (counts[vendorId] ?? 0) + 1;
    });
    setLinkedOfferCounts(counts);
    setVendors((vendorResult.data ?? []) as GenericRow[]);
  };

  useEffect(() => {
    loadVendors();
  }, [supabase]);

  const filteredVendors = vendors.filter((vendor) => {
    const query = search.trim().toLowerCase();
    const haystack = [vendor.seller_name, vendor.official_company_name, vendor.website_domain, vendor.official_website_url].filter(Boolean).join(' ').toLowerCase();
    if (query && !haystack.includes(query)) return false;
    if (verificationStatus && vendor.verification_status !== verificationStatus) return false;
    if (contactStatus && vendor.contact_status !== contactStatus) return false;
    return true;
  });

  const runBackfill = async () => {
    setBackfillLoading(true);
    setBackfillMessage('');
    const response = await fetch('/api/admin/external-vendors/backfill-from-octopart', { method: 'POST' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      setBackfillMessage(payload.error || 'Backfill failed.');
    } else {
      setBackfillMessage(`Backfill complete: ${payload.summary.vendors_created} vendors created, ${payload.summary.offers_linked} offers linked, ${payload.summary.contacts_migrated} contacts migrated.`);
      await loadVendors();
    }
    setBackfillLoading(false);
  };

  return (
    <AdminShell>
      <AdminHeader eyebrow="External Vendors" title="External Vendor Directory" subtitle="Central vendor profiles and reusable contact records for Octopart/Nexar sellers." action={<AdminBackButton fallbackHref="/admin" />} />
      <div className="mx-auto grid w-full max-w-7xl gap-6 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
        <ErrorList errors={errors} />
        <SectionCard title="Filters">
          <div className="grid gap-3 md:grid-cols-4">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search seller, company, domain" className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 md:col-span-2" />
            <select value={verificationStatus} onChange={(event) => setVerificationStatus(event.target.value)} className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              <option value="">All verification</option>
              {['needs_review', 'verified', 'high_risk', 'do_not_use'].map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <select value={contactStatus} onChange={(event) => setContactStatus(event.target.value)} className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              <option value="">All contact status</option>
              {['not_checked', 'found', 'partial', 'needs_review', 'not_found'].map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <HubButton onClick={runBackfill} loading={backfillLoading} loadingText="Backfilling...">Backfill from Octopart Offers</HubButton>
            {backfillMessage && <p className="text-sm font-semibold text-blue-900">{backfillMessage}</p>}
          </div>
        </SectionCard>

        <SectionCard title="External Vendors">
          <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-[980px] text-left text-sm">
              <thead className="bg-blue-600 text-white">
                <tr>{['Seller Name', 'Official Company Name', 'Country', 'Website', 'Linked Offers', 'Contact Status', 'Verification Status', 'Last Checked', 'Action'].map((heading) => <th key={heading} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">{heading}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredVendors.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500">No external vendors found.</td></tr>
                ) : filteredVendors.map((vendor) => (
                  <tr key={String(vendor.id)} className="hover:bg-blue-50/50">
                    <td className="px-4 py-3 font-semibold text-slate-900">{formatValue(vendor.seller_name)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatValue(vendor.official_company_name)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatValue(vendor.vendor_country)}</td>
                    <td className="max-w-64 px-4 py-3 text-slate-700"><span className="block truncate" title={String(vendor.official_website_url || '')}>{formatValue(vendor.website_domain || vendor.official_website_url)}</span></td>
                    <td className="px-4 py-3 text-slate-700">{linkedOfferCounts[String(vendor.id)] ?? 0}</td>
                    <td className="px-4 py-3 text-slate-700">{formatValue(vendor.contact_status)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatValue(vendor.verification_status)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatValue(vendor.last_contact_checked_at)}</td>
                    <td className="px-4 py-3"><Link href={`/admin/external-vendors/${String(vendor.id)}`} className="inline-flex rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 hover:text-white active:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 transition-colors duration-150">View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </AdminShell>
  );
}
