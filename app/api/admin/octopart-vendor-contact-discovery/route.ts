import { NextRequest, NextResponse } from 'next/server';
import { createOpenAIClient, extractResponseText, getCurrentUserAndAdmin, loadAiConfig, resolveOpenAIKey } from '../../../../lib/ai/config';
import { createRequiredAdminClient } from '../../../../lib/supabase/admin';
import { getOrCreateExternalVendor, linkAllOffersForSeller, linkOffersForSeller, saveDiscoveryToExternalVendor, syncVendorContactsToAllLinkedOffers, syncVendorContactsToOfferSnapshot } from '../../../../lib/vendors/external-vendors';

type VendorContactResult = {
  seller_name: string;
  official_company_name: string | null;
  official_website_url: string | null;
  website_domain: string | null;
  contact_page_url: string | null;
  rfq_page_url: string | null;
  emails: Array<{ type: string; value: string; source_url: string | null }>;
  phones: Array<{ value: string; source_url: string | null }>;
  phone: string | null;
  sales_contact_names: Array<{ value: string; source_url: string | null }>;
  country: string | null;
  city: string | null;
  address: string | null;
  location_source_url: string | null;
  source_urls: string[];
  confidence: number | null;
  status: 'found' | 'partial' | 'not_found' | 'needs_review' | 'error';
  notes: string | null;
};

const errorJson = (message: string, status = 400, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, error: message, ...extra }, { status });
const validUuid = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const nullableString = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const stringArray = (value: unknown) => Array.isArray(value) ? value.map((item) => nullableString(item)).filter((item): item is string => Boolean(item)).slice(0, 12) : [];
const contactObjectArray = (value: unknown, fallbackType: string) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return { type: fallbackType, value: nullableString(item), source_url: null };
      return {
        type: nullableString(item?.type) || fallbackType,
        value: nullableString(item?.value),
        source_url: nullableString(item?.source_url),
      };
    })
    .filter((item): item is { type: string; value: string; source_url: string | null } => Boolean(item.value))
    .slice(0, 12);
};

const extractJsonFromText = (text: string) => {
  const trimmed = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    }
  }
  throw new Error('AI returned invalid JSON.');
};

const normalizeResult = (value: any, sellerName: string): VendorContactResult => {
  const emails = contactObjectArray(value?.emails, 'sales_email').slice(0, 3);
  const phones = contactObjectArray(value?.phones ?? (value?.phone ? [value.phone] : []), 'phone');
  const salesContacts = contactObjectArray(value?.sales_contact_names, 'sales_person');
  const confidence = Number(value?.confidence);
  const status = ['found', 'partial', 'not_found', 'needs_review'].includes(value?.status) ? value.status : 'needs_review';
  return {
    seller_name: nullableString(value?.seller_name) || sellerName,
    official_company_name: nullableString(value?.official_company_name),
    official_website_url: nullableString(value?.official_website_url),
    website_domain: nullableString(value?.website_domain),
    contact_page_url: nullableString(value?.contact_page_url),
    rfq_page_url: nullableString(value?.rfq_page_url),
    emails,
    phones,
    phone: phones[0]?.value ?? nullableString(value?.phone),
    sales_contact_names: salesContacts,
    country: nullableString(value?.country),
    city: nullableString(value?.city),
    address: nullableString(value?.address),
    location_source_url: nullableString(value?.location_source_url),
    source_urls: stringArray(value?.source_urls),
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : null,
    status,
    notes: nullableString(value?.notes),
  };
};

