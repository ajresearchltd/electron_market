export type CustomerCompletenessInput = {
  full_name?: string | null; company_name?: string | null; country_iso2?: string | null; country_name?: string | null;
  contact_phone?: string | null; phone?: string | null; business_registration_number?: string | null; registration_number?: string | null;
};
const placeholders = new Set(['Company details not completed', 'Company profile not completed']);
export function customerProfileCompleteness(profile: CustomerCompletenessInput | null | undefined, company: CustomerCompletenessInput | null | undefined) {
  const missing: string[] = [];
  if (!profile?.full_name?.trim()) missing.push('Name');
  if (!company?.company_name?.trim() || placeholders.has(company.company_name)) missing.push('Company');
  if (!(company?.country_iso2 || company?.country_name)) missing.push('Country');
  if (!(company?.contact_phone || company?.phone)) missing.push('Phone');
  if (!(company?.business_registration_number || company?.registration_number)) missing.push('Company registration');
  return { complete: missing.length === 0, missing };
}
