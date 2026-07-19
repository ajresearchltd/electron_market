import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Supplier identity semantics (Phase 1):
 * - suppliers.supplier_id is the canonical business ID used by products,
 *   supplier_stock_uploads, verified_supplier.canonical_supplier_id, and the
 *   canonical_supplier_id columns on company contacts/documents/contact emails.
 * - rfq_supplier_assignments.supplier_id intentionally remains auth.users.id.
 * Keep procurement aliases and authorization identity separate from public and
 * catalogue supplier identity.
 */

export const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export type CanonicalSupplier = {
  canonicalSupplierId: string;
  sourceProfileId: string;
  authUserId: string;
  companyProfileId: string;
  inputIdType: 'canonical_supplier' | 'company_profile' | 'auth_user' | 'verified_supplier';
  wasLegacyId: boolean;
  supplier: Record<string, any>;
  profile: Record<string, any>;
};

const one = <T>(rows: T[] | null, message: string): T | null => {
  if (!rows?.length) return null;
  if (rows.length !== 1) throw new Error(message);
  return rows[0];
};

/** Resolve route IDs only through declared supplier relationships. Never uses names or email. */
export async function resolveCanonicalSupplierId(database: SupabaseClient, inputId: string): Promise<CanonicalSupplier | null> {
  if (!isUuid(inputId)) return null;
  let inputIdType: CanonicalSupplier['inputIdType'] = 'canonical_supplier';
  let supplier = one((await database.from('suppliers').select('*').eq('supplier_id', inputId).limit(2)).data, 'Ambiguous canonical supplier relationship.');
  let profile: any = null;

  if (!supplier) {
    inputIdType = 'company_profile';
    profile = one((await database.from('supplier_company_profiles').select('*').eq('profile_id', inputId).limit(2)).data, 'Ambiguous supplier profile relationship.');
    if (profile) supplier = one((await database.from('suppliers').select('*').eq('source_profile_id', profile.profile_id).limit(2)).data, 'Ambiguous supplier profile relationship.');
  }
  if (!supplier) {
    inputIdType = 'auth_user';
    profile = one((await database.from('supplier_company_profiles').select('*').eq('user_id', inputId).limit(2)).data, 'Ambiguous authenticated supplier relationship.');
    if (profile) supplier = one((await database.from('suppliers').select('*').eq('source_profile_id', profile.profile_id).limit(2)).data, 'Ambiguous authenticated supplier relationship.');
  }
  if (!supplier) {
    inputIdType = 'verified_supplier';
    const verified = one((await database.from('verified_supplier').select('canonical_supplier_id').eq('supplier_id', inputId).limit(2)).data, 'Ambiguous verified supplier relationship.');
    if (verified?.canonical_supplier_id) supplier = one((await database.from('suppliers').select('*').eq('supplier_id', verified.canonical_supplier_id).limit(2)).data, 'Ambiguous verified supplier relationship.');
  }
  if (!supplier?.source_profile_id) return null;
  if (!profile || profile.profile_id !== supplier.source_profile_id) profile = one((await database.from('supplier_company_profiles').select('*').eq('profile_id', supplier.source_profile_id).limit(2)).data, 'Ambiguous supplier profile relationship.');
  if (!profile || profile.user_id == null) return null;
  return {canonicalSupplierId:supplier.supplier_id,sourceProfileId:profile.profile_id,companyProfileId:profile.profile_id,authUserId:profile.user_id,inputIdType,wasLegacyId:inputId!==supplier.supplier_id,supplier,profile};
}

export async function getCanonicalSupplierForAuthenticatedUser(database: SupabaseClient, user: User): Promise<CanonicalSupplier | null> {
  const resolved = await resolveCanonicalSupplierId(database, user.id);
  if (!resolved || resolved.authUserId !== user.id) return null;
  return resolved;
}