const buildPrompt = ({
  sellerName,
  partNumber,
  manufacturer,
}: {
  sellerName: string;
  partNumber: string;
  manufacturer: string;
}) => `You are a B2B electronic components vendor contact discovery assistant.

You must find official public ordering/contact information for this seller/vendor:

Seller name: ${sellerName}
Part number from current request: ${partNumber || 'Unknown'}
Manufacturer: ${manufacturer || 'Unknown'}

Your task:
1. Identify the official company website.
2. Find official contact page.
3. Find official RFQ / quote request / sales inquiry page if available.
4. Find up to 3 public business email addresses relevant to sales, RFQ, orders, or customer service.
5. Find public business phone number if available.
6. Find names of sales/contact people only if publicly listed and clearly relevant.
7. Find official company location when publicly available: country, city, and business or registered address.
8. Provide the source URL where location/address was found.
9. Provide source URLs for every important contact found.
10. Prefer official website pages over directories.
11. Do not invent any email, phone, website, person, country, city, or address.
12. If unsure, return null and explain.

Return strict JSON only.
Do not include markdown.
Do not include code fences.
Do not include explanation outside JSON.

JSON schema:
{
  "seller_name": "...",
  "official_company_name": "... or null",
  "official_website_url": "... or null",
  "website_domain": "... or null",
  "contact_page_url": "... or null",
  "rfq_page_url": "... or null",
  "emails": [
    {"type": "sales_email", "value": "...", "source_url": "..."},
    {"type": "support_email", "value": "...", "source_url": "..."}
  ],
  "phones": [
    {"value": "...", "source_url": "..."}
  ],
  "sales_contact_names": [
    {"value": "...", "source_url": "..."}
  ],
  "country": "... or null",
  "city": "... or null",
  "address": "... or null",
  "location_source_url": "... or null",
  "source_urls": [
    "...",
    "..."
  ],
  "confidence": 0.0,
  "status": "found | partial | not_found | needs_review",
  "notes": "short explanation"
}

Rules:
- Emails must be real strings found on public pages.
- Do not guess email patterns unless it is actually found.
- Do not use personal private data.
- Do not include unrelated companies with similar names.
- For location, prefer official company website, Contact page, About page, Legal notice, Terms page, or Imprint page.
- Do not use random directory websites for location unless the official website does not provide location.
- If location is ambiguous, return null values for uncertain fields and mention that in notes.
- If only country is found, return country only.
- If full address is found, return the full address.
- If the seller name is ambiguous, status must be needs_review.
- If only website is found but no emails/phone, status must be partial.
- If nothing reliable is found, status must be not_found.`;

