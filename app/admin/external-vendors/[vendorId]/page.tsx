'use client';

import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import AdminBackButton from '../../../components/admin/AdminBackButton';
import { createClient } from '../../../../lib/supabase/client';
import { AdminHeader, AdminShell, ErrorList, formatValue, GenericRow, SectionCard } from '../../_components/detailShared';

export default function AdminExternalVendorProfilePage() {
  const params = useParams<{ vendorId: string }>();
  const vendorId = params.vendorId;
  const supabase = useMemo(() => createClient(), []);
  const [vendor, setVendor] = useState<GenericRow | null>(null);
  const [contacts, setContacts] = useState<GenericRow[]>([]);
  const [aliases, setAliases] = useState<GenericRow[]>([]);
  const [logs, setLogs] = useState<GenericRow[]>([]);
  const [linkedOffersCount, setLinkedOffersCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  const loadVendor = async () => {
    const [vendorResult, contactsResult, aliasesResult, logsResult, offersResult] = await Promise.all([
      supabase.from('external_vendors').select('*').eq('id', vendorId).maybeSingle(),
      supabase.from('external_vendor_contacts').select('*').eq('vendor_id', vendorId).order('created_at', { ascending: true }),
      supabase.from('external_vendor_aliases').select('*').eq('vendor_id', vendorId).order('created_at', { ascending: true }),
      supabase.from('external_vendor_discovery_logs').select('*').eq('vendor_id', vendorId).order('created_at', { ascending: false }).limit(20),
      supabase.from('octopart_request_offers').select('id', { count: 'exact', head: true }).eq('external_vendor_id', vendorId),
    ]);
    const nextErrors = [vendorResult.error, contactsResult.error, aliasesResult.error, logsResult.error, offersResult.error].filter(Boolean).map((error) => error!.message);
    setErrors(nextErrors);
    setVendor((vendorResult.data ?? null) as GenericRow | null);
    setContacts((contactsResult.data ?? []) as GenericRow[]);
    setAliases((aliasesResult.data ?? []) as GenericRow[]);
    setLogs((logsResult.data ?? []) as GenericRow[]);
    setLinkedOffersCount(offersResult.count ?? 0);
  };

  useEffect(() => {
    loadVendor();
  }, [vendorId, supabase]);

  const updateVerification = async (verification_status: string) => {
    const response = await fetch(`/api/admin/external-vendors/${vendorId}/verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verification_status }),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok && payload.vendor) setVendor(payload.vendor);
  };

  const detailCards: Array<[string, unknown]> = [
    ['Seller Name', vendor?.seller_name],
    ['Official Company Name', vendor?.official_company_name],
    ['Normalized Seller Name', vendor?.normalized_seller_name],
    ['Official Website', vendor?.official_website_url],
    ['Website Domain', vendor?.website_domain],
    ['Country', vendor?.vendor_country],
    ['City', vendor?.vendor_city],
    ['Address', vendor?.vendor_address],
    ['Vendor Type', vendor?.vendor_type],
    ['Order Method', vendor?.order_method],
    ['API Supported', vendor?.api_supported],
    ['Contact Status', vendor?.contact_status],
    ['Verification Status', vendor?.verification_status],
    ['Linked Octopart Offers', linkedOffersCount],
    ['Confidence', vendor?.confidence],
    ['Notes', vendor?.notes],
    ['Last Contact Checked', vendor?.last_contact_checked_at],
    ['Last Verified', vendor?.last_verified_at],
  ];

  return (
    <AdminShell>
      <AdminHeader eyebrow="External Vendor Profile" title={String(vendor?.seller_name || 'External Vendor Profile')} subtitle="Central reusable contact and verification record." status={String(vendor?.verification_status || '')} action={<AdminBackButton fallbackHref="/admin/external-vendors" />} />
      <div className="mx-auto grid w-full max-w-7xl gap-6 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
        <ErrorList errors={errors} />
        <SectionCard title="Actions">
          <div className="flex flex-wrap gap-2">
            {[
              ['verified', 'Mark as Verified'],
              ['needs_review', 'Mark as Needs Review'],
              ['high_risk', 'Mark as High Risk'],
              ['do_not_use', 'Mark as Do Not Use'],
            ].map(([status, label]) => (
              <button key={status} type="button" onClick={() => updateVerification(status)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 hover:text-white active:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 transition-colors duration-150">
                {label}
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Vendor Details">
          <div className="grid gap-3 md:grid-cols-3">
            {detailCards.filter(([, value]) => value !== null && value !== undefined && value !== '').map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-lg bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 break-words text-sm font-bold text-slate-900">{formatValue(value)}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Contacts">
          <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-[900px] text-left text-sm">
              <thead className="bg-blue-600 text-white">
                <tr>{['Type', 'Value', 'URL', 'Label', 'Source URL', 'Confidence', 'Verification Status'].map((heading) => <th key={heading} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">{heading}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {contacts.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">No contacts saved.</td></tr> : contacts.map((contact) => (
                  <tr key={String(contact.id)}>
                    <td className="px-4 py-3">{formatValue(contact.contact_type)}</td>
                    <td className="px-4 py-3">{formatValue(contact.contact_value)}</td>
                    <td className="max-w-64 px-4 py-3"><span className="block truncate" title={String(contact.contact_url || '')}>{formatValue(contact.contact_url)}</span></td>
                    <td className="px-4 py-3">{formatValue(contact.label)}</td>
                    <td className="max-w-64 px-4 py-3"><span className="block truncate" title={String(contact.source_url || '')}>{formatValue(contact.source_url)}</span></td>
                    <td className="px-4 py-3">{formatValue(contact.confidence)}</td>
                    <td className="px-4 py-3">{formatValue(contact.verification_status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Aliases">
          <div className="grid gap-3 md:grid-cols-3">
            {aliases.length === 0 ? <p className="text-sm text-slate-600">No aliases saved.</p> : aliases.map((alias) => (
              <div key={String(alias.id)} className="rounded-lg bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{formatValue(alias.source_provider)}</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{formatValue(alias.alias_name)}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Discovery Logs">
          <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-[900px] text-left text-sm">
              <thead className="bg-blue-600 text-white">
                <tr>{['Created At', 'Status', 'AI Summary', 'Source URLs', 'Error Message'].map((heading) => <th key={heading} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">{heading}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {logs.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">No discovery logs saved.</td></tr> : logs.map((log) => (
                  <tr key={String(log.id)}>
                    <td className="px-4 py-3">{formatValue(log.created_at)}</td>
                    <td className="px-4 py-3">{formatValue(log.status)}</td>
                    <td className="max-w-72 px-4 py-3"><span className="block truncate" title={String(log.ai_summary || '')}>{formatValue(log.ai_summary)}</span></td>
                    <td className="max-w-72 px-4 py-3"><span className="block truncate" title={JSON.stringify(log.source_urls || [])}>{formatValue(log.source_urls)}</span></td>
                    <td className="max-w-72 px-4 py-3"><span className="block truncate" title={String(log.error_message || '')}>{formatValue(log.error_message)}</span></td>
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
