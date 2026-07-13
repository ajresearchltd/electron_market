import 'server-only';

type SupabaseAdminClient = any;
type GenericRow = Record<string, any>;

const SOURCE_PROVIDER = 'nexar_octopart';

export const normalizeSellerName = (name: string) => name
  .trim()
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[.,"'`´()[\]{}:;|\\/]+/g, ' ')
  .replace(/[-_]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const COMPANY_SUFFIX_PATTERN = /\b(incorporated|inc|llc|ltd|limited|corporation|corp|company|co|gmbh|ag|bv|nv|sarl|sas|spa|plc|pty)\b/g;

export const getSellerNameVariants = (name: string) => {
  const normalized = normalizeSellerName(name);
  const withoutSuffix = normalizeSellerName(normalized.replace(COMPANY_SUFFIX_PATTERN, ' '));
  return Array.from(new Set([normalized, withoutSuffix].filter(Boolean)));
};

const domainFromUrl = (url: string | null | undefined) => {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return null;
  }
};

const isMissingColumnError = (message: string) => /Could not find the '.*' column|schema cache/i.test(message);

const ensureVendorAlias = async (
  supabase: SupabaseAdminClient,
  vendorId: string,
  sellerName: string,
  sourceProvider = SOURCE_PROVIDER,
) => {
  const variants = getSellerNameVariants(sellerName);
  for (const normalizedAliasName of variants) {
    const { error } = await supabase
      .from('external_vendor_aliases')
      .upsert({
        vendor_id: vendorId,
        alias_name: sellerName,
        normalized_alias_name: normalizedAliasName,
        source_provider: sourceProvider,
      }, { onConflict: 'normalized_alias_name,source_provider' });
    if (error) throw new Error(`external_vendor_aliases upsert: ${error.message}`);
  }
};

export const getExternalVendorBySellerName = async (
  supabase: SupabaseAdminClient,
  sellerName: string,
  sourceProvider = SOURCE_PROVIDER,
) => {
  const variants = getSellerNameVariants(sellerName);
  if (variants.length === 0) return null;

  const { data: alias } = await supabase
    .from('external_vendor_aliases')
    .select('vendor_id, external_vendors(*)')
    .in('normalized_alias_name', variants)
    .eq('source_provider', sourceProvider)
    .limit(1)
    .maybeSingle();

  if (alias?.external_vendors) {
    await ensureVendorAlias(supabase, alias.vendor_id, sellerName, sourceProvider);
    return alias.external_vendors;
  }

  const { data: vendor } = await supabase
    .from('external_vendors')
    .select('*')
    .in('normalized_seller_name', variants)
    .limit(1)
    .maybeSingle();

  if (vendor?.id) await ensureVendorAlias(supabase, vendor.id, sellerName, sourceProvider);
  return vendor ?? null;
};

export const getOrCreateExternalVendor = async (
  supabase: SupabaseAdminClient,
  sellerName: string,
  sourceProvider = SOURCE_PROVIDER,
) => {
  const normalized = getSellerNameVariants(sellerName)[0] ?? '';
  if (!normalized) throw new Error('seller_name is required.');

  const existing = await getExternalVendorBySellerName(supabase, sellerName, sourceProvider);
  if (existing) {
    await ensureVendorAlias(supabase, existing.id, sellerName, sourceProvider);
    return existing;
  }

  const { data: vendor, error: vendorError } = await supabase
    .from('external_vendors')
    .insert({
      seller_name: sellerName,
      normalized_seller_name: normalized,
      source_provider: sourceProvider,
    })
    .select('*')
    .single();

  if (vendorError) throw new Error(`external_vendors insert: ${vendorError.message}`);

  await ensureVendorAlias(supabase, vendor.id, sellerName, sourceProvider);

  return vendor;
};

export const linkOfferToExternalVendor = async (
  supabase: SupabaseAdminClient,
  offerId: string,
  sellerName: string,
) => {
  const vendor = await getOrCreateExternalVendor(supabase, sellerName);
  const { error } = await supabase
    .from('octopart_request_offers')
    .update({ external_vendor_id: vendor.id })
    .eq('id', offerId);
  if (error && !isMissingColumnError(error.message)) throw new Error(`octopart_request_offers external_vendor_id update: ${error.message}`);
  return vendor;
};

export const getVendorContactSummary = async (supabase: SupabaseAdminClient, vendorId: string) => {
  const [{ data: vendor }, { data: contacts }] = await Promise.all([
    supabase.from('external_vendors').select('*').eq('id', vendorId).maybeSingle(),
    supabase.from('external_vendor_contacts').select('*').eq('vendor_id', vendorId).order('created_at', { ascending: true }),
  ]);

  const rows = (contacts ?? []) as GenericRow[];
  const byType = (type: string) => rows.filter((row) => row.contact_type === type);
  const values = (type: string) => byType(type).map((row) => row.contact_value || row.contact_url).filter(Boolean);
  const urls = Array.from(new Set([
    ...values('source_url'),
    ...rows.map((row) => row.source_url).filter(Boolean),
  ]));

  return {
    vendor,
    contacts: rows,
    website: vendor?.official_website_url || byType('website')[0]?.contact_url || null,
    contactPage: byType('contact_page')[0]?.contact_url || null,
    rfqPage: byType('rfq_page')[0]?.contact_url || null,
    emails: [...values('sales_email'), ...values('support_email')].slice(0, 3),
    phones: values('phone'),
    salesPeople: values('sales_person'),
    sourceUrls: urls,
    country: vendor?.vendor_country || null,
    city: vendor?.vendor_city || null,
    address: vendor?.vendor_address || null,
    status: vendor?.contact_status || 'not_checked',
    verificationStatus: vendor?.verification_status || 'needs_review',
    confidence: vendor?.confidence ?? null,
    notes: vendor?.notes || null,
    lastContactCheckedAt: vendor?.last_contact_checked_at || null,
    lastVerifiedAt: vendor?.last_verified_at || null,
  };
};

const buildOfferSnapshotFromSummary = (vendorId: string, summary: GenericRow) => ({
  external_vendor_id: vendorId,
  vendor_website_url: summary.website,
  vendor_contact_page_url: summary.contactPage,
  vendor_rfq_page_url: summary.rfqPage,
  vendor_email_1: summary.emails[0] ?? null,
  vendor_email_2: summary.emails[1] ?? null,
  vendor_email_3: summary.emails[2] ?? null,
  vendor_phone: summary.phones[0] ?? null,
  vendor_sales_contact_names: summary.salesPeople.join(', ') || null,
  vendor_country: summary.country,
  vendor_city: summary.city,
  vendor_address: summary.address,
  vendor_contact_status: summary.status,
  vendor_contact_confidence: summary.confidence,
  vendor_contact_source_urls: summary.sourceUrls,
  vendor_contact_raw_json: { external_vendor_id: vendorId, notes: summary.notes },
  vendor_contact_checked_at: summary.lastContactCheckedAt,
});

export const getVendorOfferSnapshot = async (supabase: SupabaseAdminClient, vendorId: string) => {
  const summary = await getVendorContactSummary(supabase, vendorId);
  return {
    summary,
    snapshot: buildOfferSnapshotFromSummary(vendorId, summary),
  };
};

export const syncVendorContactsToOfferSnapshot = async (
  supabase: SupabaseAdminClient,
  offerIds: string[],
  vendorId: string,
) => {
  if (offerIds.length === 0) return { warning: null };
  const { snapshot } = await getVendorOfferSnapshot(supabase, vendorId);

  const { error } = await supabase
    .from('octopart_request_offers')
    .update(snapshot)
    .in('id', offerIds);

  if (error) {
    return { warning: isMissingColumnError(error.message) ? 'Snapshot fields were not fully synced because optional columns are missing.' : error.message };
  }

  return { warning: null };
};

export const syncVendorContactsToAllLinkedOffers = async (
  supabase: SupabaseAdminClient,
  vendorId: string,
) => {
  const { data: offers, error } = await supabase
    .from('octopart_request_offers')
    .select('id')
    .eq('external_vendor_id', vendorId);
  if (error) {
    return { warning: isMissingColumnError(error.message) ? 'Linked offer sync skipped because external_vendor_id is missing.' : error.message };
  }

  const offerIds = (offers ?? []).map((offer: GenericRow) => String(offer.id)).filter(Boolean);
  return syncVendorContactsToOfferSnapshot(supabase, offerIds, vendorId);
};

const replaceContacts = async (supabase: SupabaseAdminClient, vendorId: string, contacts: GenericRow[]) => {
  await supabase.from('external_vendor_contacts').delete().eq('vendor_id', vendorId);
  if (contacts.length === 0) return;
  const { error } = await supabase.from('external_vendor_contacts').insert(contacts.map((contact) => ({ ...contact, vendor_id: vendorId })));
  if (error) throw new Error(`external_vendor_contacts insert: ${error.message}`);
};

export const saveDiscoveryToExternalVendor = async ({
  supabase,
  vendor,
  sellerName,
  result,
  openaiResponseId,
}: {
  supabase: SupabaseAdminClient;
  vendor: GenericRow;
  sellerName: string;
  result: GenericRow;
  openaiResponseId?: string;
}) => {
  const now = new Date().toISOString();
  const website = result.official_website_url ?? null;
  const sourceUrls = Array.isArray(result.source_urls) ? result.source_urls.filter(Boolean) : [];
  const contacts: GenericRow[] = [];

  if (website) contacts.push({ contact_type: 'website', contact_url: website, label: 'Website', source_url: website, confidence: result.confidence, is_primary: true });
  if (result.contact_page_url) contacts.push({ contact_type: 'contact_page', contact_url: result.contact_page_url, label: 'Contact Page', source_url: result.contact_page_url, confidence: result.confidence, is_primary: true });
  if (result.rfq_page_url) contacts.push({ contact_type: 'rfq_page', contact_url: result.rfq_page_url, label: 'RFQ / Quote Page', source_url: result.rfq_page_url, confidence: result.confidence, is_primary: true });
  (result.emails ?? []).forEach((email: GenericRow, index: number) => contacts.push({ contact_type: email.type || (index === 0 ? 'sales_email' : 'support_email'), contact_value: email.value, label: email.type || 'Email', source_url: email.source_url, confidence: result.confidence, is_primary: index === 0 }));
  (result.phones ?? []).forEach((phone: GenericRow, index: number) => contacts.push({ contact_type: 'phone', contact_value: phone.value, label: 'Phone', source_url: phone.source_url, confidence: result.confidence, is_primary: index === 0 }));
  (result.sales_contact_names ?? []).forEach((person: GenericRow) => contacts.push({ contact_type: 'sales_person', contact_value: person.value, label: 'Sales Contact', source_url: person.source_url, confidence: result.confidence }));
  sourceUrls.forEach((url: string) => contacts.push({ contact_type: 'source_url', contact_url: url, label: 'Source URL', source_url: url, confidence: result.confidence }));

  const { data: updatedVendor, error: vendorError } = await supabase
    .from('external_vendors')
    .update({
      official_company_name: result.official_company_name ?? sellerName,
      official_website_url: website,
      website_domain: result.website_domain || domainFromUrl(website),
      vendor_country: result.country ?? null,
      vendor_city: result.city ?? null,
      vendor_address: result.address ?? null,
      contact_status: result.status || 'needs_review',
      confidence: result.confidence ?? null,
      notes: result.notes ?? null,
      last_contact_checked_at: now,
      updated_at: now,
    })
    .eq('id', vendor.id)
    .select('*')
    .single();

  if (vendorError) throw new Error(`external_vendors update: ${vendorError.message}`);
  await replaceContacts(supabase, vendor.id, contacts);

  await supabase.from('external_vendor_discovery_logs').insert({
    vendor_id: vendor.id,
    seller_name: sellerName,
    normalized_seller_name: normalizeSellerName(sellerName),
    status: result.status || 'needs_review',
    ai_summary: result.notes ?? null,
    raw_ai_response_json: { ...result, openai_response_id: openaiResponseId ?? null },
    source_urls: sourceUrls,
    error_message: null,
  });

  return updatedVendor;
};

export const linkOffersForSeller = async (
  supabase: SupabaseAdminClient,
  requestId: string,
  sellerName: string,
) => {
  const vendor = await getOrCreateExternalVendor(supabase, sellerName);
  const targetVariants = new Set(getSellerNameVariants(sellerName));
  const { data: offers, error } = await supabase
    .from('octopart_request_offers')
    .select('id, seller_name')
    .eq('octopart_request_id', requestId);
  if (error) throw new Error(`octopart_request_offers select: ${error.message}`);

  const offerIds = (offers ?? [])
    .filter((offer: GenericRow) => getSellerNameVariants(String(offer.seller_name || '')).some((variant) => targetVariants.has(variant)))
    .map((offer: GenericRow) => String(offer.id));
  if (offerIds.length > 0) {
    await supabase.from('octopart_request_offers').update({ external_vendor_id: vendor.id }).in('id', offerIds);
    const summary = await getVendorContactSummary(supabase, vendor.id);
    if (summary.contacts.length > 0 || summary.vendor?.last_contact_checked_at) {
      await syncVendorContactsToOfferSnapshot(supabase, offerIds, vendor.id);
    }
  }

  return { vendor, offerIds };
};

export const linkAllOffersForSeller = async (
  supabase: SupabaseAdminClient,
  sellerName: string,
) => {
  const vendor = await getOrCreateExternalVendor(supabase, sellerName);
  const targetVariants = new Set(getSellerNameVariants(sellerName));
  const { data: offers, error } = await supabase
    .from('octopart_request_offers')
    .select('id, seller_name')
    .not('seller_name', 'is', null);
  if (error) throw new Error(`octopart_request_offers select: ${error.message}`);

  const offerIds = (offers ?? [])
    .filter((offer: GenericRow) => getSellerNameVariants(String(offer.seller_name || '')).some((variant) => targetVariants.has(variant)))
    .map((offer: GenericRow) => String(offer.id));

  if (offerIds.length > 0) {
    const { error: updateError } = await supabase
      .from('octopart_request_offers')
      .update({ external_vendor_id: vendor.id })
      .in('id', offerIds);
    if (updateError && !isMissingColumnError(updateError.message)) throw new Error(`octopart_request_offers external_vendor_id update: ${updateError.message}`);
  }

  return { vendor, offerIds };
};

export const backfillExternalVendorsFromOctopart = async (supabase: SupabaseAdminClient) => {
  const { data: offers, error } = await supabase
    .from('octopart_request_offers')
    .select('*')
    .not('seller_name', 'is', null);
  if (error) throw new Error(`octopart_request_offers select: ${error.message}`);

  let vendorsCreated = 0;
  let offersLinked = 0;
  let contactsMigrated = 0;
  const seen = new Set<string>();

  for (const offer of offers ?? []) {
    const sellerName = String(offer.seller_name || '').trim();
    if (!sellerName) continue;
    const normalized = normalizeSellerName(sellerName);
    const existing = await getExternalVendorBySellerName(supabase, sellerName);
    const vendor = existing ?? await getOrCreateExternalVendor(supabase, sellerName);
    if (!existing && !seen.has(normalized)) vendorsCreated += 1;
    seen.add(normalized);

    const { error: linkError } = await supabase.from('octopart_request_offers').update({ external_vendor_id: vendor.id }).eq('id', offer.id);
    if (!linkError) offersLinked += 1;

    const snapshotContacts: GenericRow[] = [];
    if (offer.vendor_website_url) snapshotContacts.push({ contact_type: 'website', contact_url: offer.vendor_website_url, label: 'Website', source_url: offer.vendor_website_url, is_primary: true });
    if (offer.vendor_contact_page_url) snapshotContacts.push({ contact_type: 'contact_page', contact_url: offer.vendor_contact_page_url, label: 'Contact Page', source_url: offer.vendor_contact_page_url, is_primary: true });
    if (offer.vendor_rfq_page_url) snapshotContacts.push({ contact_type: 'rfq_page', contact_url: offer.vendor_rfq_page_url, label: 'RFQ / Quote Page', source_url: offer.vendor_rfq_page_url, is_primary: true });
    [offer.vendor_email_1, offer.vendor_email_2, offer.vendor_email_3].filter(Boolean).forEach((email, index) => snapshotContacts.push({ contact_type: 'sales_email', contact_value: email, label: `Email ${index + 1}`, is_primary: index === 0 }));
    if (offer.vendor_phone) snapshotContacts.push({ contact_type: 'phone', contact_value: offer.vendor_phone, label: 'Phone', is_primary: true });

    if (snapshotContacts.length > 0) {
      const { data: existingContacts } = await supabase.from('external_vendor_contacts').select('id').eq('vendor_id', vendor.id).limit(1);
      if (!existingContacts || existingContacts.length === 0) {
        await replaceContacts(supabase, vendor.id, snapshotContacts);
        contactsMigrated += snapshotContacts.length;
      }
    }
  }

  return { vendors_created: vendorsCreated, offers_linked: offersLinked, contacts_migrated: contactsMigrated };
};
