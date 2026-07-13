'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AdminBackButton from '../../components/admin/AdminBackButton';
import { createClient } from '../../../lib/supabase/client';
import { AdminHeader, AdminShell, ErrorList, formatValue, GenericRow, SectionCard, humanize } from '../_components/detailShared';

type OctopartRequestRow = GenericRow & {
  id: string;
  request_number: number | null;
  created_at: string | null;
  part_number: string | null;
  source_provider: string | null;
  request_status: string | null;
  user_id: string | null;
  chat_session_id: string | null;
};

export default function AdminOctopartRequestsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [requests, setRequests] = useState<OctopartRequestRow[]>([]);
  const [offerCounts, setOfferCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const loadRequests = async () => {
      setLoading(true);
      const nextErrors: string[] = [];
      const requestsResult = await supabase
        .from('octopart_requests')
        .select('*')
        .order('request_number', { ascending: false })
        .limit(200);

      if (requestsResult.error) {
        nextErrors.push(`octopart_requests: ${requestsResult.error.message}`);
        setErrors(nextErrors);
        setLoading(false);
        return;
      }

      const requestRows = (requestsResult.data ?? []) as OctopartRequestRow[];
      const requestIds = requestRows.map((row) => row.id).filter(Boolean);
      const counts: Record<string, number> = {};

      if (requestIds.length > 0) {
        const offersResult = await supabase
          .from('octopart_request_offers')
          .select('octopart_request_id')
          .in('octopart_request_id', requestIds);

        if (offersResult.error) {
          nextErrors.push(`octopart_request_offers: ${offersResult.error.message}`);
        } else {
          (offersResult.data ?? []).forEach((offer: GenericRow) => {
            const requestId = String(offer.octopart_request_id || '');
            counts[requestId] = (counts[requestId] ?? 0) + 1;
          });
        }
      }

      setRequests(requestRows);
      setOfferCounts(counts);
      setErrors(nextErrors);
      setLoading(false);
    };

    loadRequests();
  }, [supabase]);

  return (
    <AdminShell>
      <AdminHeader eyebrow="Market Data" title="Octopart Requests" subtitle="Saved Nexar / Octopart searches from Upload BOM / Get Quotes." action={<AdminBackButton fallbackHref="/admin" />} />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {loading && <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">Loading Octopart requests...</div>}
        <ErrorList errors={errors} />

        <SectionCard title="Request History">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-[1050px] text-left text-sm">
              <thead className="bg-blue-600 text-white">
                <tr>
                  {['Request No', 'Created At', 'Part Number', 'Source', 'Status', 'Offers Count', 'User / Chat Session', 'Action'].map((heading) => (
                    <th key={heading} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {requests.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">No Octopart requests found.</td></tr>
                ) : requests.map((row) => (
                  <tr key={row.id} className="hover:bg-blue-50/50">
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">{formatValue(row.request_number)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatValue(row.created_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{formatValue(row.part_number)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{humanize(row.source_provider)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{humanize(row.request_status)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{offerCounts[row.id] ?? 0}</td>
                    <td className="max-w-72 truncate whitespace-nowrap px-4 py-3 text-slate-700" title={[row.user_id, row.chat_session_id].filter(Boolean).join(' | ')}>
                      {[row.user_id, row.chat_session_id].filter(Boolean).join(' | ') || '-'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link href={`/admin/octopart-requests/${row.id}`} className="inline-flex rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 hover:text-white active:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 transition-colors duration-150">
                        View
                      </Link>
                    </td>
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
