import 'server-only';

const HIDDEN = '[supplier information hidden]';
const SAFE_FALLBACK = 'The response contained confidential supplier-identifying information and was withheld. Please try the request again.';
export const SUPPLIER_IDENTITY_REFUSAL = 'Supplier identity and direct contact information are confidential within the Electron Market managed procurement process.';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function isSupplierIdentityRequest(value: string) {
  const text = value.toLowerCase();
  const supplierReference = /supplier\s+[a-z]|supplier identity|supplier name|distributor/.test(text);
  const identityAttribute = /name|identity|legal|company|email|e-mail|domain|website|url|phone|telephone|contact|person|address|city|registration|tax|bank|who is|which distributor|guess/.test(text);
  return supplierReference && identityAttribute;
}

export function redactSupplierIdentity(value: string, knownIdentifiers: string[]) {
  let output = String(value ?? '');
  for (const identifier of knownIdentifiers.filter((item) => item.trim().length >= 3).sort((a, b) => b.length - a.length)) {
    output = output.replace(new RegExp(escapeRegExp(identifier), 'gi'), HIDDEN);
    const domain = identifier.includes('@') ? identifier.split('@').at(-1) : '';
    if (domain && domain.length >= 4) output = output.replace(new RegExp(escapeRegExp(domain), 'gi'), HIDDEN);
  }
  output = output
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, HIDDEN)
    .replace(/\b(?:https?:\/\/|www\.)[^\s)\]}]+/gi, HIDDEN)
    .replace(/(?:\b(?:phone|telephone|tel|mobile)\s*[:.]?\s*|\+\d{1,3}[\s().-]?)(?:\d[\d\s().-]{6,}\d)/gi, HIDDEN)
    .replace(/\b(?:supplier|vendor)[-_ ]?(?:id|uuid)\s*[:=#-]?\s*[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, HIDDEN);
  return output;
}

export function sanitizeSupplierCommunicationForCustomerAI(rawText: string, knownIdentifiers: string[]) {
  const withoutQuotedHeaders = String(rawText ?? '')
    .replace(/^(?:from|to|cc|bcc|reply-to|subject):.*$/gim, '')
    .replace(/(?:^|\n)(?:--\s*|kind regards|best regards|regards|sincerely|thanks and regards)[\s\S]*$/i, '\n[supplier signature hidden]');
  return redactSupplierIdentity(withoutQuotedHeaders, knownIdentifiers).replace(/\n{3,}/g, '\n\n').trim();
}

export function guardAssistantOutput(value: string, knownIdentifiers: string[]) {
  const original = String(value ?? '');
  const redacted = redactSupplierIdentity(original, knownIdentifiers);
  const knownLeak = knownIdentifiers.some((identifier) => identifier.trim().length >= 3 && original.toLowerCase().includes(identifier.toLowerCase()));
  const genericLeak = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(original)
    || /\b(?:https?:\/\/|www\.)[^\s)\]}]+/i.test(original)
    || /(?:\b(?:phone|telephone|tel|mobile)\s*[:.]?\s*|\+\d{1,3}[\s().-]?)(?:\d[\d\s().-]{6,}\d)/i.test(original);
  if (knownLeak || genericLeak) return { safe: false, value: SAFE_FALLBACK, redacted };
  return { safe: true, value: redacted, redacted };
}
