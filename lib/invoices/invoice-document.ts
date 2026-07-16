import 'server-only';
import {getInvoiceIssuer} from './invoice-issuer';

type Database = any;
const documentError = () => new Error('Invoice document could not be generated because canonical Invoice data is incomplete.');
const number = (value: unknown) => value === null || value === undefined || value === '' ? null : Number(value);
const text = (value: unknown) => String(value ?? '').trim() || null;

export async function loadCanonicalInvoiceForDocument(db: Database, invoiceId: string) {
  const header = await db.from('procurement_invoices').select([
    'id','invoice_number','invoice_sequence','procurement_chain_id','procurement_case_id',
    'procurement_number','source_rfq_id','generated_at','created_at','invoice_status',
    'currency','subtotal','total_amount','customer_user_id','customer_company_name',
    'supplier_company_name','payment_reference'
  ].join(',')).eq('id', invoiceId).maybeSingle();
  if (header.error || !header.data) throw documentError();

  const itemResult = await db.from('procurement_invoice_items').select([
    'id','invoice_id','line_number','requested_part_number','offered_part_number','part_number',
    'description','manufacturer','quantity','unit','unit_price','normalized_unit_price','currency',
    'price_basis_quantity','price_basis_unit','line_total','moq','available_quantity','lead_time_days',
    'packaging','condition','date_code','incoterms','payment_terms','quotation_valid_until',
    'certificate_available','traceability_available'
  ].join(',')).eq('invoice_id', invoiceId).order('line_number', {ascending: true}).order('id', {ascending: true});
  if (itemResult.error || !itemResult.data?.length) throw documentError();

  const invoice = header.data;
  if (!text(invoice.invoice_number) || !text(invoice.procurement_number)
    || !text(invoice.generated_at || invoice.created_at) || !text(invoice.customer_user_id)
    || !text(invoice.currency) || number(invoice.subtotal) === null || number(invoice.total_amount) === null) {
    console.error('Canonical Invoice document validation failed: required header field missing.', {invoiceId});
    throw documentError();
  }

  const [company, profile, rfq, chain] = await Promise.all([
    db.from('customer_company_profiles').select([
      'user_id','company_name','business_registration_number','registration_number','tax_vat_number',
      'company_address','address_line1','address_line2','city','state_region','postal_code','country_name',
      'contact_email'
    ].join(',')).eq('user_id', invoice.customer_user_id).order('updated_at', {ascending: false}).limit(1).maybeSingle(),
    db.from('user_profiles').select('id,email,company_name').eq('id', invoice.customer_user_id).limit(1).maybeSingle(),
    invoice.source_rfq_id
      ? db.from('rfq_orders0').select('rfq_id,customer_id,customer_email').eq('rfq_id', invoice.source_rfq_id).maybeSingle()
      : Promise.resolve({data: null, error: null}),
    invoice.procurement_chain_id
      ? db.from('procurement_chains').select('id,customer_user_id').eq('id', invoice.procurement_chain_id).maybeSingle()
      : Promise.resolve({data: null, error: null}),
  ]);
  if (company.error || profile.error || rfq.error || chain.error) throw documentError();
  if (company.data?.user_id && company.data.user_id !== invoice.customer_user_id) throw documentError();
  if (rfq.data?.customer_id && rfq.data.customer_id !== invoice.customer_user_id) throw documentError();
  if (chain.data?.customer_user_id && chain.data.customer_user_id !== invoice.customer_user_id) throw documentError();

  let accountEmail: string | null = null;
  try { accountEmail = (await db.auth.admin.getUserById(invoice.customer_user_id)).data?.user?.email || null; } catch {}
  const customerEmail = text(company.data?.contact_email) || text(rfq.data?.customer_email)
    || text(profile.data?.email) || accountEmail;
  const address = [company.data?.company_address, company.data?.address_line1, company.data?.address_line2,
    company.data?.city, company.data?.state_region, company.data?.postal_code, company.data?.country_name]
    .map(text).filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).join(', ') || null;
  const currency = String(invoice.currency).toUpperCase();

  const items = itemResult.data.map((item: any) => {
    const quantity = number(item.quantity), unitPrice = number(item.unit_price), lineTotal = number(item.line_total);
    const basisQuantity = number(item.price_basis_quantity);
    if (item.invoice_id !== invoiceId || !quantity || quantity <= 0 || unitPrice === null || unitPrice < 0
      || lineTotal === null || lineTotal < 0 || !text(item.currency) || String(item.currency).toUpperCase() !== currency
      || !basisQuantity || basisQuantity <= 0 || !text(item.price_basis_unit)) {
      console.error('Canonical Invoice document validation failed: invalid item.', {invoiceId, itemId: item.id});
      throw documentError();
    }
    const normalizedForValidation = number(item.normalized_unit_price) ?? (unitPrice / basisQuantity);
    const expected = quantity * normalizedForValidation;
    if (Math.abs(expected - lineTotal) > 0.01) console.warn('Canonical Invoice line-total discrepancy.', {invoiceId, itemId: item.id});
    return {
      id: item.id, requestedMpn: text(item.requested_part_number || item.part_number),
      offeredMpn: text(item.offered_part_number || item.part_number), description: text(item.description),
      manufacturer: text(item.manufacturer), quantity, quantityUnit: text(item.unit), currency,
      selectedUnitPrice: unitPrice, normalizedUnitPrice: number(item.normalized_unit_price),
      priceBasisQuantity: basisQuantity, priceBasisUnit: text(item.price_basis_unit), lineTotal,
      moq: number(item.moq), availableQuantity: number(item.available_quantity), leadTimeDays: number(item.lead_time_days),
      packaging: text(item.packaging), condition: text(item.condition), dateCode: text(item.date_code),
      incoterms: text(item.incoterms), paymentTerms: text(item.payment_terms),
      quotationValidity: text(item.quotation_valid_until), certificateAvailable: item.certificate_available,
      traceabilityAvailable: item.traceability_available,
    };
  });

  const baseUrl = String(process.env.APP_BASE_URL || '').trim().replace(/\/$/, '');
  if (!baseUrl) {
    console.error('Canonical Invoice document validation failed: APP_BASE_URL missing.', {invoiceId});
    throw documentError();
  }
  return {
    invoice: {id: invoice.id, invoiceNumber: invoice.invoice_number, invoiceSequence: invoice.invoice_sequence,
      procurementNumber: invoice.procurement_number, sourceRfqId: invoice.source_rfq_id,
      generatedAt: invoice.generated_at || invoice.created_at, createdAt: invoice.created_at,
      status: invoice.invoice_status, currency, subtotal: Number(invoice.subtotal), total: Number(invoice.total_amount),
      customerId: invoice.customer_user_id, customerCompanyName: invoice.customer_company_name,
      supplierAlias: null, paymentReference: invoice.payment_reference || invoice.invoice_number},
    customer: {companyName: text(company.data?.company_name) || text(invoice.customer_company_name)
      || text(profile.data?.company_name), registrationNumber: text(company.data?.business_registration_number)
      || text(company.data?.registration_number), vatNumber: text(company.data?.tax_vat_number),
      billingAddress: address, billingEmail: customerEmail, bankAccount: null, iban: null},
    issuer: getInvoiceIssuer(), items,
    applicationUrl: `${baseUrl}/customer/dashboard#customer-invoices`,
    pdfDownloadUrl: `${baseUrl}/api/customer/invoices/${encodeURIComponent(invoice.id)}/pdf`,
  };
}
