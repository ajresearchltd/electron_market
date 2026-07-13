import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserAndAdmin } from '../../../../../lib/ai/config';
import { createRequiredAdminClient } from '../../../../../lib/supabase/admin';
import { getVendorContactSummary, linkOffersForSeller, syncVendorContactsToOfferSnapshot } from '../../../../../lib/vendors/external-vendors';

const validUuid = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const errorJson = (message: string, status = 400) => NextResponse.json({ ok: false, error: message }, { status });

export async function POST(request: NextRequest) {
  const { isAdmin, error } = await getCurrentUserAndAdmin();
  if (!isAdmin) return errorJson(error || 'Admin access required.', 403);

  const body = await request.json().catch(() => ({}));
  const requestId = String(body.request_id || '').trim();
  const sellerName = String(body.seller_name || '').trim();

  if (!validUuid(requestId)) return errorJson('Valid request_id is required.');
  if (!sellerName) return errorJson('seller_name is required.');

  let supabase;
  try {
    supabase = createRequiredAdminClient();
  } catch (clientError) {
    return errorJson(clientError instanceof Error ? clientError.message : 'Server database client is not configured.', 500);
  }

  try {
    const { vendor, offerIds } = await linkOffersForSeller(supabase, requestId, sellerName);
    const summary = await getVendorContactSummary(supabase, vendor.id);
    const hasCentralContacts = summary.contacts.length > 0 || Boolean(summary.vendor?.last_contact_checked_at);
    let warning: string | null = null;

    if (hasCentralContacts && offerIds.length > 0) {
      const syncResult = await syncVendorContactsToOfferSnapshot(supabase, offerIds, vendor.id);
      warning = syncResult.warning;
    }

    return NextResponse.json({
      ok: true,
      vendor,
      offer_ids: offerIds,
      contact: {
        website: summary.website,
        contactPage: summary.contactPage,
        rfqPage: summary.rfqPage,
        emails: summary.emails,
        phone: summary.phones[0] ?? null,
        phones: summary.phones,
        salesContactNames: summary.salesPeople.join(', '),
        country: summary.country,
        city: summary.city,
        address: summary.address,
        locationSourceUrl: null,
        sourceUrls: summary.sourceUrls,
        confidence: summary.confidence,
        status: summary.status,
        error: null,
        notes: summary.notes,
      },
      has_central_contacts: hasCentralContacts,
      warning,
    });
  } catch (resolveError) {
    return errorJson(resolveError instanceof Error ? resolveError.message : 'Unable to resolve external vendor.', 500);
  }
}