export async function POST(request: NextRequest) {
  const { isAdmin, error: adminError } = await getCurrentUserAndAdmin();
  if (!isAdmin) return errorJson(adminError || 'Admin access required.', 403);

  const body = await request.json().catch(() => ({}));
  const requestId = String(body.request_id || '').trim();
  const sellerName = String(body.seller_name || '').trim();

  if (!validUuid(requestId)) return errorJson('Valid request_id is required.');
  if (!sellerName) return errorJson('seller_name is required.');

  let adminSupabase;
  try {
    adminSupabase = createRequiredAdminClient();
  } catch (error) {
    return errorJson(error instanceof Error ? error.message : 'Server database client is not configured.', 500);
  }

  const { data: octopartRequest, error: requestError } = await adminSupabase
    .from('octopart_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle();
  if (requestError) return errorJson(`octopart_requests: ${requestError.message}`, 500);
  if (!octopartRequest) return errorJson('Octopart request not found.', 404);

  const { data: offers, error: offersError } = await adminSupabase
    .from('octopart_request_offers')
    .select('*')
    .eq('octopart_request_id', requestId)
    .eq('seller_name', sellerName);
  if (offersError) return errorJson(`octopart_request_offers: ${offersError.message}`, 500);
  if (!offers || offers.length === 0) return errorJson('No offers found for this seller and request.', 404);

  let vendor;
  let offerIds: string[] = [];
  try {
    const linked = await linkOffersForSeller(adminSupabase, requestId, sellerName);
    vendor = linked.vendor;
    offerIds = linked.offerIds;
  } catch (error) {
    try {
      vendor = await getOrCreateExternalVendor(adminSupabase, sellerName);
      offerIds = offers.map((offer: any) => String(offer.id)).filter(Boolean);
    } catch (vendorError) {
      return errorJson(vendorError instanceof Error ? vendorError.message : 'Unable to create external vendor.', 500);
    }
  }

  await adminSupabase
    .from('octopart_request_offers')
    .update({
      vendor_contact_status: 'searching',
      vendor_contact_error: null,
      vendor_contact_checked_at: new Date().toISOString(),
    })
    .eq('octopart_request_id', requestId)
    .eq('seller_name', sellerName);

  const { config, error: configError } = await loadAiConfig();
  if (configError) {
    await adminSupabase.from('octopart_request_offers').update({ vendor_contact_status: 'error', vendor_contact_error: configError }).eq('octopart_request_id', requestId).eq('seller_name', sellerName);
    return errorJson(configError, 500);
  }

  let apiKey = '';
  try {
    apiKey = resolveOpenAIKey(config);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to resolve OpenAI API key.';
    await adminSupabase.from('octopart_request_offers').update({ vendor_contact_status: 'error', vendor_contact_error: message }).eq('octopart_request_id', requestId).eq('seller_name', sellerName);
    return errorJson(message, 500);
  }
  if (!apiKey) {
    const message = 'AI web search is not configured. Please configure OpenAI API with web search support.';
    await adminSupabase.from('octopart_request_offers').update({ vendor_contact_status: 'error', vendor_contact_error: message }).eq('octopart_request_id', requestId).eq('seller_name', sellerName);
    return errorJson(message, 500);
  }

  const firstOffer = offers[0] ?? {};
  const prompt = buildPrompt({
    sellerName,
    partNumber: String(octopartRequest.part_number || firstOffer.part_number || ''),
    manufacturer: String(firstOffer.manufacturer || ''),
  });

  let rawResponseText = '';
  try {
    const openai = createOpenAIClient(apiKey);
    const response = await openai.responses.create({
      model: config.default_model,
      input: prompt,
      tools: [{ type: 'web_search_preview' }],
    } as any);
    rawResponseText = extractResponseText(response);
    const parsed = extractJsonFromText(rawResponseText);
    const result = normalizeResult(parsed, sellerName);
    const updatedVendor = await saveDiscoveryToExternalVendor({ supabase: adminSupabase, vendor, sellerName, result, openaiResponseId: response.id });
    await linkAllOffersForSeller(adminSupabase, sellerName);
    const currentSyncResult = await syncVendorContactsToOfferSnapshot(adminSupabase, offerIds, updatedVendor.id);
    const allSyncResult = await syncVendorContactsToAllLinkedOffers(adminSupabase, updatedVendor.id);
    const warnings = [currentSyncResult.warning, allSyncResult.warning].filter(Boolean);
    const warning = warnings.length > 0 ? `Central vendor contact saved. Offer snapshot sync warning: ${warnings.join(' ')}` : null;

    return NextResponse.json({
      ok: true,
      contact: result,
      vendor: updatedVendor,
      warning,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI vendor contact discovery failed.';
    if (vendor?.id) {
      await adminSupabase.from('external_vendor_discovery_logs').insert({
        vendor_id: vendor.id,
        seller_name: sellerName,
        status: 'error',
        ai_summary: null,
        raw_ai_response_json: { raw_response_text: rawResponseText || null },
        source_urls: [],
        error_message: message,
      });
    }
    await adminSupabase
      .from('octopart_request_offers')
      .update({
        vendor_contact_status: 'error',
        vendor_contact_error: message,
        vendor_contact_raw_json: { error: message, raw_response_text: rawResponseText || null },
        vendor_contact_checked_at: new Date().toISOString(),
      })
      .eq('octopart_request_id', requestId)
      .eq('seller_name', sellerName);

    return errorJson(message.includes('invalid JSON') ? 'AI returned invalid JSON.' : message, 500);
  }
}
